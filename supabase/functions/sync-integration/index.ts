/**
 * sync-integration Edge Function
 *
 * Invoked by `trigger_integration_sync` RPC (via pg_net or Supabase.functions.invoke).
 * Dispatches to the correct provider adapter, writes results to staging tables,
 * and updates the sync_run record.
 *
 * Request body:
 *  {
 *    sync_run_id:     string  (UUID of the sync_run record)
 *    integration_id:  string  (UUID of the integration)
 *    organization_id: string
 *    provider:        'stripe' | 'quickbooks' | 'xero' | 'gmail' | 'outlook'
 *  }
 *
 * Source-of-truth precedence (highest → lowest):
 *  1. quickbooks, xero  (authoritative accounting)
 *  2. stripe, paypal    (payment providers)
 *  3. gmail, outlook    (email extraction — low confidence, always reviewed)
 *  4. csv, manual       (user uploads)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runStripeSync }      from './adapters/stripe.ts';
import { runQuickBooksSync }  from './adapters/quickbooks.ts';
import { runXeroSync }        from './adapters/xero.ts';
import { runGmailSync }       from './adapters/gmail.ts';
import { runOutlookSync }     from './adapters/outlook.ts';
import type { AdapterContext, SyncResult, InvoiceCandidate } from './adapters/types.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin       = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { sync_run_id, integration_id, organization_id } = body;

    if (!sync_run_id || !integration_id || !organization_id) {
      return jsonResponse({ error: 'Missing required fields: sync_run_id, integration_id, organization_id' }, 400);
    }

    // Load integration record — provider is authoritative from DB, not request body
    const { data: integration, error: intErr } = await admin
      .from('integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('organization_id', organization_id)
      .single();

    if (intErr || !integration) {
      return jsonResponse({ error: 'Integration not found' }, 404);
    }

    if (integration.connection_status !== 'connected') {
      return jsonResponse({ error: 'Integration is not connected' }, 400);
    }

    const provider: string = integration.provider;

    // Load credentials from environment / Vault
    // In production: fetch from Supabase Vault using integration.credential_reference
    // Here we load from env vars scoped by provider (e.g. STRIPE_SECRET_KEY)
    const credentials = resolveCredentials(provider, integration.credential_reference);

    // Validate that at least one credential key is present for this provider
    if (Object.keys(credentials).length === 0) {
      return jsonResponse({
        error: `No credentials configured for provider '${provider}'. ` +
               `Set the required environment variables (e.g. ${provider.toUpperCase()}_SECRET_KEY).`,
      }, 400);
    }

    // Build adapter context
    const ctx: AdapterContext = {
      integration,
      credentials,
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      sinceTimestamp: integration.last_successful_sync_at ?? null,
      cursor: (integration.sync_policy as any)?.cursor ?? null,
    };

    // Dispatch to provider adapter
    let result: SyncResult;
    try {
      result = await dispatch(provider, ctx);
    } catch (err: any) {
      await admin.from('sync_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_summary: [{ error: err.message }],
        })
        .eq('id', sync_run_id);
      return jsonResponse({ error: err.message }, 500);
    }

    // Write invoice candidates to staging
    const { created, updated, failed } = await writeInvoiceCandidates(
      admin, organization_id, integration_id, sync_run_id, provider, result,
    );

    // Update sync run with results
    await admin.from('sync_runs').update({
      status:            'completed',
      completed_at:      new Date().toISOString(),
      records_processed: result.invoices.length + result.payments.length,
      records_created:   created,
      records_updated:   updated,
      records_failed:    failed + result.errors.length,
      error_summary:     result.errors,
      lineage_metadata:  { cursor: result.cursor },
    }).eq('id', sync_run_id);

    // Update integration last_successful_sync_at and cursor
    await admin.from('integrations').update({
      last_successful_sync_at: new Date().toISOString(),
      last_attempted_sync_at:  new Date().toISOString(),
      sync_policy: { ...(integration.sync_policy as object), cursor: result.cursor },
    }).eq('id', integration_id);

    // Refresh read models
    await admin.rpc('refresh_org_read_models', { _org_id: organization_id });

    return jsonResponse({
      ok: true,
      created,
      updated,
      failed,
      errors: result.errors.length,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});

// ── Write candidates ──────────────────────────────────────────────────────────

async function writeInvoiceCandidates(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  integrationId: string,
  syncRunId: string,
  provider: string,
  result: SyncResult,
): Promise<{ created: number; updated: number; failed: number }> {
  let created = 0, updated = 0, failed = 0;

  // Create a synthetic import_batch for this sync run
  const batchId = crypto.randomUUID();
  await admin.from('import_batches').insert({
    id:                 batchId,
    organization_id:    orgId,
    created_by_user_id: (await admin.auth.getUser()).data.user?.id ?? '00000000-0000-0000-0000-000000000000',
    import_type:        provider,
    status:             'processing',
    total_rows:         result.invoices.length,
  }).then(() => {});  // Best effort

  for (const inv of result.invoices) {
    try {
      // Check for existing canonical invoice from same source
      const { data: existing } = await admin.from('invoices')
        .select('id, state, remaining_balance, amount_paid')
        .eq('organization_id', orgId)
        .eq('source_system', provider)
        .eq('source_record_id', inv.source_record_id)
        .maybeSingle();

      if (existing) {
        // Update if data changed (source-of-truth: integration wins)
        const { error } = await admin.from('invoices').update({
          remaining_balance: inv.remaining_balance,
          amount_paid:       inv.amount_paid,
          state:             mapStatusToState(inv.status_raw, inv.due_date),
          last_synced_at:    new Date().toISOString(),
          sync_run_id:       syncRunId,
        }).eq('id', existing.id);

        if (error) throw error;
        updated++;
      } else {
        // Create candidate for review/commit
        await admin.from('invoice_candidates').insert({
          organization_id:       orgId,
          import_batch_id:       batchId,
          source_type:           inv.source_type,
          source_system:         inv.source_system,
          source_record_id:      inv.source_record_id,
          external_invoice_id:   inv.external_invoice_id,
          invoice_number:        inv.invoice_number,
          client_name:           inv.client_name,
          billing_contact_name:  inv.billing_contact_name,
          billing_contact_email: inv.billing_contact_email,
          billing_contact_phone: inv.billing_contact_phone,
          issue_date:            inv.issue_date,
          due_date:              inv.due_date,
          currency:              inv.currency,
          total_amount:          inv.total_amount,
          amount_paid:           inv.amount_paid,
          remaining_balance:     inv.remaining_balance,
          status_raw:            inv.status_raw,
          payment_terms:         inv.payment_terms,
          notes:                 inv.notes,
          custom_attributes:     inv.custom_attributes,
          mapping_confidence:    inv.mapping_confidence,
          normalization_status:  'normalized',
          // Low-confidence (email) sources go to review; high-confidence (accounting) auto-commit
          validation_status: inv.mapping_confidence === 'high' ? 'valid' : 'pending',
        });
        created++;
      }
    } catch (err: any) {
      failed++;
    }
  }

  // Auto-commit high-confidence (accounting) candidates
  await admin.rpc('commit_staged_import', { _org_id: orgId, _import_batch_id: batchId })
    .then(() => {}).catch(() => {});

  return { created, updated, failed };
}

function mapStatusToState(statusRaw: string | null, dueDate: string | null): string {
  if (!statusRaw) {
    const due = dueDate ? new Date(dueDate) : null;
    if (due && due < new Date()) return 'overdue';
    return 'sent';
  }
  const map: Record<string, string> = {
    paid: 'paid', partially_paid: 'partially_paid',
    overdue: 'overdue', cancelled: 'cancelled', draft: 'draft', sent: 'sent',
  };
  return map[statusRaw] ?? 'sent';
}

// ── Credential resolution ─────────────────────────────────────────────────────

function resolveCredentials(provider: string, _credRef: string | null): Record<string, string> {
  // In production: fetch secrets from Supabase Vault using credRef.
  // For local development: read from environment variables.
  const prefix = provider.toUpperCase().replace(/-/g, '_');
  const env = Deno.env.toObject();
  const creds: Record<string, string> = {};

  Object.entries(env).forEach(([k, v]) => {
    if (k.startsWith(prefix + '_') || k.startsWith('QB_') || k.startsWith('XERO_')
        || k.startsWith('STRIPE_') || k.startsWith('GMAIL_') || k.startsWith('MS_')) {
      creds[k] = v;
    }
  });

  return creds;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function dispatch(provider: string, ctx: AdapterContext): Promise<SyncResult> {
  switch (provider) {
    case 'stripe':      return runStripeSync(ctx);
    case 'quickbooks':  return runQuickBooksSync(ctx);
    case 'xero':        return runXeroSync(ctx);
    case 'gmail':       return runGmailSync(ctx);
    case 'outlook':     return runOutlookSync(ctx);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

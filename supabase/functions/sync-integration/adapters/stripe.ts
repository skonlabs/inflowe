/**
 * Stripe Adapter
 *
 * Syncs payment intents and invoices from Stripe into InFlowe.
 *
 * Source-of-truth precedence: HIGH (payment provider data overrides CSV/manual)
 *
 * Credentials needed:
 *  - STRIPE_SECRET_KEY: Stripe secret key (sk_live_... or sk_test_...)
 *
 * Field mapping:
 *  Stripe Invoice    → InFlowe canonical
 *  ─────────────────────────────────────
 *  id                → source_record_id
 *  number            → invoice_number
 *  customer_name     → client_name
 *  customer_email    → billing_contact_email
 *  amount_due        → total_amount  (divide by 100 for stripe cents)
 *  amount_paid       → amount_paid
 *  amount_remaining  → remaining_balance
 *  currency          → currency (uppercase)
 *  created           → issue_date
 *  due_date          → due_date
 *  status            → status_raw
 *  hosted_invoice_url → payment_link
 *  description       → notes
 */

import type { AdapterContext, SyncResult, InvoiceCandidate, PaymentCandidate } from './types.ts';

const STRIPE_BASE = 'https://api.stripe.com/v1';

async function stripeGet(path: string, key: string, params: Record<string, string> = {}) {
  const url = new URL(`${STRIPE_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Stripe ${path}: ${res.status} ${(err as any)?.error?.message ?? res.statusText}`);
  }
  return res.json();
}

function stripeAmountToDecimal(cents: number): number {
  return Math.round(cents) / 100;
}

function unixToIso(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString().split('T')[0];
}

function normalizeStripeStatus(status: string): string {
  const map: Record<string, string> = {
    paid: 'paid',
    open: 'sent',
    uncollectible: 'overdue',
    void: 'cancelled',
    draft: 'draft',
  };
  return map[status] ?? status;
}

export async function runStripeSync(ctx: AdapterContext): Promise<SyncResult> {
  const key = ctx.credentials['STRIPE_SECRET_KEY'];
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY credential');

  const invoices: InvoiceCandidate[] = [];
  const payments: PaymentCandidate[] = [];
  const errors: SyncResult['errors'] = [];

  // ── Fetch invoices ──────────────────────────────────────────────────────────
  let hasMore = true;
  let startingAfter: string | undefined = ctx.cursor ?? undefined;

  const params: Record<string, string> = {
    limit: '100',
    expand: 'data.customer',
  };
  if (ctx.sinceTimestamp) {
    params['created[gte]'] = String(Math.floor(new Date(ctx.sinceTimestamp).getTime() / 1000));
  }

  while (hasMore) {
    if (startingAfter) params['starting_after'] = startingAfter;

    let page: any;
    try {
      page = await stripeGet('/invoices', key, params);
    } catch (err: any) {
      errors.push({ record_id: 'batch', error: err.message });
      break;
    }

    for (const inv of page.data ?? []) {
      try {
        const customer = typeof inv.customer === 'object' ? inv.customer : null;
        const clientName = customer?.name ?? customer?.email ?? `Stripe customer ${inv.customer}`;
        const contactEmail = customer?.email ?? inv.customer_email ?? null;

        invoices.push({
          source_type: 'integration',
          source_system: 'stripe',
          source_record_id: inv.id,
          external_invoice_id: inv.id,
          invoice_number: inv.number ?? null,
          client_name: clientName,
          billing_contact_name: customer?.name ?? null,
          billing_contact_email: contactEmail,
          billing_contact_phone: customer?.phone ?? null,
          issue_date: unixToIso(inv.created),
          due_date: unixToIso(inv.due_date),
          currency: (inv.currency ?? 'usd').toUpperCase(),
          total_amount: stripeAmountToDecimal(inv.amount_due ?? 0),
          amount_paid: stripeAmountToDecimal(inv.amount_paid ?? 0),
          remaining_balance: stripeAmountToDecimal(inv.amount_remaining ?? 0),
          status_raw: normalizeStripeStatus(inv.status ?? ''),
          payment_terms: null,
          notes: inv.description ?? null,
          custom_attributes: {
            stripe_invoice_id: inv.id,
            hosted_invoice_url: inv.hosted_invoice_url,
            stripe_customer_id: inv.customer,
          },
          mapping_confidence: 'high',
        });
      } catch (err: any) {
        errors.push({ record_id: inv.id, error: err.message });
      }
    }

    hasMore = page.has_more ?? false;
    if (hasMore && page.data?.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  // ── Fetch recent payment intents (for payment reconciliation) ───────────────
  try {
    const piParams: Record<string, string> = { limit: '100' };
    if (ctx.sinceTimestamp) {
      piParams['created[gte]'] = String(Math.floor(new Date(ctx.sinceTimestamp).getTime() / 1000));
    }
    const piPage: any = await stripeGet('/payment_intents', key, piParams);

    for (const pi of piPage.data ?? []) {
      if (pi.status !== 'succeeded') continue;
      payments.push({
        source_type: 'integration',
        source_system: 'stripe',
        source_record_id: pi.id,
        external_payment_id: pi.id,
        related_invoice_source_id: pi.invoice ?? null,
        payment_date: unixToIso(pi.created),
        payment_amount: stripeAmountToDecimal(pi.amount_received ?? pi.amount ?? 0),
        currency: (pi.currency ?? 'usd').toUpperCase(),
        payment_method: pi.payment_method_types?.[0] ?? null,
        transaction_reference: pi.id,
        reconciliation_confidence: pi.invoice ? 'high' : 'medium',
        notes: pi.description ?? null,
      });
    }
  } catch (err: any) {
    errors.push({ record_id: 'payment_intents', error: err.message });
  }

  return {
    invoices,
    payments,
    clients: [],  // Derived from invoice customer data
    errors,
    cursor: invoices.length > 0
      ? invoices[invoices.length - 1].source_record_id
      : ctx.cursor,
  };
}

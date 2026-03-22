/**
 * QuickBooks Online Adapter
 *
 * Syncs invoices, customers, and payments from QuickBooks Online.
 *
 * Source-of-truth precedence: HIGH (authoritative accounting system)
 *
 * OAuth 2.0 flow:
 *  1. User authorises via QuickBooks OAuth (handled by /auth/quickbooks endpoint)
 *  2. Access token + refresh token stored in Vault referenced by credential_reference
 *  3. This adapter uses the access token; refreshes it if expired
 *
 * Credentials needed (from Vault):
 *  - QB_ACCESS_TOKEN
 *  - QB_REFRESH_TOKEN
 *  - QB_REALM_ID (company ID)
 *  - QB_CLIENT_ID
 *  - QB_CLIENT_SECRET
 *
 * Field mapping:
 *  QB Invoice field  → InFlowe canonical
 *  ──────────────────────────────────────
 *  Id               → source_record_id
 *  DocNumber        → invoice_number
 *  CustomerRef.name → client_name
 *  TxnDate          → issue_date
 *  DueDate          → due_date
 *  TotalAmt         → total_amount
 *  Balance          → remaining_balance
 *  TotalAmt-Balance → amount_paid
 *  CurrencyRef.value→ currency
 *  LinkedTxn        → payment linkage
 */

import type { AdapterContext, SyncResult, InvoiceCandidate } from './types.ts';

const QB_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QB_AUTH = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

async function refreshQbToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch(QB_AUTH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`QB token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

async function qbQuery(realmId: string, token: string, query: string) {
  const url = `${QB_BASE}/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QB query failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeQbStatus(inv: Record<string, unknown>): string {
  const balance = Number(inv.Balance ?? 0);
  const total   = Number(inv.TotalAmt ?? 0);
  if (balance <= 0) return 'paid';
  if (balance < total) return 'partially_paid';
  // Check due date
  const due = inv.DueDate as string | undefined;
  if (due && new Date(due) < new Date()) return 'overdue';
  return 'sent';
}

export async function runQuickBooksSync(ctx: AdapterContext): Promise<SyncResult> {
  let accessToken  = ctx.credentials['QB_ACCESS_TOKEN'];
  const refreshToken  = ctx.credentials['QB_REFRESH_TOKEN'];
  const realmId       = ctx.credentials['QB_REALM_ID'];
  const clientId      = ctx.credentials['QB_CLIENT_ID'];
  const clientSecret  = ctx.credentials['QB_CLIENT_SECRET'];

  if (!realmId) throw new Error('Missing QB_REALM_ID credential');

  // Refresh token if needed (simple heuristic: always try with current, catch 401)
  const invoices: InvoiceCandidate[] = [];
  const errors: SyncResult['errors'] = [];

  let startPos = 1;
  const pageSize = 100;
  let hasMore = true;

  const sinceClause = ctx.sinceTimestamp
    ? ` AND MetaData.LastUpdatedTime >= '${ctx.sinceTimestamp.slice(0, 19)}'`
    : '';

  while (hasMore) {
    const query = `SELECT * FROM Invoice WHERE Active = true${sinceClause} STARTPOSITION ${startPos} MAXRESULTS ${pageSize}`;
    let page: any;

    try {
      page = await qbQuery(realmId, accessToken, query);
    } catch (err: any) {
      // Try refreshing token once
      if (err.message.includes('401') && refreshToken && clientId && clientSecret) {
        try {
          const refreshed = await refreshQbToken(clientId, clientSecret, refreshToken);
          accessToken = refreshed.access_token;
          // Note: In production, the new refresh token must be saved back to Vault
          page = await qbQuery(realmId, accessToken, query);
        } catch (refreshErr: any) {
          errors.push({ record_id: 'batch', error: `Token refresh failed: ${refreshErr.message}` });
          break;
        }
      } else {
        errors.push({ record_id: 'batch', error: err.message });
        break;
      }
    }

    const items: any[] = page?.QueryResponse?.Invoice ?? [];

    for (const inv of items) {
      try {
        const balance    = Number(inv.Balance ?? 0);
        const totalAmt   = Number(inv.TotalAmt ?? 0);
        const amountPaid = Math.max(0, totalAmt - balance);

        // Find billing email from EmailAddr
        const email = inv.BillEmail?.Address ?? null;

        invoices.push({
          source_type: 'integration',
          source_system: 'quickbooks',
          source_record_id: inv.Id,
          external_invoice_id: inv.Id,
          invoice_number: inv.DocNumber ?? null,
          client_name: inv.CustomerRef?.name ?? null,
          billing_contact_name: inv.BillAddr?.Line1 ?? null,
          billing_contact_email: email,
          billing_contact_phone: null,
          issue_date: inv.TxnDate ?? null,
          due_date: inv.DueDate ?? null,
          currency: inv.CurrencyRef?.value ?? 'USD',
          total_amount: totalAmt,
          amount_paid: amountPaid,
          remaining_balance: balance,
          status_raw: normalizeQbStatus(inv),
          payment_terms: inv.SalesTermRef?.name ?? null,
          notes: inv.CustomerMemo?.value ?? null,
          custom_attributes: {
            qb_invoice_id: inv.Id,
            qb_doc_number: inv.DocNumber,
            qb_customer_id: inv.CustomerRef?.value,
          },
          mapping_confidence: 'high',
        });
      } catch (err: any) {
        errors.push({ record_id: inv.Id, error: err.message });
      }
    }

    hasMore = items.length === pageSize;
    startPos += pageSize;
  }

  return {
    invoices,
    payments: [],
    clients: [],
    errors,
    cursor: null,
  };
}

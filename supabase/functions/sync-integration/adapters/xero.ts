/**
 * Xero Adapter
 *
 * Syncs invoices and contacts from Xero.
 *
 * Source-of-truth precedence: HIGH (authoritative accounting system)
 *
 * OAuth 2.0 with PKCE. After user authorises:
 *  - access_token (30 min TTL)
 *  - refresh_token (60 day TTL)
 *  - tenant_id (Xero organisation ID)
 *
 * Credentials needed (from Vault):
 *  - XERO_ACCESS_TOKEN
 *  - XERO_REFRESH_TOKEN
 *  - XERO_TENANT_ID
 *  - XERO_CLIENT_ID
 *  - XERO_CLIENT_SECRET
 *
 * Field mapping:
 *  Xero Invoice      → InFlowe canonical
 *  ────────────────────────────────────
 *  InvoiceID         → source_record_id
 *  InvoiceNumber     → invoice_number
 *  Contact.Name      → client_name
 *  Contact.EmailAddress → billing_contact_email
 *  DateString        → issue_date
 *  DueDateString     → due_date
 *  Total             → total_amount
 *  AmountDue         → remaining_balance
 *  AmountPaid        → amount_paid
 *  CurrencyCode      → currency
 *  Status            → status_raw
 */

import type { AdapterContext, SyncResult, InvoiceCandidate } from './types.ts';

const XERO_BASE     = 'https://api.xero.com/api.xro/2.0';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';

async function refreshXeroToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch(XERO_TOKEN_URL, {
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
  if (!res.ok) throw new Error(`Xero token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string }>;
}

async function xeroGet(path: string, token: string, tenantId: string, params: Record<string, string> = {}) {
  const url = new URL(`${XERO_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-tenant-id': tenantId,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Xero ${path}: ${res.status}`);
  return res.json();
}

function normalizeXeroStatus(status: string): string {
  const map: Record<string, string> = {
    AUTHORISED: 'sent',
    PAID: 'paid',
    VOIDED: 'cancelled',
    DELETED: 'cancelled',
    DRAFT: 'draft',
    SUBMITTED: 'sent',
  };
  return map[status.toUpperCase()] ?? status.toLowerCase();
}

export async function runXeroSync(ctx: AdapterContext): Promise<SyncResult> {
  let accessToken  = ctx.credentials['XERO_ACCESS_TOKEN'];
  const refreshToken  = ctx.credentials['XERO_REFRESH_TOKEN'];
  const tenantId      = ctx.credentials['XERO_TENANT_ID'];
  const clientId      = ctx.credentials['XERO_CLIENT_ID'];
  const clientSecret  = ctx.credentials['XERO_CLIENT_SECRET'];

  if (!tenantId) throw new Error('Missing XERO_TENANT_ID credential');

  const invoices: InvoiceCandidate[] = [];
  const errors: SyncResult['errors'] = [];

  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  const params: Record<string, string> = {
    Type: 'ACCREC',  // Accounts receivable invoices only
    page: String(page),
    pageSize: String(pageSize),
  };

  if (ctx.sinceTimestamp) {
    // Xero uses If-Modified-Since header OR where clause
    const since = new Date(ctx.sinceTimestamp).toISOString().split('T')[0];
    params['where'] = `UpdatedDateUTC>DateTime(${since.replace(/-/g, ',')})`;
  }

  while (hasMore) {
    params['page'] = String(page);
    let data: any;

    try {
      data = await xeroGet('/Invoices', accessToken, tenantId, params);
    } catch (err: any) {
      if (err.message.includes('401') && refreshToken && clientId && clientSecret) {
        try {
          const refreshed = await refreshXeroToken(clientId, clientSecret, refreshToken);
          accessToken = refreshed.access_token;
          data = await xeroGet('/Invoices', accessToken, tenantId, params);
        } catch (re: any) {
          errors.push({ record_id: 'batch', error: `Token refresh failed: ${re.message}` });
          break;
        }
      } else {
        errors.push({ record_id: 'batch', error: err.message });
        break;
      }
    }

    const items: any[] = data?.Invoices ?? [];

    for (const inv of items) {
      try {
        const contact    = inv.Contact ?? {};
        const email      = contact.EmailAddress ?? null;
        const totalAmt   = Number(inv.Total ?? 0);
        const amountDue  = Number(inv.AmountDue ?? 0);
        const amountPaid = Number(inv.AmountPaid ?? 0);

        invoices.push({
          source_type: 'integration',
          source_system: 'xero',
          source_record_id: inv.InvoiceID,
          external_invoice_id: inv.InvoiceID,
          invoice_number: inv.InvoiceNumber ?? null,
          client_name: contact.Name ?? null,
          billing_contact_name: contact.Name ?? null,
          billing_contact_email: email,
          billing_contact_phone: contact.Phones?.[0]?.PhoneNumber ?? null,
          issue_date: inv.DateString ?? null,
          due_date: inv.DueDateString ?? null,
          currency: inv.CurrencyCode ?? 'USD',
          total_amount: totalAmt,
          amount_paid: amountPaid,
          remaining_balance: amountDue,
          status_raw: normalizeXeroStatus(inv.Status ?? ''),
          payment_terms: null,
          notes: inv.Reference ?? null,
          custom_attributes: {
            xero_invoice_id: inv.InvoiceID,
            xero_contact_id: contact.ContactID,
          },
          mapping_confidence: 'high',
        });
      } catch (err: any) {
        errors.push({ record_id: inv.InvoiceID, error: err.message });
      }
    }

    hasMore = items.length === pageSize;
    page++;
  }

  return {
    invoices,
    payments: [],
    clients: [],
    errors,
    cursor: null,
  };
}

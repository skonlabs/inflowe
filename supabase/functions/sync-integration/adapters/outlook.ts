/**
 * Outlook / Microsoft 365 Adapter
 *
 * Scans Outlook/Exchange mailbox for invoice-related emails using Microsoft Graph API.
 *
 * Source-of-truth precedence: LOW-MEDIUM (best-effort extraction from email content)
 *
 * Credentials needed (from Vault):
 *  - MS_ACCESS_TOKEN   (OAuth 2.0 Microsoft token with Mail.Read scope)
 *  - MS_REFRESH_TOKEN
 *  - MS_CLIENT_ID
 *  - MS_CLIENT_SECRET
 *  - MS_TENANT_ID      (for multi-tenant apps)
 *
 * Requires scopes: Mail.Read, offline_access
 */

import type { AdapterContext, SyncResult, InvoiceCandidate } from './types.ts';

const GRAPH_BASE   = 'https://graph.microsoft.com/v1.0/me';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

async function refreshMsToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'Mail.Read offline_access',
    }),
  });
  if (!res.ok) throw new Error(`MS token refresh: ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string }>;
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Graph ${path}: ${res.status}`);
  return res.json();
}

function extractInvoiceFieldsFromBody(subject: string, body: string, fromEmail: string, fromName: string): Partial<{
  invoice_number: string;
  amount: number;
  due_date: string;
  currency: string;
}> {
  const result: ReturnType<typeof extractInvoiceFieldsFromBody> = {};

  const invNumMatch = body.match(/(?:invoice\s*(?:no|number|#|num)?\s*[:.\-]?\s*)([A-Z0-9\-]{3,20})/i)
    ?? subject.match(/(?:inv(?:oice)?\s*[-#]?\s*)(\d{3,10})/i);
  if (invNumMatch) result.invoice_number = invNumMatch[1];

  const amountMatch = body.match(/(?:total|amount|due|balance)\s*:?\s*[$£€]?\s*([\d,]+\.?\d{0,2})/i);
  if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

  const dueDateMatch = body.match(/(?:due\s*(?:date|by|on)?)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  if (dueDateMatch) result.due_date = dueDateMatch[1];

  if (body.includes('£') || body.includes('GBP')) result.currency = 'GBP';
  else if (body.includes('€') || body.includes('EUR')) result.currency = 'EUR';
  else result.currency = 'USD';

  return result;
}

/** Microsoft Graph search filter for invoice-related emails */
function buildFilter(sinceTimestamp: string | null): string {
  const keywordFilter = [
    "contains(subject,'invoice')",
    "contains(subject,'payment due')",
    "contains(subject,'amount due')",
  ].join(' or ');

  if (sinceTimestamp) {
    const since = new Date(sinceTimestamp).toISOString();
    return `(${keywordFilter}) and receivedDateTime ge ${since}`;
  }
  return `(${keywordFilter})`;
}

export async function runOutlookSync(ctx: AdapterContext): Promise<SyncResult> {
  let token      = ctx.credentials['MS_ACCESS_TOKEN'];
  const refresh  = ctx.credentials['MS_REFRESH_TOKEN'];
  const clientId = ctx.credentials['MS_CLIENT_ID'];
  const clientSec = ctx.credentials['MS_CLIENT_SECRET'];

  const invoices: InvoiceCandidate[] = [];
  const errors: SyncResult['errors'] = [];

  const filter = buildFilter(ctx.sinceTimestamp);
  const select = 'id,subject,from,receivedDateTime,body,hasAttachments';

  let nextLink: string | null = null;
  let pagesFetched = 0;
  const MAX_PAGES = 5;

  do {
    let data: any;
    try {
      if (nextLink) {
        // nextLink already contains full URL
        const res = await fetch(nextLink, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Graph nextLink: ${res.status}`);
        data = await res.json();
      } else {
        data = await graphGet('/messages', token, {
          '$filter': filter,
          '$select': select,
          '$top': '20',
          '$orderby': 'receivedDateTime desc',
        });
      }
    } catch (err: any) {
      if (err.message.includes('401') && refresh && clientId && clientSec) {
        const refreshed = await refreshMsToken(clientId, clientSec, refresh);
        token = refreshed.access_token;
        data = await graphGet('/messages', token, {
          '$filter': filter,
          '$select': select,
          '$top': '20',
        });
      } else {
        errors.push({ record_id: 'batch', error: err.message });
        break;
      }
    }

    const messages: any[] = data.value ?? [];
    nextLink = data['@odata.nextLink'] ?? null;

    for (const msg of messages) {
      try {
        const from      = msg.from?.emailAddress ?? {};
        const fromEmail = from.address ?? '';
        const fromName  = from.name ?? fromEmail;
        const subject   = msg.subject ?? '';
        const bodyText  = msg.body?.content ?? '';

        const fields = extractInvoiceFieldsFromBody(subject, bodyText, fromEmail, fromName);

        if (!fromEmail && !fields.invoice_number) continue;

        invoices.push({
          source_type: 'integration',
          source_system: 'outlook',
          source_record_id: msg.id,
          external_invoice_id: null,
          invoice_number: fields.invoice_number ?? null,
          client_name: fromName || fromEmail,
          billing_contact_name: fromName || null,
          billing_contact_email: fromEmail || null,
          billing_contact_phone: null,
          issue_date: msg.receivedDateTime?.split('T')[0] ?? null,
          due_date: fields.due_date ?? null,
          currency: fields.currency ?? 'USD',
          total_amount: fields.amount ?? 0,
          amount_paid: 0,
          remaining_balance: fields.amount ?? 0,
          status_raw: 'sent',
          payment_terms: null,
          notes: `Extracted from email: ${subject}`,
          custom_attributes: {
            outlook_message_id: msg.id,
            email_subject: subject,
            email_from: fromEmail,
            has_attachments: msg.hasAttachments,
          },
          mapping_confidence: 'low',
        });
      } catch (err: any) {
        errors.push({ record_id: msg.id, error: err.message });
      }
    }

    pagesFetched++;
  } while (nextLink && pagesFetched < MAX_PAGES);

  return {
    invoices,
    payments: [],
    clients: [],
    errors,
    cursor: nextLink,
  };
}

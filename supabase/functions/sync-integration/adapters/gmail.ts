/**
 * Gmail Adapter
 *
 * Scans Gmail mailbox for invoice-related threads and extracts structured data.
 *
 * Source-of-truth precedence: LOW-MEDIUM (best-effort extraction from email content)
 *
 * Strategy:
 *  1. Search for emails matching invoice-related patterns
 *  2. Extract invoice data from email body and subject using pattern matching
 *  3. Parse PDF/spreadsheet attachments via attachment-parsing pipeline
 *  4. Assign low confidence — always routed to mapping review
 *
 * Credentials needed (from Vault):
 *  - GMAIL_ACCESS_TOKEN  (OAuth 2.0 Google token with gmail.readonly scope)
 *  - GMAIL_REFRESH_TOKEN
 *  - GMAIL_CLIENT_ID
 *  - GMAIL_CLIENT_SECRET
 *
 * Requires scopes: https://www.googleapis.com/auth/gmail.readonly
 */

import type { AdapterContext, SyncResult, InvoiceCandidate } from './types.ts';

const GMAIL_BASE  = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

async function refreshGoogleToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string }>;
}

async function gmailGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GMAIL_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail ${path}: ${res.status}`);
  return res.json();
}

/** Extract text content from Gmail message parts */
function extractText(payload: any): string {
  if (!payload) return '';
  const parts: any[] = payload.parts ?? [payload];
  let text = '';
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (part.parts) {
      text += extractText(part);
    }
  }
  return text;
}

/** Best-effort extraction of invoice fields from email text */
function extractInvoiceFields(subject: string, body: string, from: string): Partial<{
  invoice_number: string;
  amount: number;
  due_date: string;
  client_name: string;
  currency: string;
}> {
  const result: ReturnType<typeof extractInvoiceFields> = {};

  // Invoice number: INV-XXXX, Invoice #XXXX, etc.
  const invNumMatch = body.match(/(?:invoice\s*(?:no|number|#|num)?\s*[:.\-]?\s*)([A-Z0-9\-]{3,20})/i)
    ?? subject.match(/(?:inv(?:oice)?\s*[-#]?\s*)(\d{3,10})/i);
  if (invNumMatch) result.invoice_number = invNumMatch[1];

  // Amount: $1,234.56 or USD 1234
  const amountMatch = body.match(/(?:total|amount|due|balance)\s*:?\s*[$£€]?\s*([\d,]+\.?\d{0,2})/i);
  if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

  // Due date: various formats
  const dueDateMatch = body.match(/(?:due\s*(?:date|by|on)?)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  if (dueDateMatch) result.due_date = dueDateMatch[1];

  // Currency
  if (body.includes('£') || body.includes('GBP')) result.currency = 'GBP';
  else if (body.includes('€') || body.includes('EUR')) result.currency = 'EUR';
  else result.currency = 'USD';

  // Client name: try From header
  const fromMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (fromMatch) result.client_name = fromMatch[1].trim();

  return result;
}

/** Invoice-related Gmail search query */
const INVOICE_QUERY = [
  'subject:(invoice OR "invoice #" OR "payment due" OR "amount due")',
  'has:attachment',
  '-from:me',
].join(' ');

export async function runGmailSync(ctx: AdapterContext): Promise<SyncResult> {
  let token      = ctx.credentials['GMAIL_ACCESS_TOKEN'];
  const refresh  = ctx.credentials['GMAIL_REFRESH_TOKEN'];
  const clientId = ctx.credentials['GMAIL_CLIENT_ID'];
  const clientSec = ctx.credentials['GMAIL_CLIENT_SECRET'];

  const invoices: InvoiceCandidate[] = [];
  const errors: SyncResult['errors'] = [];

  // Build search query with optional date filter
  let query = INVOICE_QUERY;
  if (ctx.sinceTimestamp) {
    const after = Math.floor(new Date(ctx.sinceTimestamp).getTime() / 1000);
    query += ` after:${after}`;
  }

  let pageToken: string | undefined;
  let pagesFetched = 0;
  const MAX_PAGES = 5;  // Safety limit

  do {
    const params: Record<string, string> = { q: query, maxResults: '20' };
    if (pageToken) params['pageToken'] = pageToken;

    let listPage: any;
    try {
      listPage = await gmailGet('/messages', token, params);
    } catch (err: any) {
      if (err.message.includes('401') && refresh && clientId && clientSec) {
        const refreshed = await refreshGoogleToken(clientId, clientSec, refresh);
        token = refreshed.access_token;
        listPage = await gmailGet('/messages', token, params);
      } else {
        errors.push({ record_id: 'list', error: err.message });
        break;
      }
    }

    const messageIds: string[] = (listPage.messages ?? []).map((m: any) => m.id);

    for (const msgId of messageIds) {
      try {
        const msg: any = await gmailGet(`/messages/${msgId}`, token, {
          format: 'full',
          fields: 'id,threadId,payload,internalDate',
        });

        const headers = Object.fromEntries(
          (msg.payload?.headers ?? []).map((h: any) => [h.name.toLowerCase(), h.value])
        );

        const subject = headers['subject'] ?? '';
        const from    = headers['from'] ?? '';
        const body    = extractText(msg.payload);
        const fields  = extractInvoiceFields(subject, body, from);

        // Only create candidate if we extracted at least a client name or invoice number
        if (!fields.client_name && !fields.invoice_number) continue;

        invoices.push({
          source_type: 'integration',
          source_system: 'gmail',
          source_record_id: msg.id,
          external_invoice_id: null,
          invoice_number: fields.invoice_number ?? null,
          client_name: fields.client_name ?? `Email from ${from}`,
          billing_contact_name: fields.client_name ?? null,
          billing_contact_email: from.match(/<([^>]+)>/)?.[1] ?? from,
          billing_contact_phone: null,
          issue_date: null,
          due_date: fields.due_date ?? null,
          currency: fields.currency ?? 'USD',
          total_amount: fields.amount ?? 0,
          amount_paid: 0,
          remaining_balance: fields.amount ?? 0,
          status_raw: 'sent',
          payment_terms: null,
          notes: `Extracted from email: ${subject}`,
          custom_attributes: {
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            email_subject: subject,
            email_from: from,
          },
          // Gmail extraction is low confidence — must go through review
          mapping_confidence: 'low',
        });
      } catch (err: any) {
        errors.push({ record_id: msgId, error: err.message });
      }
    }

    pageToken = listPage.nextPageToken;
    pagesFetched++;
  } while (pageToken && pagesFetched < MAX_PAGES);

  return {
    invoices,
    payments: [],
    clients: [],
    errors,
    cursor: pageToken ?? null,
  };
}

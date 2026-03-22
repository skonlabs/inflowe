// ═══════════════════════════════════════════════════════════════
// Normalization utilities for ingested data
// ═══════════════════════════════════════════════════════════════

// ── Date normalization ───────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

export function normalizeDate(value: string): { date: string | null; ambiguous: boolean; original: string } {
  const original = value;
  const trimmed = value.trim();
  if (!trimmed) return { date: null, ambiguous: false, original };

  // ISO format: 2024-01-15
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, ambiguous: false, original };
  }

  // Textual month: "15 Jan 2024" or "Jan 15, 2024"
  const textMatch = trimmed.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i)
    || trimmed.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (textMatch) {
    const parts = textMatch.slice(1);
    let day: number, month: number, year: number;
    if (/^[a-z]/i.test(parts[0])) {
      month = MONTH_MAP[parts[0].toLowerCase()] ?? -1;
      day = parseInt(parts[1]);
      year = parseInt(parts[2]);
    } else {
      day = parseInt(parts[0]);
      month = MONTH_MAP[parts[1].toLowerCase()] ?? -1;
      year = parseInt(parts[2]);
    }
    if (month >= 0 && day >= 1 && day <= 31 && year >= 1900) {
      return { date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, ambiguous: false, original };
    }
  }

  // US/EU ambiguous: MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (slashMatch) {
    let [, a, b, c] = slashMatch;
    let year = parseInt(c);
    if (year < 100) year += 2000;
    const numA = parseInt(a);
    const numB = parseInt(b);

    // If first > 12, it must be day (DD/MM/YYYY)
    if (numA > 12 && numB <= 12) {
      return { date: `${year}-${String(numB).padStart(2, '0')}-${String(numA).padStart(2, '0')}`, ambiguous: false, original };
    }
    // If second > 12, it must be day (MM/DD/YYYY)
    if (numB > 12 && numA <= 12) {
      return { date: `${year}-${String(numA).padStart(2, '0')}-${String(numB).padStart(2, '0')}`, ambiguous: false, original };
    }
    // Both <= 12 — ambiguous, assume MM/DD/YYYY (US)
    if (numA <= 12 && numB <= 12) {
      return { date: `${year}-${String(numA).padStart(2, '0')}-${String(numB).padStart(2, '0')}`, ambiguous: true, original };
    }
  }

  // Try native Date parse as last resort
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, ambiguous: true, original };
  }

  return { date: null, ambiguous: false, original };
}

// ── Numeric normalization ────────────────────────────────────

export function normalizeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A' || trimmed === 'n/a') return null;

  // Remove currency symbols and spaces
  let cleaned = trimmed.replace(/[$€£¥₹₱₩₫₺₴₸₼₾,\s]/g, '');

  // Handle parentheses for negatives: (1234) → -1234
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) cleaned = `-${parenMatch[1]}`;

  // Handle trailing minus
  if (cleaned.endsWith('-') && !cleaned.startsWith('-')) {
    cleaned = `-${cleaned.slice(0, -1)}`;
  }

  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

// ── Currency normalization ───────────────────────────────────

const CURRENCY_SYNONYMS: Record<string, string> = {
  $: 'USD', dollar: 'USD', dollars: 'USD', us: 'USD',
  '€': 'EUR', euro: 'EUR', euros: 'EUR',
  '£': 'GBP', pound: 'GBP', pounds: 'GBP', sterling: 'GBP',
  '¥': 'JPY', yen: 'JPY',
  '₹': 'INR', rupee: 'INR', rupees: 'INR',
  '₱': 'PHP', peso: 'PHP',
  aud: 'AUD', cad: 'CAD', chf: 'CHF', nzd: 'NZD', sgd: 'SGD',
  hkd: 'HKD', sek: 'SEK', nok: 'NOK', dkk: 'DKK', zar: 'ZAR',
  brl: 'BRL', mxn: 'MXN', krw: 'KRW',
};

export function normalizeCurrency(value: string, defaultCurrency = 'USD'): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return defaultCurrency;

  // Already a 3-letter code
  if (/^[a-z]{3}$/i.test(trimmed)) return trimmed.toUpperCase();

  return CURRENCY_SYNONYMS[trimmed] || defaultCurrency;
}

// ── Status normalization ─────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  open: 'sent', unpaid: 'sent', outstanding: 'sent', pending: 'sent',
  sent: 'sent', issued: 'sent', active: 'sent', new: 'sent',
  paid: 'paid', settled: 'paid', closed: 'paid', complete: 'paid', completed: 'paid',
  partial: 'partially_paid', 'partially paid': 'partially_paid', part: 'partially_paid',
  overdue: 'overdue', 'past due': 'overdue', late: 'overdue', delinquent: 'overdue',
  void: 'cancelled', voided: 'cancelled', cancelled: 'cancelled', canceled: 'cancelled',
  disputed: 'disputed', dispute: 'disputed',
  draft: 'sent',
  'on hold': 'on_hold', hold: 'on_hold', suspended: 'on_hold',
};

export function normalizeStatus(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return STATUS_MAP[trimmed] || null;
}

// ── Email normalization ──────────────────────────────────────

export function normalizeEmail(value: string): { email: string | null; valid: boolean } {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return { email: null, valid: false };
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return { email: trimmed, valid: emailRx.test(trimmed) };
}

// ── Phone normalization ──────────────────────────────────────

export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Strip non-digit except leading +
  const cleaned = trimmed.startsWith('+')
    ? '+' + trimmed.slice(1).replace(/\D/g, '')
    : trimmed.replace(/\D/g, '');
  return cleaned.length >= 7 ? cleaned : null;
}

// ── Full row normalization ───────────────────────────────────

import type { FieldMapping, NormalizedInvoiceCandidate } from './types';

export function normalizeRow(
  rawValues: Record<string, string>,
  mappings: FieldMapping[],
  defaultCurrency = 'USD'
): NormalizedInvoiceCandidate {
  const candidate: NormalizedInvoiceCandidate = {};
  const customAttrs: Record<string, string> = {};

  for (const mapping of mappings) {
    const raw = rawValues[mapping.sourceColumn] ?? '';
    const field = mapping.canonicalField;

    switch (field) {
      case 'invoice_number':
      case 'external_invoice_id':
      case 'client_name':
      case 'client_legal_name':
      case 'billing_contact_name':
      case 'payment_terms':
      case 'notes':
        (candidate as any)[field] = raw.trim() || undefined;
        break;
      case 'billing_contact_email': {
        const { email } = normalizeEmail(raw);
        candidate.billing_contact_email = email || undefined;
        break;
      }
      case 'billing_contact_phone':
        candidate.billing_contact_phone = normalizePhone(raw) || undefined;
        break;
      case 'issue_date':
      case 'due_date': {
        const { date } = normalizeDate(raw);
        (candidate as any)[field] = date || undefined;
        break;
      }
      case 'currency':
        candidate.currency = normalizeCurrency(raw, defaultCurrency);
        break;
      case 'subtotal_amount':
      case 'tax_amount':
      case 'total_amount':
      case 'amount_paid':
      case 'remaining_balance': {
        const num = normalizeNumber(raw);
        if (num !== null) (candidate as any)[field] = num;
        break;
      }
      case 'status': {
        const normalized = normalizeStatus(raw);
        if (normalized) candidate.status = normalized;
        break;
      }
      default:
        if (raw.trim()) customAttrs[field] = raw.trim();
    }
  }

  if (!candidate.currency) candidate.currency = defaultCurrency;

  // Derive remaining_balance if not provided
  if (candidate.remaining_balance === undefined && candidate.total_amount !== undefined) {
    candidate.remaining_balance = candidate.total_amount - (candidate.amount_paid ?? 0);
  }

  if (Object.keys(customAttrs).length > 0) {
    candidate.custom_attributes = customAttrs;
  }

  return candidate;
}

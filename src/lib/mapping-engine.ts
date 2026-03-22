/**
 * Field Mapping Inference Engine
 *
 * Infers how customer CSV/spreadsheet columns map to InFlowe's canonical fields
 * using synonym dictionaries, type inference from sample values, and confidence scoring.
 *
 * Architecture:
 *  1. Normalize column header (lower-case, trim, strip punctuation)
 *  2. Exact match against synonym sets  → high confidence
 *  3. Fuzzy/token match                → medium confidence
 *  4. Type inference from sample values → medium/low confidence
 *  5. No match                          → null suggestion
 */

// ─── Canonical field definitions ─────────────────────────────────────────────

export const CANONICAL_FIELDS = [
  'invoice_number',
  'client_name',
  'contact_name',
  'contact_email',
  'contact_phone',
  'issue_date',
  'due_date',
  'amount',
  'amount_paid',
  'remaining_balance',
  'currency',
  'status',
  'payment_terms',
  'notes',
  'ignore',
] as const;

export type CanonicalField = typeof CANONICAL_FIELDS[number];

export interface CanonicalFieldMeta {
  label: string;
  description: string;
  isCritical: boolean;
  type: 'text' | 'amount' | 'date' | 'email' | 'phone' | 'currency' | 'status' | 'ignore';
  required: boolean;
}

export const FIELD_META: Record<CanonicalField, CanonicalFieldMeta> = {
  invoice_number:    { label: 'Invoice Number',    description: 'Unique invoice identifier (e.g. INV-001)', isCritical: true,  type: 'text',     required: false },
  client_name:       { label: 'Client Name',        description: 'Name of the client or company',          isCritical: true,  type: 'text',     required: true  },
  contact_name:      { label: 'Contact Name',        description: 'Billing contact person\'s name',         isCritical: false, type: 'text',     required: false },
  contact_email:     { label: 'Contact Email',       description: 'Billing contact email address',          isCritical: true,  type: 'email',    required: false },
  contact_phone:     { label: 'Contact Phone',       description: 'Contact phone number',                   isCritical: false, type: 'phone',    required: false },
  issue_date:        { label: 'Issue Date',          description: 'Date the invoice was issued',            isCritical: false, type: 'date',     required: false },
  due_date:          { label: 'Due Date',            description: 'Payment due date',                       isCritical: true,  type: 'date',     required: true  },
  amount:            { label: 'Amount',              description: 'Total invoice amount',                    isCritical: true,  type: 'amount',   required: true  },
  amount_paid:       { label: 'Amount Paid',         description: 'How much has already been paid',         isCritical: false, type: 'amount',   required: false },
  remaining_balance: { label: 'Remaining Balance',   description: 'Outstanding balance due',                isCritical: true,  type: 'amount',   required: false },
  currency:          { label: 'Currency',            description: 'Currency code (e.g. USD, GBP)',          isCritical: false, type: 'currency', required: false },
  status:            { label: 'Invoice Status',      description: 'Current status (paid, unpaid, etc.)',    isCritical: false, type: 'status',   required: false },
  payment_terms:     { label: 'Payment Terms',       description: 'Terms (e.g. Net 30)',                    isCritical: false, type: 'text',     required: false },
  notes:             { label: 'Notes',               description: 'Additional notes or memo',               isCritical: false, type: 'text',     required: false },
  ignore:            { label: 'Ignore this column',  description: 'Skip this column',                       isCritical: false, type: 'ignore',   required: false },
};

// ─── Synonym dictionary ──────────────────────────────────────────────────────

const SYNONYMS: Record<CanonicalField, string[]> = {
  invoice_number: [
    'invoice_number', 'invoice number', 'inv number', 'inv no', 'inv_no', 'inv#',
    'invoice#', 'invoice no', 'bill no', 'bill number', 'bill_number', 'invoice id',
    'invoice_id', 'inv_id', 'inv_num', 'reference', 'ref', 'ref no', 'doc number',
    'document number', 'po number', 'po#',
  ],
  client_name: [
    'client_name', 'client name', 'client', 'customer', 'customer name',
    'customer_name', 'company', 'company name', 'account', 'account name',
    'party', 'debtor', 'debtor name', 'buyer', 'payer',
  ],
  contact_name: [
    'contact_name', 'contact name', 'contact', 'billing contact', 'billing_contact',
    'contact person', 'attn', 'attention', 'person', 'name', 'recipient',
  ],
  contact_email: [
    'contact_email', 'contact email', 'email', 'email address', 'e-mail',
    'billing email', 'billing_email', 'email_address', 'mail',
  ],
  contact_phone: [
    'contact_phone', 'contact phone', 'phone', 'phone number', 'telephone',
    'mobile', 'cell', 'cell number', 'tel', 'fax',
  ],
  issue_date: [
    'issue_date', 'issue date', 'invoice date', 'invoice_date', 'bill date',
    'bill_date', 'date issued', 'date_issued', 'created date', 'created_date',
    'date', 'invoiced date', 'invoiced_date', 'transaction date',
  ],
  due_date: [
    'due_date', 'due date', 'payment due', 'payment_due', 'payable by',
    'payable_by', 'due', 'expiry date', 'expiry_date', 'payment date',
    'payment_date', 'deadline', 'maturity date',
  ],
  amount: [
    'amount', 'total', 'total amount', 'total_amount', 'invoice amount',
    'invoice_amount', 'invoice total', 'gross', 'grand total', 'grand_total',
    'net', 'net amount', 'net_amount', 'value', 'price', 'charge', 'fee',
    'subtotal', 'sub total',
  ],
  amount_paid: [
    'amount_paid', 'amount paid', 'paid', 'paid amount', 'payment received',
    'payments', 'receipt', 'receipts', 'paid_amount', 'payment_received',
  ],
  remaining_balance: [
    'remaining_balance', 'remaining balance', 'balance', 'balance due',
    'balance_due', 'amount due', 'amount_due', 'outstanding', 'unpaid',
    'open balance', 'open_balance', 'outstanding balance', 'owing',
  ],
  currency: [
    'currency', 'curr', 'currency code', 'currency_code', 'ccy', 'fx',
  ],
  status: [
    'status', 'invoice status', 'invoice_status', 'payment status',
    'payment_status', 'state', 'condition',
  ],
  payment_terms: [
    'payment_terms', 'payment terms', 'terms', 'net terms', 'net_terms',
    'credit terms', 'credit_terms',
  ],
  notes: [
    'notes', 'note', 'description', 'desc', 'memo', 'comments', 'comment',
    'remarks', 'remark', 'details', 'info', 'message',
  ],
  ignore: [],
};

// Pre-build reverse lookup: normalized synonym → canonical field
const SYNONYM_LOOKUP = new Map<string, CanonicalField>();
for (const [field, synonyms] of Object.entries(SYNONYMS) as [CanonicalField, string[]][]) {
  for (const syn of synonyms) {
    SYNONYM_LOOKUP.set(normalizeHeader(syn), field);
  }
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[_\-\s.#/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Type patterns for inference ─────────────────────────────────────────────

const PATTERNS = {
  date:      /^\d{1,4}[-/]\d{1,2}[-/]\d{2,4}$/,
  isoDate:   /^\d{4}-\d{2}-\d{2}$/,
  amount:    /^[£$€]?\s*\d[\d,]*(\.\d{1,2})?$/,
  currency:  /^(USD|GBP|EUR|CAD|AUD|CHF|JPY|NZD|SGD|HKD|SEK|NOK|DKK|INR)$/i,
  email:     /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone:     /^[\d\s\-+().]{7,20}$/,
  invoiceId: /^(inv|bill|ref|doc|po|order)[-_#]?\s*\d+/i,
  status:    /^(paid|unpaid|open|outstanding|overdue|partial|void|cancelled|canceled|draft|sent)$/i,
};

function inferTypeFromSamples(samples: string[]): CanonicalField | null {
  const nonEmpty = samples.filter(s => s && s.trim().length > 0);
  if (nonEmpty.length === 0) return null;

  const counts: Partial<Record<CanonicalField, number>> = {};
  const test = (pat: RegExp, field: CanonicalField) => {
    const n = nonEmpty.filter(s => pat.test(s.trim())).length;
    if (n > 0) counts[field] = (counts[field] ?? 0) + n;
  };

  test(PATTERNS.email,     'contact_email');
  test(PATTERNS.isoDate,   'issue_date');
  test(PATTERNS.date,      'due_date');
  test(PATTERNS.amount,    'amount');
  test(PATTERNS.currency,  'currency');
  test(PATTERNS.status,    'status');
  test(PATTERNS.invoiceId, 'invoice_number');

  // Phone: length check + digit-dominant
  const phoneLike = nonEmpty.filter(s => PATTERNS.phone.test(s.trim()) && /\d{7,}/.test(s.replace(/\D/g, ''))).length;
  if (phoneLike > 0) counts['contact_phone'] = (counts['contact_phone'] ?? 0) + phoneLike;

  if (Object.keys(counts).length === 0) return null;

  // Pick the field with the highest match count (majority rule)
  const best = (Object.entries(counts) as [CanonicalField, number][])
    .sort((a, b) => b[1] - a[1])[0];

  const ratio = best[1] / nonEmpty.length;
  return ratio >= 0.5 ? best[0] : null;
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

export type Confidence = 'high' | 'medium' | 'low';

// ─── Main export types ────────────────────────────────────────────────────────

export interface MappingProposal {
  sourceColumn: string;
  sampleValues: string[];
  suggestedField: CanonicalField | null;
  confidence: Confidence;
  isCritical: boolean;
  validationHint?: string;
  matchReason: 'exact' | 'synonym' | 'fuzzy' | 'type_inference' | 'none';
}

export interface ConfirmedMapping {
  /** canonical_field → source_column_name (null = ignore) */
  fieldToColumn: Record<string, string>;
  dateFormatHint: string | null;
  defaultCurrency: string;
  ignoredColumns: string[];
}

export interface MappingTemplate {
  id: string;
  templateName: string;
  headerSignature: string;
  columnMappings: Array<{ sourceCol: string; canonicalField: string }>;
  dateFormatHint: string | null;
  defaultCurrency: string | null;
  ignoredColumns: string[];
  timesUsed: number;
  lastUsedAt: string | null;
}

// ─── Core inference function ──────────────────────────────────────────────────

/**
 * Given CSV headers and a few sample rows, return mapping proposals for each column.
 *
 * @param headers   Array of raw column names from the CSV
 * @param sampleRows First few data rows (max 10 used for inference)
 * @param savedTemplate Optional previously-saved mapping template
 */
export function inferMapping(
  headers: string[],
  sampleRows: Record<string, string>[],
  savedTemplate?: MappingTemplate | null,
): MappingProposal[] {
  const usedFields = new Set<CanonicalField>();
  const rows = sampleRows.slice(0, 10);

  return headers.map((col): MappingProposal => {
    const normalized = normalizeHeader(col);
    const samples = rows.map(r => (r[col] ?? '').trim()).filter(Boolean);

    // 1. Check if saved template has a mapping for this column
    if (savedTemplate) {
      const templateMatch = savedTemplate.columnMappings.find(
        m => normalizeHeader(m.sourceCol) === normalized,
      );
      if (templateMatch && templateMatch.canonicalField !== 'ignore') {
        const field = templateMatch.canonicalField as CanonicalField;
        if (!usedFields.has(field)) {
          usedFields.add(field);
          return {
            sourceColumn: col,
            sampleValues: samples,
            suggestedField: field,
            confidence: 'high',
            isCritical: FIELD_META[field]?.isCritical ?? false,
            matchReason: 'exact',
          };
        }
      }
      if (templateMatch?.canonicalField === 'ignore') {
        return {
          sourceColumn: col,
          sampleValues: samples,
          suggestedField: 'ignore',
          confidence: 'high',
          isCritical: false,
          matchReason: 'exact',
        };
      }
    }

    // 2. Exact synonym match
    const synonymMatch = SYNONYM_LOOKUP.get(normalized);
    if (synonymMatch && !usedFields.has(synonymMatch)) {
      usedFields.add(synonymMatch);
      return {
        sourceColumn: col,
        sampleValues: samples,
        suggestedField: synonymMatch,
        confidence: 'high',
        isCritical: FIELD_META[synonymMatch]?.isCritical ?? false,
        matchReason: 'exact',
        validationHint: getValidationHint(synonymMatch, samples),
      };
    }

    // 3. Fuzzy match: try removing common prefixes/suffixes and re-matching
    const tokens = normalized.split(' ');
    for (let len = tokens.length; len >= 1; len--) {
      const sub = tokens.slice(0, len).join(' ');
      const fuzzy = SYNONYM_LOOKUP.get(sub);
      if (fuzzy && !usedFields.has(fuzzy)) {
        usedFields.add(fuzzy);
        return {
          sourceColumn: col,
          sampleValues: samples,
          suggestedField: fuzzy,
          confidence: 'medium',
          isCritical: FIELD_META[fuzzy]?.isCritical ?? false,
          matchReason: 'fuzzy',
          validationHint: getValidationHint(fuzzy, samples),
        };
      }
    }

    // 4. Type inference from sample values
    const typeGuess = inferTypeFromSamples(samples);
    if (typeGuess && !usedFields.has(typeGuess)) {
      usedFields.add(typeGuess);
      return {
        sourceColumn: col,
        sampleValues: samples,
        suggestedField: typeGuess,
        confidence: 'medium',
        isCritical: FIELD_META[typeGuess]?.isCritical ?? false,
        matchReason: 'type_inference',
        validationHint: getValidationHint(typeGuess, samples),
      };
    }

    // 5. No match
    return {
      sourceColumn: col,
      sampleValues: samples,
      suggestedField: null,
      confidence: 'low',
      isCritical: false,
      matchReason: 'none',
    };
  });
}

function getValidationHint(field: CanonicalField, samples: string[]): string | undefined {
  if (field === 'due_date' || field === 'issue_date') {
    const hasSlash = samples.some(s => s.includes('/'));
    const hasDash  = samples.some(s => /\d{4}-\d/.test(s));
    if (hasSlash) return 'Detected slash-separated dates. Check MM/DD vs DD/MM order.';
    if (hasDash)  return 'ISO format (YYYY-MM-DD) detected.';
  }
  if (field === 'amount' || field === 'remaining_balance') {
    if (samples.some(s => /[$£€]/.test(s))) return 'Currency symbols will be stripped automatically.';
    if (samples.some(s => /,\d{3}/.test(s))) return 'Thousands separators will be removed.';
  }
  if (field === 'contact_email') {
    const invalid = samples.filter(s => s.length > 0 && !PATTERNS.email.test(s));
    if (invalid.length > 0) return `Some values don't look like valid emails: ${invalid[0]}`;
  }
  return undefined;
}

// ─── Date format detection ────────────────────────────────────────────────────

export function detectDateFormat(samples: string[]): string | null {
  const nonEmpty = samples.filter(Boolean);
  if (nonEmpty.length === 0) return null;

  // YYYY-MM-DD
  if (nonEmpty.every(s => PATTERNS.isoDate.test(s.trim()))) return 'YYYY-MM-DD';

  // MM/DD/YYYY vs DD/MM/YYYY — heuristic: if any day > 12, the other must be month
  const slashDates = nonEmpty.filter(s => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim()));
  if (slashDates.length > 0) {
    const firstParts = slashDates.map(s => parseInt(s.split('/')[0]));
    const secondParts = slashDates.map(s => parseInt(s.split('/')[1]));
    if (firstParts.some(d => d > 12)) return 'DD/MM/YYYY';
    if (secondParts.some(d => d > 12)) return 'MM/DD/YYYY';
    return 'MM/DD/YYYY'; // default US
  }

  return null;
}

// ─── Normalization utilities ──────────────────────────────────────────────────

/** Normalize a raw cell value for a given canonical field */
export function normalizeValue(raw: string, field: CanonicalField): string {
  if (!raw || !raw.trim()) return '';
  const v = raw.trim();

  switch (field) {
    case 'contact_email':
      return v.toLowerCase();

    case 'amount':
    case 'amount_paid':
    case 'remaining_balance':
      // Strip currency symbols and thousands separators
      return v.replace(/[£$€,\s]/g, '').replace(/[^\d.\-]/g, '');

    case 'currency':
      // Map common symbols to ISO codes
      const curMap: Record<string, string> = {
        '$': 'USD', '£': 'GBP', '€': 'EUR', 'A$': 'AUD', 'C$': 'CAD',
      };
      return (curMap[v] ?? v).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

    case 'status':
      return normalizeStatus(v);

    case 'contact_phone':
      // Keep digits, +, spaces, dashes, parens
      return v.replace(/[^\d+\s\-().]/g, '').trim();

    default:
      return v;
  }
}

/** Map source status strings to canonical InFlowe status values */
export function normalizeStatus(raw: string): string {
  const v = raw.toLowerCase().trim();
  const statusMap: Record<string, string> = {
    // → pending / sent
    'open': 'sent', 'unpaid': 'sent', 'outstanding': 'sent',
    'new': 'sent', 'issued': 'sent', 'sent': 'sent', 'draft': 'draft',
    // → paid
    'paid': 'paid', 'settled': 'paid', 'closed': 'paid',
    'complete': 'paid', 'completed': 'paid', 'cleared': 'paid',
    // → partially paid
    'partial': 'partially_paid', 'partially paid': 'partially_paid',
    'part paid': 'partially_paid', 'partial payment': 'partially_paid',
    // → cancelled
    'void': 'cancelled', 'voided': 'cancelled',
    'canceled': 'cancelled', 'cancelled': 'cancelled',
    'written off': 'cancelled', 'written_off': 'cancelled',
    // → overdue (let the system determine from due_date, but mark intent)
    'overdue': 'overdue', 'late': 'overdue', 'past due': 'overdue',
  };
  return statusMap[v] ?? v;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationMessage {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
}

export interface RecordValidationResult {
  status: 'valid' | 'warning' | 'invalid';
  messages: ValidationMessage[];
}

/** Validate a normalized record against business rules */
export function validateMappedRecord(
  record: Partial<Record<CanonicalField, string>>,
): RecordValidationResult {
  const msgs: ValidationMessage[] = [];

  // Required fields
  if (!record.client_name?.trim()) {
    msgs.push({ severity: 'error', field: 'client_name', message: 'Client name is required' });
  }
  const amountStr = record.amount ?? record.remaining_balance ?? '';
  const amount = parseFloat(amountStr.replace(/[^\d.\-]/g, ''));
  if (!amountStr || isNaN(amount) || amount <= 0) {
    msgs.push({ severity: 'error', field: 'amount', message: 'Amount must be a positive number' });
  }
  if (!record.due_date?.trim()) {
    msgs.push({ severity: 'error', field: 'due_date', message: 'Due date is required' });
  }

  // Cross-field checks
  if (record.due_date && record.issue_date) {
    const due   = new Date(record.due_date);
    const issue = new Date(record.issue_date);
    if (due < issue) {
      msgs.push({ severity: 'warning', field: 'due_date', message: 'Due date is before issue date' });
    }
  }

  if (record.remaining_balance && record.amount) {
    const rem   = parseFloat(record.remaining_balance);
    const total = parseFloat(record.amount);
    if (!isNaN(rem) && !isNaN(total) && rem > total * 1.01) {
      msgs.push({ severity: 'warning', field: 'remaining_balance', message: 'Remaining balance exceeds total amount' });
    }
  }

  if (record.contact_email?.trim()) {
    if (!PATTERNS.email.test(record.contact_email.trim())) {
      msgs.push({ severity: 'warning', field: 'contact_email', message: 'Email address appears invalid' });
    }
  }

  const hasError = msgs.some(m => m.severity === 'error');
  const hasWarn  = msgs.some(m => m.severity === 'warning');
  return {
    status: hasError ? 'invalid' : hasWarn ? 'warning' : 'valid',
    messages: msgs,
  };
}

// ─── Template fingerprint ─────────────────────────────────────────────────────

/** Build a stable fingerprint for a set of column headers (for template matching) */
export function buildHeaderSignature(headers: string[]): string {
  return [...headers]
    .map(h => normalizeHeader(h))
    .sort()
    .join('|');
}

/** Check if a set of headers is a close-enough match for a saved template */
export function matchesTemplate(
  headers: string[],
  template: MappingTemplate,
  threshold = 0.75,
): boolean {
  const incoming = new Set(headers.map(h => normalizeHeader(h)));
  const saved    = template.headerSignature.split('|').filter(Boolean);
  if (saved.length === 0) return false;

  const matches = saved.filter(h => incoming.has(h)).length;
  const coverage = matches / Math.max(saved.length, incoming.size);
  return coverage >= threshold;
}

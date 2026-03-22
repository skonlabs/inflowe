/**
 * Field Mapping Inference Engine
 *
 * Infers how customer CSV/spreadsheet columns map to InFlowe's canonical fields
 * using synonym dictionaries, type inference from sample values, and confidence scoring.
 *
 * Supports both invoice and client import types.
 */

// ─── Import type ─────────────────────────────────────────────────────────────

export type ImportType = 'invoice' | 'client';

// ─── Canonical field definitions ─────────────────────────────────────────────

export const INVOICE_CANONICAL_FIELDS = [
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

export const CLIENT_CANONICAL_FIELDS = [
  'client_name',
  'legal_name',
  'contact_name',
  'contact_email',
  'contact_phone',
  'address',
  'currency',
  'preferred_channel',
  'payment_terms',
  'sensitivity_level',
  'tags',
  'notes',
  'ignore',
] as const;

export type InvoiceCanonicalField = typeof INVOICE_CANONICAL_FIELDS[number];
export type ClientCanonicalField = typeof CLIENT_CANONICAL_FIELDS[number];
export type CanonicalField = InvoiceCanonicalField | ClientCanonicalField;

// Keep backward compat
export const CANONICAL_FIELDS = INVOICE_CANONICAL_FIELDS;

export function getCanonicalFields(importType: ImportType): readonly CanonicalField[] {
  return importType === 'client' ? CLIENT_CANONICAL_FIELDS : INVOICE_CANONICAL_FIELDS;
}

export interface CanonicalFieldMeta {
  label: string;
  description: string;
  isCritical: boolean;
  type: 'text' | 'amount' | 'date' | 'email' | 'phone' | 'currency' | 'status' | 'ignore' | 'select';
  required: boolean;
}

export const INVOICE_FIELD_META: Record<InvoiceCanonicalField, CanonicalFieldMeta> = {
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

export const CLIENT_FIELD_META: Record<ClientCanonicalField, CanonicalFieldMeta> = {
  client_name:       { label: 'Client Name',          description: 'Display name of the client or company',   isCritical: true,  type: 'text',     required: true  },
  legal_name:        { label: 'Legal Name',            description: 'Registered legal/business name',          isCritical: false, type: 'text',     required: false },
  contact_name:      { label: 'Contact Name',          description: 'Primary contact person\'s name',          isCritical: false, type: 'text',     required: false },
  contact_email:     { label: 'Contact Email',         description: 'Primary contact email address',           isCritical: true,  type: 'email',    required: false },
  contact_phone:     { label: 'Contact Phone',         description: 'Primary contact phone number',            isCritical: false, type: 'phone',    required: false },
  address:           { label: 'Address',               description: 'Business or billing address',              isCritical: false, type: 'text',     required: false },
  currency:          { label: 'Currency',              description: 'Default currency (e.g. USD, GBP)',         isCritical: false, type: 'currency', required: false },
  preferred_channel: { label: 'Preferred Channel',     description: 'Preferred contact channel (email, sms)',   isCritical: false, type: 'select',   required: false },
  payment_terms:     { label: 'Payment Terms',         description: 'Default payment terms (e.g. Net 30)',      isCritical: false, type: 'text',     required: false },
  sensitivity_level: { label: 'Sensitivity Level',     description: 'Client sensitivity (standard, high, vip)', isCritical: false, type: 'select',   required: false },
  tags:              { label: 'Tags',                  description: 'Comma-separated tags or categories',       isCritical: false, type: 'text',     required: false },
  notes:             { label: 'Notes',                 description: 'Additional notes about this client',       isCritical: false, type: 'text',     required: false },
  ignore:            { label: 'Ignore this column',    description: 'Skip this column',                         isCritical: false, type: 'ignore',   required: false },
};

// Backward compat
export const FIELD_META = INVOICE_FIELD_META as Record<CanonicalField, CanonicalFieldMeta>;

export function getFieldMeta(importType: ImportType): Record<string, CanonicalFieldMeta> {
  return importType === 'client' ? CLIENT_FIELD_META : INVOICE_FIELD_META;
}

// ─── Synonym dictionaries ────────────────────────────────────────────────────

const INVOICE_SYNONYMS: Record<string, string[]> = {
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
    'contact person', 'attn', 'attention', 'person', 'recipient',
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

const CLIENT_SYNONYMS: Record<string, string[]> = {
  client_name: [
    'client_name', 'client name', 'client', 'customer', 'customer name',
    'customer_name', 'company', 'company name', 'account', 'account name',
    'party', 'debtor', 'debtor name', 'business name', 'name', 'display name',
  ],
  legal_name: [
    'legal_name', 'legal name', 'registered name', 'business name', 'entity name',
    'official name', 'legal entity',
  ],
  contact_name: [
    'contact_name', 'contact name', 'contact', 'contact person', 'primary contact',
    'billing contact', 'attn', 'attention', 'person', 'recipient', 'first name',
  ],
  contact_email: [
    'contact_email', 'contact email', 'email', 'email address', 'e-mail',
    'billing email', 'billing_email', 'email_address', 'mail', 'primary email',
  ],
  contact_phone: [
    'contact_phone', 'contact phone', 'phone', 'phone number', 'telephone',
    'mobile', 'cell', 'cell number', 'tel', 'primary phone',
  ],
  address: [
    'address', 'street address', 'billing address', 'mailing address', 'location',
    'street', 'city', 'full address', 'postal address',
  ],
  currency: [
    'currency', 'default currency', 'curr', 'currency code', 'ccy',
  ],
  preferred_channel: [
    'preferred_channel', 'preferred channel', 'channel', 'contact method',
    'communication channel', 'contact preference',
  ],
  payment_terms: [
    'payment_terms', 'payment terms', 'terms', 'net terms', 'credit terms',
    'default terms', 'default payment terms',
  ],
  sensitivity_level: [
    'sensitivity_level', 'sensitivity', 'priority', 'tier', 'level', 'vip',
    'client tier', 'importance',
  ],
  tags: [
    'tags', 'tag', 'category', 'categories', 'group', 'segment', 'label', 'labels',
    'classification', 'type',
  ],
  notes: [
    'notes', 'note', 'description', 'comments', 'comment', 'remarks', 'memo',
    'details', 'info',
  ],
  ignore: [],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[_\-\s.#/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildSynonymLookup(synonyms: Record<string, string[]>): Map<string, CanonicalField> {
  const lookup = new Map<string, CanonicalField>();
  for (const [field, syns] of Object.entries(synonyms)) {
    for (const syn of syns) {
      lookup.set(normalizeHeader(syn), field as CanonicalField);
    }
  }
  return lookup;
}

const INVOICE_SYNONYM_LOOKUP = buildSynonymLookup(INVOICE_SYNONYMS);
const CLIENT_SYNONYM_LOOKUP = buildSynonymLookup(CLIENT_SYNONYMS);

function getSynonymLookup(importType: ImportType) {
  return importType === 'client' ? CLIENT_SYNONYM_LOOKUP : INVOICE_SYNONYM_LOOKUP;
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

function inferTypeFromSamples(samples: string[], importType: ImportType): CanonicalField | null {
  const nonEmpty = samples.filter(s => s && s.trim().length > 0);
  if (nonEmpty.length === 0) return null;

  const counts: Partial<Record<CanonicalField, number>> = {};
  const test = (pat: RegExp, field: CanonicalField) => {
    const n = nonEmpty.filter(s => pat.test(s.trim())).length;
    if (n > 0) counts[field] = (counts[field] ?? 0) + n;
  };

  test(PATTERNS.email, 'contact_email');

  if (importType === 'invoice') {
    test(PATTERNS.isoDate,   'issue_date');
    test(PATTERNS.date,      'due_date');
    test(PATTERNS.amount,    'amount');
    test(PATTERNS.currency,  'currency');
    test(PATTERNS.status,    'status');
    test(PATTERNS.invoiceId, 'invoice_number');
  } else {
    test(PATTERNS.currency, 'currency');
  }

  const phoneLike = nonEmpty.filter(s => PATTERNS.phone.test(s.trim()) && /\d{7,}/.test(s.replace(/\D/g, ''))).length;
  if (phoneLike > 0) counts['contact_phone'] = (counts['contact_phone'] ?? 0) + phoneLike;

  if (Object.keys(counts).length === 0) return null;

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

export function inferMapping(
  headers: string[],
  sampleRows: Record<string, string>[],
  savedTemplate?: MappingTemplate | null,
  importType: ImportType = 'invoice',
): MappingProposal[] {
  const usedFields = new Set<CanonicalField>();
  const rows = sampleRows.slice(0, 10);
  const synonymLookup = getSynonymLookup(importType);
  const fieldMeta = getFieldMeta(importType);

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
            isCritical: fieldMeta[field]?.isCritical ?? false,
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
    const synonymMatch = synonymLookup.get(normalized);
    if (synonymMatch && !usedFields.has(synonymMatch)) {
      usedFields.add(synonymMatch);
      return {
        sourceColumn: col,
        sampleValues: samples,
        suggestedField: synonymMatch,
        confidence: 'high',
        isCritical: fieldMeta[synonymMatch]?.isCritical ?? false,
        matchReason: 'exact',
        validationHint: getValidationHint(synonymMatch, samples, importType),
      };
    }

    // 3. Fuzzy match
    const tokens = normalized.split(' ');
    for (let len = tokens.length; len >= 1; len--) {
      const sub = tokens.slice(0, len).join(' ');
      const fuzzy = synonymLookup.get(sub);
      if (fuzzy && !usedFields.has(fuzzy)) {
        usedFields.add(fuzzy);
        return {
          sourceColumn: col,
          sampleValues: samples,
          suggestedField: fuzzy,
          confidence: 'medium',
          isCritical: fieldMeta[fuzzy]?.isCritical ?? false,
          matchReason: 'fuzzy',
          validationHint: getValidationHint(fuzzy, samples, importType),
        };
      }
    }

    // 4. Type inference from sample values
    const typeGuess = inferTypeFromSamples(samples, importType);
    if (typeGuess && !usedFields.has(typeGuess)) {
      usedFields.add(typeGuess);
      return {
        sourceColumn: col,
        sampleValues: samples,
        suggestedField: typeGuess,
        confidence: 'medium',
        isCritical: fieldMeta[typeGuess]?.isCritical ?? false,
        matchReason: 'type_inference',
        validationHint: getValidationHint(typeGuess, samples, importType),
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

function getValidationHint(field: CanonicalField, samples: string[], _importType: ImportType = 'invoice'): string | undefined {
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
  if (field === 'tags') {
    if (samples.some(s => s.includes(','))) return 'Comma-separated values will be split into individual tags.';
  }
  return undefined;
}

// ─── Date format detection ────────────────────────────────────────────────────

export function detectDateFormat(samples: string[]): string | null {
  const nonEmpty = samples.filter(Boolean);
  if (nonEmpty.length === 0) return null;

  if (nonEmpty.every(s => PATTERNS.isoDate.test(s.trim()))) return 'YYYY-MM-DD';

  const slashDates = nonEmpty.filter(s => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim()));
  if (slashDates.length > 0) {
    const firstParts = slashDates.map(s => parseInt(s.split('/')[0]));
    const secondParts = slashDates.map(s => parseInt(s.split('/')[1]));
    if (firstParts.some(d => d > 12)) return 'DD/MM/YYYY';
    if (secondParts.some(d => d > 12)) return 'MM/DD/YYYY';
    return 'MM/DD/YYYY';
  }

  return null;
}

// ─── Normalization utilities ──────────────────────────────────────────────────

export function normalizeValue(raw: string, field: CanonicalField): string {
  if (!raw || !raw.trim()) return '';
  const v = raw.trim();

  switch (field) {
    case 'contact_email':
      return v.toLowerCase();

    case 'amount':
    case 'amount_paid':
    case 'remaining_balance':
      return v.replace(/[£$€,\s]/g, '').replace(/[^\d.\-]/g, '');

    case 'currency': {
      const curMap: Record<string, string> = {
        '$': 'USD', '£': 'GBP', '€': 'EUR', 'A$': 'AUD', 'C$': 'CAD',
      };
      return (curMap[v] ?? v).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    }

    case 'status':
      return normalizeStatus(v);

    case 'contact_phone':
      return v.replace(/[^\d+\s\-().]/g, '').trim();

    case 'preferred_channel': {
      const ch = v.toLowerCase();
      if (ch.includes('sms') || ch.includes('text')) return 'sms';
      if (ch.includes('whatsapp') || ch.includes('wa')) return 'whatsapp';
      if (ch.includes('phone') || ch.includes('call')) return 'phone';
      return 'email';
    }

    case 'sensitivity_level': {
      const sl = v.toLowerCase();
      if (sl.includes('vip') || sl.includes('high')) return 'high';
      if (sl.includes('low')) return 'low';
      return 'standard';
    }

    default:
      return v;
  }
}

export function normalizeStatus(raw: string): string {
  const v = raw.toLowerCase().trim();
  const statusMap: Record<string, string> = {
    'open': 'sent', 'unpaid': 'sent', 'outstanding': 'sent',
    'new': 'sent', 'issued': 'sent', 'sent': 'sent', 'draft': 'draft',
    'paid': 'paid', 'settled': 'paid', 'closed': 'paid',
    'complete': 'paid', 'completed': 'paid', 'cleared': 'paid',
    'partial': 'partially_paid', 'partially paid': 'partially_paid',
    'part paid': 'partially_paid', 'partial payment': 'partially_paid',
    'void': 'cancelled', 'voided': 'cancelled',
    'canceled': 'cancelled', 'cancelled': 'cancelled',
    'written off': 'cancelled', 'written_off': 'cancelled',
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

export function validateMappedRecord(
  record: Partial<Record<CanonicalField, string>>,
  importType: ImportType = 'invoice',
): RecordValidationResult {
  const msgs: ValidationMessage[] = [];

  if (importType === 'client') {
    if (!record.client_name?.trim()) {
      msgs.push({ severity: 'error', field: 'client_name', message: 'Client name is required' });
    }
    if (record.contact_email?.trim() && !PATTERNS.email.test(record.contact_email.trim())) {
      msgs.push({ severity: 'warning', field: 'contact_email', message: 'Email address appears invalid' });
    }
    const hasError = msgs.some(m => m.severity === 'error');
    return { status: hasError ? 'invalid' : msgs.length > 0 ? 'warning' : 'valid', messages: msgs };
  }

  // Invoice validation
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

export function buildHeaderSignature(headers: string[]): string {
  return [...headers]
    .map(h => normalizeHeader(h))
    .sort()
    .join('|');
}

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

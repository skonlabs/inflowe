// ═══════════════════════════════════════════════════════════════
// Field Mapping Engine — confidence-aware column inference
// ═══════════════════════════════════════════════════════════════

import type { FieldMapping, MappingResult, ConfidenceLevel, SavedMappingTemplate } from './types';
import { CANONICAL_INVOICE_FIELDS } from './types';

// ── Synonym dictionaries ─────────────────────────────────────

const SYNONYMS: Record<string, string[]> = {
  invoice_number: ['invoice no', 'inv no', 'inv #', 'invoice #', 'invoice_no', 'invoicenumber', 'invoice number', 'bill no', 'bill number', 'bill #', 'invoice id', 'inv num', 'inv_num', 'inv_no', 'invoice_number', 'invoice_id', 'ref', 'reference', 'doc number', 'document number'],
  external_invoice_id: ['external id', 'ext id', 'source id', 'external_id', 'ext_id', 'record id'],
  client_name: ['customer', 'client', 'account', 'company', 'party', 'customer name', 'client name', 'account name', 'company name', 'debtor', 'buyer', 'bill to', 'billed to', 'client_name', 'customer_name'],
  client_legal_name: ['legal name', 'legal_name', 'registered name', 'business name'],
  billing_contact_name: ['contact', 'contact name', 'contact_name', 'attn', 'attention', 'billing contact', 'person', 'name'],
  billing_contact_email: ['email', 'e-mail', 'email address', 'contact email', 'billing email', 'email_address', 'contact_email', 'mail'],
  billing_contact_phone: ['phone', 'telephone', 'tel', 'phone number', 'mobile', 'cell', 'contact phone', 'phone_number'],
  issue_date: ['invoice date', 'bill date', 'issue date', 'issued', 'date issued', 'created', 'date created', 'invoice_date', 'bill_date', 'issue_date', 'issued_date', 'created_date', 'date'],
  due_date: ['due date', 'due', 'payment due', 'payable by', 'due_date', 'payment_due', 'pay by', 'deadline', 'due by', 'maturity date', 'maturity'],
  payment_terms: ['terms', 'payment terms', 'payment_terms', 'net days', 'credit terms'],
  currency: ['currency', 'ccy', 'cur', 'currency code', 'currency_code'],
  subtotal_amount: ['subtotal', 'sub total', 'sub_total', 'net amount', 'net_amount', 'before tax'],
  tax_amount: ['tax', 'vat', 'gst', 'tax amount', 'tax_amount', 'sales tax', 'vat amount'],
  total_amount: ['total', 'amount', 'gross', 'grand total', 'invoice total', 'total amount', 'total_amount', 'invoice_amount', 'invoice amount', 'gross total', 'gross amount', 'sum', 'value'],
  amount_paid: ['paid', 'amount paid', 'paid amount', 'amount_paid', 'payments', 'received', 'total paid'],
  remaining_balance: ['balance', 'balance due', 'outstanding', 'amount due', 'remaining', 'remaining_balance', 'amount_due', 'balance_due', 'owed', 'unpaid'],
  status: ['status', 'state', 'invoice status', 'payment status', 'invoice_status', 'payment_status', 'condition'],
  notes: ['notes', 'memo', 'description', 'comments', 'remark', 'remarks', 'note'],
};

// ── Type inference from values ───────────────────────────────

function looksLikeDate(values: string[]): boolean {
  const datePatterns = [
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/,
    /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i,
  ];
  const nonEmpty = values.filter(v => v.trim());
  if (nonEmpty.length === 0) return false;
  const matches = nonEmpty.filter(v => datePatterns.some(p => p.test(v.trim())));
  return matches.length / nonEmpty.length >= 0.6;
}

function looksLikeNumber(values: string[]): boolean {
  const nonEmpty = values.filter(v => v.trim());
  if (nonEmpty.length === 0) return false;
  const matches = nonEmpty.filter(v => {
    const cleaned = v.replace(/[$€£¥₹,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
    return !isNaN(Number(cleaned)) && cleaned !== '';
  });
  return matches.length / nonEmpty.length >= 0.7;
}

function looksLikeEmail(values: string[]): boolean {
  const nonEmpty = values.filter(v => v.trim());
  if (nonEmpty.length === 0) return false;
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const matches = nonEmpty.filter(v => emailRx.test(v.trim()));
  return matches.length / nonEmpty.length >= 0.5;
}

function looksLikePhone(values: string[]): boolean {
  const nonEmpty = values.filter(v => v.trim());
  if (nonEmpty.length === 0) return false;
  const phoneRx = /^[\d\s()+\-\.]{7,20}$/;
  const matches = nonEmpty.filter(v => phoneRx.test(v.trim()));
  return matches.length / nonEmpty.length >= 0.5;
}

function looksLikeInvoiceId(values: string[]): boolean {
  const nonEmpty = values.filter(v => v.trim());
  if (nonEmpty.length === 0) return false;
  const invRx = /^(INV|inv|BILL|bill|SI|PI|CR|DN)[-_#\s]?\d/i;
  const matches = nonEmpty.filter(v => invRx.test(v.trim()));
  return matches.length / nonEmpty.length >= 0.3;
}

function looksLikeCurrency(values: string[]): boolean {
  const nonEmpty = values.filter(v => v.trim());
  if (nonEmpty.length === 0) return false;
  const curRx = /^[A-Z]{3}$/;
  const matches = nonEmpty.filter(v => curRx.test(v.trim().toUpperCase()));
  return matches.length / nonEmpty.length >= 0.5;
}

function looksLikeStatus(values: string[]): boolean {
  const statusWords = new Set(['paid', 'unpaid', 'overdue', 'pending', 'open', 'closed', 'settled', 'partial', 'void', 'cancelled', 'canceled', 'draft', 'sent', 'outstanding', 'due']);
  const nonEmpty = values.filter(v => v.trim());
  if (nonEmpty.length === 0) return false;
  const matches = nonEmpty.filter(v => statusWords.has(v.trim().toLowerCase()));
  return matches.length / nonEmpty.length >= 0.3;
}

// ── Normalize header for matching ────────────────────────────

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[_\-#.]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Compute header signature ─────────────────────────────────

export function computeHeaderSignature(headers: string[]): string {
  return headers.map(h => normalizeHeader(h)).sort().join('|');
}

// ── Main inference engine ────────────────────────────────────

export function inferMappings(
  headers: string[],
  sampleRows: Record<string, string>[],
  savedTemplate?: SavedMappingTemplate | null
): MappingResult {
  const mappings: FieldMapping[] = [];
  const usedCanonical = new Set<string>();
  const unmappedColumns: string[] = [];

  // If we have a saved template that matches, apply it first
  if (savedTemplate) {
    for (const field of savedTemplate.fields) {
      if (headers.includes(field.sourceColumn) && !usedCanonical.has(field.canonicalField)) {
        const samples = sampleRows.slice(0, 5).map(r => r[field.sourceColumn] || '');
        mappings.push({
          sourceColumn: field.sourceColumn,
          canonicalField: field.canonicalField,
          confidence: 'high',
          confidenceScore: 0.95,
          sampleValues: samples,
          isRequired: CANONICAL_INVOICE_FIELDS[field.canonicalField]?.required ?? false,
          transform: field.transform,
          defaultValue: field.defaultValue,
          inferenceReason: 'Saved mapping template',
        });
        usedCanonical.add(field.canonicalField);
      }
    }
  }

  // For remaining unmapped headers, infer mappings
  for (const header of headers) {
    if (mappings.some(m => m.sourceColumn === header)) continue;
    if (savedTemplate?.ignoredColumns?.includes(header)) continue;

    const normalized = normalizeHeader(header);
    const samples = sampleRows.slice(0, 5).map(r => r[header] || '');
    let bestMatch: { field: string; score: number; reason: string } | null = null;

    // 1. Exact/synonym matching
    for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
      if (usedCanonical.has(canonical)) continue;

      // Exact match on normalized header
      if (synonyms.includes(normalized)) {
        const score = 0.9;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { field: canonical, score, reason: `Header "${header}" matches known synonym` };
        }
      }

      // Fuzzy: header contains synonym or synonym contains header
      for (const syn of synonyms) {
        if (normalized.includes(syn) || syn.includes(normalized)) {
          const score = 0.75;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { field: canonical, score, reason: `Header "${header}" partially matches "${syn}"` };
          }
        }
      }
    }

    // 2. Type inference as secondary signal
    if (!bestMatch || bestMatch.score < 0.7) {
      if (looksLikeEmail(samples) && !usedCanonical.has('billing_contact_email')) {
        const score = 0.8;
        if (!bestMatch || score > bestMatch.score)
          bestMatch = { field: 'billing_contact_email', score, reason: 'Values look like email addresses' };
      } else if (looksLikeInvoiceId(samples) && !usedCanonical.has('invoice_number')) {
        const score = 0.75;
        if (!bestMatch || score > bestMatch.score)
          bestMatch = { field: 'invoice_number', score, reason: 'Values match invoice ID patterns' };
      } else if (looksLikeCurrency(samples) && !usedCanonical.has('currency')) {
        const score = 0.8;
        if (!bestMatch || score > bestMatch.score)
          bestMatch = { field: 'currency', score, reason: 'Values look like currency codes' };
      } else if (looksLikeStatus(samples) && !usedCanonical.has('status')) {
        const score = 0.7;
        if (!bestMatch || score > bestMatch.score)
          bestMatch = { field: 'status', score, reason: 'Values look like status labels' };
      } else if (looksLikePhone(samples) && !usedCanonical.has('billing_contact_phone')) {
        const score = 0.7;
        if (!bestMatch || score > bestMatch.score)
          bestMatch = { field: 'billing_contact_phone', score, reason: 'Values look like phone numbers' };
      } else if (looksLikeDate(samples)) {
        // Could be issue_date or due_date — check header for hint
        const isDue = /due|pay|deadline|matur/i.test(header);
        const field = isDue
          ? (usedCanonical.has('due_date') ? 'issue_date' : 'due_date')
          : (usedCanonical.has('issue_date') ? 'due_date' : 'issue_date');
        if (!usedCanonical.has(field)) {
          const score = 0.65;
          if (!bestMatch || score > bestMatch.score)
            bestMatch = { field, score, reason: 'Values look like dates' };
        }
      } else if (looksLikeNumber(samples)) {
        // Could be amount, paid, balance — check header
        const balanceHint = /balance|outstanding|owed|due|remaining|unpaid/i.test(header);
        const paidHint = /paid|received|payment/i.test(header);
        const taxHint = /tax|vat|gst/i.test(header);
        const subHint = /sub|net|before/i.test(header);

        let field = 'total_amount';
        if (balanceHint) field = 'remaining_balance';
        else if (paidHint) field = 'amount_paid';
        else if (taxHint) field = 'tax_amount';
        else if (subHint) field = 'subtotal_amount';

        if (!usedCanonical.has(field)) {
          const score = 0.55;
          if (!bestMatch || score > bestMatch.score)
            bestMatch = { field, score, reason: `Numeric values, header suggests ${field.replace(/_/g, ' ')}` };
        }
      }
    }

    if (bestMatch && !usedCanonical.has(bestMatch.field)) {
      const confidence: ConfidenceLevel = bestMatch.score >= 0.8 ? 'high' : bestMatch.score >= 0.6 ? 'medium' : 'low';
      mappings.push({
        sourceColumn: header,
        canonicalField: bestMatch.field,
        confidence,
        confidenceScore: bestMatch.score,
        sampleValues: samples,
        isRequired: CANONICAL_INVOICE_FIELDS[bestMatch.field]?.required ?? false,
        inferenceReason: bestMatch.reason,
      });
      usedCanonical.add(bestMatch.field);
    } else {
      unmappedColumns.push(header);
    }
  }

  // Check missing required fields
  const missingRequiredFields = Object.entries(CANONICAL_INVOICE_FIELDS)
    .filter(([key, meta]) => meta.required && !usedCanonical.has(key))
    .map(([key]) => key);

  // Overall confidence
  const avgScore = mappings.length > 0
    ? mappings.reduce((s, m) => s + m.confidenceScore, 0) / mappings.length
    : 0;
  const overallConfidence: ConfidenceLevel =
    missingRequiredFields.length > 0 ? 'low' :
    avgScore >= 0.75 ? 'high' :
    avgScore >= 0.55 ? 'medium' : 'low';

  return { mappings, unmappedColumns, missingRequiredFields, overallConfidence };
}

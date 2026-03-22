// ═══════════════════════════════════════════════════════════════
// Validation rules for ingested candidates
// ═══════════════════════════════════════════════════════════════

import type { NormalizedInvoiceCandidate, ValidationResult, IngestionException } from './types';

export function validateInvoiceCandidate(
  candidate: NormalizedInvoiceCandidate,
  rowIndex: number
): { validations: ValidationResult[]; exceptions: IngestionException[] } {
  const validations: ValidationResult[] = [];
  const exceptions: IngestionException[] = [];

  // ── Required fields ────────────────────────────────────────
  if (!candidate.invoice_number && !candidate.external_invoice_id) {
    validations.push({ field: 'invoice_number', severity: 'error', message: 'Invoice number or external ID is required' });
    exceptions.push({
      type: 'missing_critical_field', severity: 'error',
      reason: 'No invoice identifier found',
      suggestedFix: 'Map a column to "Invoice Number" or provide a default',
      fieldName: 'invoice_number', canFixInUi: true, requiresReprocessing: false,
    });
  }

  if (!candidate.client_name) {
    validations.push({ field: 'client_name', severity: 'error', message: 'Client name is required' });
    exceptions.push({
      type: 'missing_critical_field', severity: 'error',
      reason: 'No client name or reference found',
      suggestedFix: 'Map a column to "Client Name"',
      fieldName: 'client_name', canFixInUi: true, requiresReprocessing: false,
    });
  }

  if (candidate.total_amount === undefined && candidate.remaining_balance === undefined) {
    validations.push({ field: 'total_amount', severity: 'error', message: 'At least one amount field is required' });
    exceptions.push({
      type: 'missing_critical_field', severity: 'error',
      reason: 'No amount or balance found',
      suggestedFix: 'Map a column to "Total Amount" or "Balance Due"',
      fieldName: 'total_amount', canFixInUi: true, requiresReprocessing: false,
    });
  }

  // ── Business validation ────────────────────────────────────

  // Amount checks
  if (candidate.total_amount !== undefined && candidate.total_amount < 0) {
    validations.push({ field: 'total_amount', severity: 'warning', message: 'Total amount is negative', value: String(candidate.total_amount) });
  }

  if (candidate.remaining_balance !== undefined && candidate.total_amount !== undefined) {
    if (candidate.remaining_balance > candidate.total_amount * 1.01) { // 1% tolerance
      validations.push({ field: 'remaining_balance', severity: 'warning', message: 'Balance exceeds total amount' });
    }
  }

  if (candidate.amount_paid !== undefined && candidate.amount_paid < 0) {
    validations.push({ field: 'amount_paid', severity: 'warning', message: 'Paid amount is negative', value: String(candidate.amount_paid) });
  }

  // Cross-field consistency: total ≈ paid + remaining
  if (candidate.total_amount !== undefined && candidate.amount_paid !== undefined && candidate.remaining_balance !== undefined) {
    const expected = candidate.amount_paid + candidate.remaining_balance;
    const diff = Math.abs(candidate.total_amount - expected);
    if (diff > 0.01 * candidate.total_amount && diff > 1) {
      validations.push({
        field: 'total_amount', severity: 'warning',
        message: `Amount mismatch: total (${candidate.total_amount}) ≠ paid (${candidate.amount_paid}) + balance (${candidate.remaining_balance})`,
      });
    }
  }

  // Date checks
  if (candidate.due_date) {
    const due = new Date(candidate.due_date);
    if (isNaN(due.getTime())) {
      validations.push({ field: 'due_date', severity: 'error', message: 'Invalid due date', value: candidate.due_date });
      exceptions.push({
        type: 'impossible_date', severity: 'error',
        reason: `Cannot parse due date: ${candidate.due_date}`,
        fieldName: 'due_date', rawValue: candidate.due_date,
        canFixInUi: true, requiresReprocessing: false,
      });
    }
  }

  if (candidate.issue_date && candidate.due_date) {
    const issue = new Date(candidate.issue_date);
    const due = new Date(candidate.due_date);
    if (!isNaN(issue.getTime()) && !isNaN(due.getTime()) && due < issue) {
      validations.push({ field: 'due_date', severity: 'warning', message: 'Due date is before issue date' });
    }
  }

  // Status + balance consistency
  if (candidate.status === 'paid' && candidate.remaining_balance !== undefined && candidate.remaining_balance > 0) {
    validations.push({ field: 'status', severity: 'warning', message: 'Status is "paid" but balance is greater than zero' });
  }

  // Email validation
  if (candidate.billing_contact_email) {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(candidate.billing_contact_email)) {
      validations.push({ field: 'billing_contact_email', severity: 'warning', message: 'Email address appears invalid', value: candidate.billing_contact_email });
    }
  }

  // ── Info-level advisories ──────────────────────────────────

  if (!candidate.due_date && !candidate.payment_terms) {
    validations.push({ field: 'due_date', severity: 'info', message: 'No due date or payment terms — a default will be applied' });
  }

  if (!candidate.billing_contact_email) {
    validations.push({ field: 'billing_contact_email', severity: 'info', message: 'No contact email — automated messaging will not be possible' });
  }

  if (!candidate.currency) {
    validations.push({ field: 'currency', severity: 'info', message: 'No currency specified — defaulting to organization currency' });
  }

  return { validations, exceptions };
}

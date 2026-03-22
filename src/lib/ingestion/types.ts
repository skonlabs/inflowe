// ═══════════════════════════════════════════════════════════════
// Ingestion subsystem types
// ═══════════════════════════════════════════════════════════════

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface FieldMapping {
  sourceColumn: string;
  canonicalField: string;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0–1
  sampleValues: string[];
  isRequired: boolean;
  transform?: string;
  defaultValue?: string;
  inferenceReason: string;
}

export interface MappingResult {
  mappings: FieldMapping[];
  unmappedColumns: string[];
  missingRequiredFields: string[];
  overallConfidence: ConfidenceLevel;
}

export type CandidateType = 'invoice' | 'client' | 'payment';

export interface NormalizedInvoiceCandidate {
  external_invoice_id?: string;
  invoice_number?: string;
  client_name?: string;
  client_legal_name?: string;
  billing_contact_name?: string;
  billing_contact_email?: string;
  billing_contact_phone?: string;
  issue_date?: string;
  due_date?: string;
  payment_terms?: string;
  currency?: string;
  subtotal_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  amount_paid?: number;
  remaining_balance?: number;
  status?: string;
  notes?: string;
  custom_attributes?: Record<string, string>;
}

export interface NormalizedClientCandidate {
  client_name?: string;
  legal_name?: string;
  primary_email?: string;
  primary_phone?: string;
  address?: string;
  currency?: string;
  preferred_channel?: string;
  payment_terms_default?: string;
  custom_attributes?: Record<string, string>;
}

export interface NormalizedPaymentCandidate {
  external_payment_id?: string;
  related_invoice_reference?: string;
  related_client_reference?: string;
  payment_date?: string;
  payment_amount?: number;
  currency?: string;
  payment_method?: string;
  transaction_reference?: string;
  notes?: string;
  custom_attributes?: Record<string, string>;
}

export interface ValidationResult {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  value?: string;
}

export interface IngestionException {
  type: string;
  severity: 'error' | 'warning';
  reason: string;
  suggestedFix?: string;
  fieldName?: string;
  rawValue?: string;
  canFixInUi: boolean;
  requiresReprocessing: boolean;
}

export interface ParsedRow {
  rowIndex: number;
  rawValues: Record<string, string>;
  normalizedCandidate?: NormalizedInvoiceCandidate;
  validationResults: ValidationResult[];
  exceptions: IngestionException[];
  overallStatus: 'valid' | 'warning' | 'error';
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  sampleNormalized: ParsedRow[];
  mappingResult: MappingResult;
}

export interface SavedMappingTemplate {
  id?: string;
  name: string;
  sourceType: string;
  headerSignature: string;
  dateFormat: string;
  defaultCurrency: string;
  ignoredColumns: string[];
  fields: Array<{
    sourceColumn: string;
    canonicalField: string;
    transform?: string;
    defaultValue?: string;
  }>;
}

// Canonical fields metadata
export const CANONICAL_INVOICE_FIELDS: Record<string, { label: string; required: boolean; type: string }> = {
  invoice_number: { label: 'Invoice Number', required: true, type: 'string' },
  external_invoice_id: { label: 'External Invoice ID', required: false, type: 'string' },
  client_name: { label: 'Client Name', required: true, type: 'string' },
  client_legal_name: { label: 'Client Legal Name', required: false, type: 'string' },
  billing_contact_name: { label: 'Contact Name', required: false, type: 'string' },
  billing_contact_email: { label: 'Contact Email', required: false, type: 'email' },
  billing_contact_phone: { label: 'Contact Phone', required: false, type: 'phone' },
  issue_date: { label: 'Issue Date', required: false, type: 'date' },
  due_date: { label: 'Due Date', required: true, type: 'date' },
  payment_terms: { label: 'Payment Terms', required: false, type: 'string' },
  currency: { label: 'Currency', required: false, type: 'currency' },
  subtotal_amount: { label: 'Subtotal', required: false, type: 'number' },
  tax_amount: { label: 'Tax Amount', required: false, type: 'number' },
  total_amount: { label: 'Total Amount', required: true, type: 'number' },
  amount_paid: { label: 'Amount Paid', required: false, type: 'number' },
  remaining_balance: { label: 'Balance Due', required: false, type: 'number' },
  status: { label: 'Status', required: false, type: 'status' },
  notes: { label: 'Notes', required: false, type: 'string' },
};

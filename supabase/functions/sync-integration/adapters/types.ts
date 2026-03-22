/**
 * Shared adapter contract for all integration providers.
 *
 * Each adapter must:
 *  1. Accept a connected `integration` record
 *  2. Fetch data from the external provider API using stored credentials
 *  3. Map provider-specific fields to InvoiceCandidate / PaymentCandidate
 *  4. Return a SyncResult that the main handler writes to the DB
 */

export interface Integration {
  id: string;
  organization_id: string;
  provider: string;
  connection_status: string;
  credential_reference: string | null;
  sync_policy: Record<string, unknown>;
  last_successful_sync_at: string | null;
}

export interface InvoiceCandidate {
  source_type: string;
  source_system: string;
  source_record_id: string;
  external_invoice_id: string | null;
  invoice_number: string | null;
  client_name: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;
  issue_date: string | null;       // ISO YYYY-MM-DD
  due_date: string | null;         // ISO YYYY-MM-DD
  currency: string;
  total_amount: number;
  amount_paid: number;
  remaining_balance: number;
  status_raw: string | null;
  payment_terms: string | null;
  notes: string | null;
  custom_attributes: Record<string, unknown>;
  mapping_confidence: 'high' | 'medium' | 'low';
}

export interface PaymentCandidate {
  source_type: string;
  source_system: string;
  source_record_id: string;
  external_payment_id: string | null;
  related_invoice_source_id: string | null;
  payment_date: string | null;
  payment_amount: number;
  currency: string;
  payment_method: string | null;
  transaction_reference: string | null;
  reconciliation_confidence: 'high' | 'medium' | 'low';
  notes: string | null;
}

export interface ClientCandidate {
  source_type: string;
  source_system: string;
  source_record_id: string;
  client_name: string;
  legal_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  currency: string | null;
  payment_terms_default: string | null;
  custom_attributes: Record<string, unknown>;
}

export interface SyncResult {
  invoices: InvoiceCandidate[];
  payments: PaymentCandidate[];
  clients: ClientCandidate[];
  errors: Array<{ record_id: string; error: string }>;
  cursor: string | null;  // Pagination cursor for incremental sync
}

export interface AdapterContext {
  integration: Integration;
  /** Resolved API credentials (fetched from Vault or env) */
  credentials: Record<string, string>;
  /** Supabase admin client for reading org data */
  supabaseUrl: string;
  supabaseServiceKey: string;
  /** ISO timestamp of last successful sync (for incremental fetching) */
  sinceTimestamp: string | null;
  /** Pagination cursor from previous sync run */
  cursor: string | null;
}


-- ============================================
-- MIGRATION 2: Financial & Integration Tables
-- ============================================

-- Import Batches (needed before invoices FK)
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  import_type TEXT NOT NULL DEFAULT 'csv',
  file_object_key TEXT,
  original_filename TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_rows INT NOT NULL DEFAULT 0,
  successful_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  column_mapping JSONB NOT NULL DEFAULT '{}',
  validation_errors JSONB NOT NULL DEFAULT '[]',
  error_report_object_key TEXT,
  idempotency_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Integrations
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  provider TEXT NOT NULL,
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  credential_reference TEXT,
  scopes_granted TEXT[] NOT NULL DEFAULT '{}',
  sync_policy JSONB NOT NULL DEFAULT '{}',
  last_successful_sync_at TIMESTAMPTZ,
  last_attempted_sync_at TIMESTAMPTZ,
  failure_history JSONB NOT NULL DEFAULT '[]',
  sync_delay_threshold_mins INT NOT NULL DEFAULT 60,
  connected_by_user_id UUID REFERENCES public.profiles(id),
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider)
);

-- Sync Runs
CREATE TABLE public.sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  integration_id UUID NOT NULL REFERENCES public.integrations(id),
  provider TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  records_processed INT NOT NULL DEFAULT 0,
  records_created INT NOT NULL DEFAULT 0,
  records_updated INT NOT NULL DEFAULT 0,
  records_skipped INT NOT NULL DEFAULT 0,
  records_failed INT NOT NULL DEFAULT 0,
  error_summary JSONB NOT NULL DEFAULT '[]',
  lineage_metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  invoice_number TEXT,
  external_id TEXT,
  amount NUMERIC(15,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  remaining_balance NUMERIC(15,2) NOT NULL,
  amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  issue_date DATE,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'sent',
  days_until_due INT,
  days_overdue INT,
  aging_bucket TEXT,
  collection_priority TEXT NOT NULL DEFAULT 'medium',
  collection_stage TEXT,
  escalation_stage TEXT,
  last_action_taken_at TIMESTAMPTZ,
  last_successful_contact_at TIMESTAMPTZ,
  next_action_planned_at TIMESTAMPTZ,
  promise_to_pay_active BOOLEAN NOT NULL DEFAULT FALSE,
  promise_to_pay_date DATE,
  promise_to_pay_amount NUMERIC(15,2),
  payment_plan_active BOOLEAN NOT NULL DEFAULT FALSE,
  payment_plan_id UUID,
  dispute_active BOOLEAN NOT NULL DEFAULT FALSE,
  dispute_reason TEXT,
  dispute_created_at TIMESTAMPTZ,
  on_hold_reason TEXT,
  risk_score NUMERIC(4,3),
  priority_score NUMERIC(4,3),
  source_system TEXT,
  source_record_id TEXT,
  import_batch_id UUID REFERENCES public.import_batches(id),
  sync_run_id UUID,
  imported_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoices_org_state ON public.invoices(organization_id, state);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date) WHERE state NOT IN ('paid','cancelled','written_off');

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  amount NUMERIC(15,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  confidence TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL,
  source_transaction_id TEXT,
  sync_run_id UUID,
  import_batch_id UUID,
  notes TEXT,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment Allocations
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  allocated_amount NUMERIC(15,2) NOT NULL,
  allocation_date DATE NOT NULL,
  allocation_source TEXT NOT NULL DEFAULT 'automatic',
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, invoice_id)
);

-- Payment Plans
CREATE TABLE public.payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  total_amount NUMERIC(15,2) NOT NULL,
  amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL,
  installments JSONB NOT NULL DEFAULT '[]',
  plan_status TEXT NOT NULL DEFAULT 'active',
  discount_percent NUMERIC(5,2),
  settlement_offer BOOLEAN NOT NULL DEFAULT FALSE,
  workflow_adaptation JSONB NOT NULL DEFAULT '{}',
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view org invoices" ON public.invoices FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org invoices" ON public.invoices FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org invoices" ON public.invoices FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org payments" ON public.payments FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org payments" ON public.payments FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org payment_allocations" ON public.payment_allocations FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org payment_plans" ON public.payment_plans FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org payment_plans" ON public.payment_plans FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org integrations" ON public.integrations FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can manage org integrations" ON public.integrations FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org integrations" ON public.integrations FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org sync_runs" ON public.sync_runs FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org import_batches" ON public.import_batches FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org import_batches" ON public.import_batches FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

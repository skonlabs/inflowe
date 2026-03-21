
-- ============================================
-- MIGRATION 3: Operations & Workflow Tables
-- ============================================

-- Workflow Definitions
CREATE TABLE public.workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'global',
  target_client_id UUID REFERENCES public.clients(id),
  target_segment_filter JSONB,
  priority INT NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  published_version_id UUID,
  is_default_template BOOLEAN NOT NULL DEFAULT FALSE,
  template_name TEXT,
  created_by_user_id UUID REFERENCES public.profiles(id),
  last_modified_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow Versions
CREATE TABLE public.workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id UUID NOT NULL REFERENCES public.workflow_definitions(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  version_number INT NOT NULL,
  definition JSONB NOT NULL,
  change_summary TEXT,
  simulation_result JSONB,
  published_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_reason TEXT,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_definition_id, version_number)
);

-- Workflow Runs
CREATE TABLE public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  workflow_definition_id UUID NOT NULL REFERENCES public.workflow_definitions(id),
  workflow_version_id UUID NOT NULL REFERENCES public.workflow_versions(id),
  trigger_type TEXT NOT NULL,
  trigger_payload JSONB NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  client_id UUID REFERENCES public.clients(id),
  evaluated_decision_path JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'evaluating',
  skip_reason TEXT,
  fail_reason TEXT,
  actions_generated INT NOT NULL DEFAULT 0,
  requires_recheck BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflow_runs_invoice ON public.workflow_runs(invoice_id);

-- Communication Threads
CREATE TABLE public.communication_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  primary_invoice_id UUID REFERENCES public.invoices(id),
  linked_invoice_ids UUID[] NOT NULL DEFAULT '{}',
  channel TEXT NOT NULL,
  provider_thread_id TEXT,
  subject TEXT,
  thread_status TEXT NOT NULL DEFAULT 'active',
  thread_classification TEXT NOT NULL DEFAULT 'auto_handled',
  latest_message_at TIMESTAMPTZ,
  latest_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Outbound Messages
CREATE TABLE public.outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  invoice_id UUID REFERENCES public.invoices(id),
  communication_thread_id UUID REFERENCES public.communication_threads(id),
  contact_id UUID REFERENCES public.client_contacts(id),
  workflow_run_id UUID,
  workflow_action_id UUID,
  channel TEXT NOT NULL,
  source_type TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT NOT NULL,
  template_id TEXT,
  ai_prompt_version TEXT,
  ai_model_used TEXT,
  ai_generation_latency_ms INT,
  ai_policy_check_result JSONB,
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approver_user_id UUID REFERENCES public.profiles(id),
  approval_context JSONB,
  approval_expires_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  edits_made BOOLEAN NOT NULL DEFAULT FALSE,
  edits_applied JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  send_status TEXT NOT NULL DEFAULT 'drafted',
  provider_message_id TEXT,
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_category TEXT,
  failure_detail TEXT,
  retry_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  retry_count INT NOT NULL DEFAULT 0,
  rationale TEXT,
  rationale_code TEXT,
  collection_stage TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_outbound_idempotency ON public.outbound_messages(idempotency_key);
CREATE INDEX idx_outbound_org_status ON public.outbound_messages(organization_id, send_status);

-- Inbound Messages
CREATE TABLE public.inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID REFERENCES public.clients(id),
  sender_contact_id UUID REFERENCES public.client_contacts(id),
  invoice_id UUID REFERENCES public.invoices(id),
  communication_thread_id UUID REFERENCES public.communication_threads(id),
  channel TEXT NOT NULL,
  sender_email TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  provider_message_id TEXT,
  provider_thread_id TEXT,
  subject TEXT,
  raw_content TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  classification TEXT NOT NULL DEFAULT 'unclassified',
  classification_confidence NUMERIC(4,3),
  classification_model_used TEXT,
  classification_prompt_version TEXT,
  requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  manual_review_reason TEXT,
  classified_by_user_id UUID REFERENCES public.profiles(id),
  promise_to_pay_date DATE,
  out_of_office_until DATE,
  action_outcome TEXT,
  linked_outbound_message_id UUID REFERENCES public.outbound_messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow Actions
CREATE TABLE public.workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  workflow_run_id UUID NOT NULL REFERENCES public.workflow_runs(id),
  workflow_definition_id UUID NOT NULL REFERENCES public.workflow_definitions(id),
  invoice_id UUID REFERENCES public.invoices(id),
  client_id UUID REFERENCES public.clients(id),
  contact_id UUID REFERENCES public.client_contacts(id),
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}',
  rationale TEXT NOT NULL,
  rationale_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  idempotency_key TEXT NOT NULL UNIQUE,
  outbound_message_id UUID REFERENCES public.outbound_messages(id),
  scheduled_for TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  fail_reason TEXT,
  presend_check_passed BOOLEAN,
  presend_check_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflow_actions_invoice ON public.workflow_actions(invoice_id, status);
CREATE INDEX idx_workflow_actions_idempotency ON public.workflow_actions(idempotency_key);

-- Approvals
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  workflow_action_id UUID,
  outbound_message_id UUID REFERENCES public.outbound_messages(id),
  invoice_id UUID REFERENCES public.invoices(id),
  client_id UUID REFERENCES public.clients(id),
  approver_user_id UUID REFERENCES public.profiles(id),
  approver_role TEXT,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rationale_shown TEXT NOT NULL,
  context_shown JSONB NOT NULL,
  decision_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  rejection_reason TEXT,
  edits_applied JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_approvals_org_status ON public.approvals(organization_id, status);

-- Enable RLS
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies (all org-scoped)
CREATE POLICY "Members can view org workflow_definitions" ON public.workflow_definitions FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can manage org workflow_definitions" ON public.workflow_definitions FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org workflow_definitions" ON public.workflow_definitions FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org workflow_versions" ON public.workflow_versions FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org workflow_runs" ON public.workflow_runs FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org workflow_actions" ON public.workflow_actions FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org threads" ON public.communication_threads FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org outbound_messages" ON public.outbound_messages FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org inbound_messages" ON public.inbound_messages FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org approvals" ON public.approvals FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org approvals" ON public.approvals FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

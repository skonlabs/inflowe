
-- ============================================
-- MIGRATION 4: Read Models & Remaining Tables
-- ============================================

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  notification_class TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  entity_type TEXT,
  entity_id UUID,
  delivery_channels TEXT[] NOT NULL DEFAULT '{in_app}',
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  suppression_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) UNIQUE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  billing_interval TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  payment_provider TEXT,
  payment_provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Module Entitlements
CREATE TABLE public.module_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
  module_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, module_id)
);

-- Usage Records
CREATE TABLE public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  module_id TEXT NOT NULL,
  usage_dimension TEXT NOT NULL,
  quantity INT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk Scores
CREATE TABLE public.risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  invoice_id UUID REFERENCES public.invoices(id),
  score NUMERIC(4,3) NOT NULL,
  score_version TEXT NOT NULL,
  indicators JSONB NOT NULL DEFAULT '{}',
  explanation TEXT NOT NULL,
  explanation_prompt_version TEXT,
  model_used TEXT,
  computed_at TIMESTAMPTZ NOT NULL,
  module_dependency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly Briefs
CREATE TABLE public.weekly_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  outstanding_total NUMERIC(15,2) NOT NULL,
  overdue_total NUMERIC(15,2) NOT NULL,
  due_soon_total NUMERIC(15,2) NOT NULL,
  recovered_amount NUMERIC(15,2) NOT NULL,
  overdue_movement NUMERIC(15,2) NOT NULL,
  promises_to_pay_count INT NOT NULL DEFAULT 0,
  disputes_count INT NOT NULL DEFAULT 0,
  actions_taken_summary JSONB NOT NULL DEFAULT '{}',
  recommended_next_steps JSONB NOT NULL DEFAULT '[]',
  narrative_text TEXT,
  narrative_object_key TEXT,
  delivered_to_user_ids UUID[] NOT NULL DEFAULT '{}',
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support Cases
CREATE TABLE public.support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  case_type TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  auto_attached_context JSONB NOT NULL DEFAULT '{}',
  internal_notes TEXT,
  assigned_to_internal_user_id UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Diagnostic Bundles
CREATE TABLE public.diagnostic_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  support_case_id UUID REFERENCES public.support_cases(id),
  generated_by_user_id UUID REFERENCES public.profiles(id),
  bundle_type TEXT NOT NULL,
  object_storage_key TEXT NOT NULL,
  contents_summary JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs (append-only)
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID,
  actor_user_id UUID,
  actor_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_snapshot JSONB,
  after_snapshot JSONB,
  reason TEXT,
  reason_code TEXT,
  source_ip INET,
  user_agent TEXT,
  session_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_org_entity ON public.audit_logs(organization_id, entity_type, entity_id);
CREATE INDEX idx_audit_occurred ON public.audit_logs(occurred_at DESC);

-- Feature Flags
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  enabled_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage INT NOT NULL DEFAULT 0,
  targeting_rules JSONB NOT NULL DEFAULT '[]',
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompt Versions
CREATE TABLE public.prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case TEXT NOT NULL,
  version TEXT NOT NULL,
  model_target TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (use_case, version)
);

-- Read Model: Invoice List
CREATE TABLE public.read_invoice_list (
  organization_id UUID NOT NULL,
  invoice_id UUID NOT NULL PRIMARY KEY,
  client_display_name TEXT,
  invoice_number TEXT,
  amount NUMERIC(15,2),
  remaining_balance NUMERIC(15,2),
  currency CHAR(3),
  due_date DATE,
  state TEXT,
  days_overdue INT,
  aging_bucket TEXT,
  collection_priority TEXT,
  last_action_taken_at TIMESTAMPTZ,
  next_action_planned_at TIMESTAMPTZ,
  contact_name TEXT,
  contact_email TEXT,
  risk_score NUMERIC(4,3),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Read Model: Client Summary
CREATE TABLE public.read_client_summary (
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL PRIMARY KEY,
  display_name TEXT,
  sensitivity_level TEXT,
  do_not_automate BOOLEAN,
  overdue_total NUMERIC(15,2),
  due_soon_total NUMERIC(15,2),
  outstanding_total NUMERIC(15,2),
  overdue_invoice_count INT,
  latest_reply_at TIMESTAMPTZ,
  latest_reply_classification TEXT,
  next_action TEXT,
  risk_score NUMERIC(4,3),
  account_owner_name TEXT,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Read Model: Home Summary
CREATE TABLE public.read_home_summary (
  organization_id UUID NOT NULL PRIMARY KEY,
  overdue_total NUMERIC(15,2),
  overdue_count INT,
  due_soon_total NUMERIC(15,2),
  due_soon_count INT,
  approvals_pending INT,
  replies_needing_attention INT,
  high_risk_client_count INT,
  integration_health_warnings TEXT[],
  automation_paused BOOLEAN,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on remaining tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_invoice_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_client_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_home_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Members can view org subscriptions" ON public.subscriptions FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org entitlements" ON public.module_entitlements FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org usage" ON public.usage_records FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org risk_scores" ON public.risk_scores FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org weekly_briefs" ON public.weekly_briefs FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org support_cases" ON public.support_cases FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can create org support_cases" ON public.support_cases FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org diagnostic_bundles" ON public.diagnostic_bundles FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org audit_logs" ON public.audit_logs FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org read_invoice_list" ON public.read_invoice_list FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org read_client_summary" ON public.read_client_summary FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can view org read_home_summary" ON public.read_home_summary FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Append-only trigger for audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. UPDATE and DELETE are not allowed.';
END;
$$;

CREATE TRIGGER enforce_audit_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_mutation();

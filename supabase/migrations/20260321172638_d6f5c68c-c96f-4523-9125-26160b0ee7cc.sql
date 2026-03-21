
-- ============================================
-- MIGRATION 1: Core Identity & CRM Tables
-- ============================================

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  country CHAR(2) NOT NULL,
  default_currency CHAR(3) NOT NULL,
  business_hours_start TIME,
  business_hours_end TIME,
  business_hours_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  holiday_calendar JSONB NOT NULL DEFAULT '[]',
  sender_email TEXT,
  sender_display_name TEXT,
  reply_to_address TEXT,
  brand_tone TEXT NOT NULL DEFAULT 'professional',
  custom_tone_instructions TEXT,
  regional_sending_restrictions JSONB NOT NULL DEFAULT '{}',
  channel_preferences JSONB NOT NULL DEFAULT '{}',
  subscription_state TEXT NOT NULL DEFAULT 'trialing',
  active_module_ids TEXT[] NOT NULL DEFAULT '{}',
  feature_flags JSONB NOT NULL DEFAULT '{}',
  sender_verified_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (maps to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Memberships (org <-> user roles)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  scoped_access_type TEXT NOT NULL DEFAULT 'all',
  invited_by_user_id UUID REFERENCES public.profiles(id),
  invitation_token TEXT UNIQUE,
  invitation_expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- Organization Settings
CREATE TABLE public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  last_modified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, setting_key)
);

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  display_name TEXT NOT NULL,
  legal_name TEXT,
  client_status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  account_owner_user_id UUID REFERENCES public.profiles(id),
  sensitivity_level TEXT NOT NULL DEFAULT 'standard',
  do_not_automate BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_channel TEXT NOT NULL DEFAULT 'email',
  default_payment_terms_days INT,
  language_preference TEXT NOT NULL DEFAULT 'en',
  tags TEXT[] NOT NULL DEFAULT '{}',
  send_restrictions JSONB NOT NULL DEFAULT '{}',
  escalation_preferences JSONB NOT NULL DEFAULT '{}',
  workflow_override_id UUID,
  tone_override TEXT,
  tone_override_instructions TEXT,
  approval_policy_override TEXT,
  message_frequency_override JSONB,
  channel_restriction TEXT[] NOT NULL DEFAULT '{}',
  archived_at TIMESTAMPTZ,
  source_system TEXT,
  source_id TEXT,
  import_batch_id UUID,
  sync_run_id UUID,
  imported_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clients_org ON public.clients(organization_id);
CREATE INDEX idx_clients_status ON public.clients(organization_id, client_status);

-- Client Contacts
CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  full_name TEXT NOT NULL,
  contact_role TEXT NOT NULL DEFAULT 'primary_billing',
  escalation_order INT NOT NULL DEFAULT 1,
  email TEXT,
  email_valid BOOLEAN NOT NULL DEFAULT TRUE,
  email_bounced BOOLEAN NOT NULL DEFAULT FALSE,
  email_bounced_at TIMESTAMPTZ,
  email_bounce_type TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  whatsapp_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_eligibility_checked_at TIMESTAMPTZ,
  channel_preference TEXT NOT NULL DEFAULT 'email',
  do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
  do_not_contact_reason TEXT,
  opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  opted_out_channel TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source_system TEXT,
  source_id TEXT,
  imported_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contacts_client ON public.client_contacts(client_id);
CREATE INDEX idx_contacts_email ON public.client_contacts(email) WHERE email IS NOT NULL;

-- Client Assignments
CREATE TABLE public.client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  membership_id UUID NOT NULL REFERENCES public.memberships(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (membership_id, client_id)
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's org IDs
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.memberships
  WHERE user_id = _user_id AND status = 'active';
$$;

-- RLS: Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- RLS: Organizations (via membership)
CREATE POLICY "Members can view their orgs" ON public.organizations FOR SELECT
  USING (id IN (SELECT public.get_user_org_ids(auth.uid())));

-- RLS: Memberships
CREATE POLICY "Members can view org memberships" ON public.memberships FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- RLS: Organization Settings
CREATE POLICY "Members can view org settings" ON public.organization_settings FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- RLS: Clients
CREATE POLICY "Members can view org clients" ON public.clients FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org clients" ON public.clients FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org clients" ON public.clients FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- RLS: Client Contacts
CREATE POLICY "Members can view org contacts" ON public.client_contacts FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org contacts" ON public.client_contacts FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org contacts" ON public.client_contacts FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- RLS: Client Assignments
CREATE POLICY "Members can view org assignments" ON public.client_assignments FOR SELECT
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

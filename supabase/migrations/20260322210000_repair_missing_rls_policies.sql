-- Repair migration: ensure critical RLS policies exist that may have been missed
-- if 20260322000000_core_rpc_and_fixes.sql failed due to duplicate policy names.
-- This migration is idempotent (uses DROP IF EXISTS + CREATE).

-- ── Notifications INSERT policy ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can insert org notifications" ON public.notifications;
CREATE POLICY "Members can insert org notifications" ON public.notifications FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ── Read model tables: enable RLS + policies ─────────────────────────────────
ALTER TABLE public.read_invoice_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_client_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_home_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage read_invoice_list" ON public.read_invoice_list;
CREATE POLICY "Members can manage read_invoice_list" ON public.read_invoice_list
  FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can manage read_client_summary" ON public.read_client_summary;
CREATE POLICY "Members can manage read_client_summary" ON public.read_client_summary
  FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can manage read_home_summary" ON public.read_home_summary;
CREATE POLICY "Members can manage read_home_summary" ON public.read_home_summary
  FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ── Payments and allocations INSERT policies ─────────────────────────────────
DROP POLICY IF EXISTS "Members can insert org payments" ON public.payments;
CREATE POLICY "Members can insert org payments" ON public.payments FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can insert org payment_allocations" ON public.payment_allocations;
CREATE POLICY "Members can insert org payment_allocations" ON public.payment_allocations FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ── Clients INSERT policy (already exists but ensure it's there) ─────────────
DROP POLICY IF EXISTS "Members can insert org clients" ON public.clients;
CREATE POLICY "Members can insert org clients" ON public.clients FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ── client_contacts INSERT policy (new name, covers inserts with org check) ──
DROP POLICY IF EXISTS "Members can insert org client_contacts" ON public.client_contacts;
CREATE POLICY "Members can insert org client_contacts" ON public.client_contacts FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ── import_batches: ensure INSERT and UPDATE policies exist ──────────────────
DROP POLICY IF EXISTS "Members can insert org import_batches" ON public.import_batches;
CREATE POLICY "Members can insert org import_batches" ON public.import_batches FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "Members can update own import_batches" ON public.import_batches;
CREATE POLICY "Members can update own import_batches" ON public.import_batches FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ── invoices INSERT policy ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can insert org invoices" ON public.invoices;
CREATE POLICY "Members can insert org invoices" ON public.invoices FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- ── Ensure profiles.email column exists for member invite lookup ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END;
$$;

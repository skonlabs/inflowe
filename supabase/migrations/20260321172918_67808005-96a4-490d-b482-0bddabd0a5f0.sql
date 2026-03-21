
-- Fix linter warnings

-- Feature flags: internal/platform table, allow authenticated reads
CREATE POLICY "Authenticated can view feature_flags" ON public.feature_flags FOR SELECT
  TO authenticated USING (true);

-- Prompt versions: internal/platform table, allow authenticated reads
CREATE POLICY "Authenticated can view prompt_versions" ON public.prompt_versions FOR SELECT
  TO authenticated USING (true);

-- Fix search_path on prevent_audit_mutation function
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. UPDATE and DELETE are not allowed.';
END;
$$;

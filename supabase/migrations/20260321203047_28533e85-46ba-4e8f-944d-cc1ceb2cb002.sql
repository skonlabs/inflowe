
-- Remove the overly permissive INSERT policy on organizations since onboarding now uses the RPC
DROP POLICY IF EXISTS "Authenticated can create organizations" ON public.organizations;

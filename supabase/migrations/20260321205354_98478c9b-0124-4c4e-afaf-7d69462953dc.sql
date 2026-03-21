
-- RPC to start a trial for a module (creates subscription if needed)
CREATE OR REPLACE FUNCTION public.start_module_trial(
  _org_id uuid,
  _module_id text,
  _trial_days integer DEFAULT 14
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _sub_id uuid;
  _entitlement_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is a member of the org
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Check if module is already active or trialing
  IF EXISTS (
    SELECT 1 FROM public.module_entitlements
    WHERE organization_id = _org_id AND module_id = _module_id AND status IN ('active', 'trialing')
  ) THEN
    RAISE EXCEPTION 'Module is already active or in trial';
  END IF;

  -- Get or create a trial subscription for this org
  SELECT id INTO _sub_id FROM public.subscriptions
  WHERE organization_id = _org_id AND status = 'trialing'
  LIMIT 1;

  IF _sub_id IS NULL THEN
    INSERT INTO public.subscriptions (organization_id, plan_id, plan_name, billing_interval, status, trial_starts_at, trial_ends_at)
    VALUES (_org_id, 'trial', 'Free Trial', 'monthly', 'trialing', now(), now() + (_trial_days || ' days')::interval)
    RETURNING id INTO _sub_id;
  END IF;

  -- Create the module entitlement
  INSERT INTO public.module_entitlements (organization_id, module_id, subscription_id, status, trial_started_at, trial_ends_at, activated_at)
  VALUES (_org_id, _module_id, _sub_id, 'trialing', now(), now() + (_trial_days || ' days')::interval, now())
  RETURNING id INTO _entitlement_id;

  RETURN _entitlement_id;
END;
$$;

-- RPC to deactivate a module
CREATE OR REPLACE FUNCTION public.deactivate_module(
  _org_id uuid,
  _module_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  UPDATE public.module_entitlements
  SET status = 'deactivated', deactivated_at = now(), deactivation_reason = 'user_deactivated'
  WHERE organization_id = _org_id AND module_id = _module_id AND status IN ('active', 'trialing');
END;
$$;

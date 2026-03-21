
CREATE OR REPLACE FUNCTION public.create_organization_with_membership(
  _legal_name text,
  _display_name text,
  _country character varying,
  _default_currency character varying,
  _timezone text,
  _sender_email text DEFAULT NULL,
  _sender_display_name text DEFAULT NULL,
  _brand_tone text DEFAULT 'professional',
  _is_demo boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user doesn't already have an active membership
  IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND status = 'active') THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  -- Create organization
  INSERT INTO public.organizations (legal_name, display_name, country, default_currency, timezone, sender_email, sender_display_name, brand_tone, is_demo)
  VALUES (_legal_name, _display_name, _country, _default_currency, _timezone, _sender_email, _sender_display_name, _brand_tone, _is_demo)
  RETURNING id INTO _org_id;

  -- Create membership
  INSERT INTO public.memberships (organization_id, user_id, role, status, accepted_at)
  VALUES (_org_id, _user_id, 'owner', 'active', now());

  RETURN _org_id;
END;
$$;

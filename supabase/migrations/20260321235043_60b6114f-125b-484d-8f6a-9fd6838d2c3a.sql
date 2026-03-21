CREATE OR REPLACE FUNCTION public.toggle_automation_pause(_org_id uuid, _paused boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.organization_settings
  SET setting_value = to_jsonb(_paused), last_modified_by = _user_id, updated_at = now()
  WHERE organization_id = _org_id AND setting_key = 'automation_paused';

  IF NOT FOUND THEN
    INSERT INTO public.organization_settings (organization_id, setting_key, setting_value, last_modified_by)
    VALUES (_org_id, 'automation_paused', to_jsonb(_paused), _user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  _invoice_id uuid,
  _org_id uuid,
  _payment_amount numeric DEFAULT NULL,
  _payment_method text DEFAULT 'manual',
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _invoice public.invoices%ROWTYPE;
  _payment_id uuid;
  _applied_amount numeric;
  _new_amount_paid numeric;
  _new_remaining numeric;
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

  SELECT * INTO _invoice
  FROM public.invoices
  WHERE id = _invoice_id AND organization_id = _org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  _applied_amount := COALESCE(_payment_amount, _invoice.remaining_balance);
  IF _applied_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  _applied_amount := LEAST(_applied_amount, _invoice.remaining_balance);
  _new_amount_paid := COALESCE(_invoice.amount_paid, 0) + _applied_amount;
  _new_remaining := GREATEST(COALESCE(_invoice.remaining_balance, _invoice.amount) - _applied_amount, 0);

  INSERT INTO public.payments (
    organization_id,
    client_id,
    amount,
    currency,
    payment_date,
    payment_method,
    source,
    notes,
    confidence,
    created_by_user_id
  ) VALUES (
    _org_id,
    _invoice.client_id,
    _applied_amount,
    _invoice.currency,
    current_date,
    COALESCE(NULLIF(_payment_method, ''), 'manual'),
    'manual_entry',
    _notes,
    'confirmed',
    _user_id
  ) RETURNING id INTO _payment_id;

  INSERT INTO public.payment_allocations (
    organization_id,
    payment_id,
    invoice_id,
    allocated_amount,
    allocation_date,
    allocation_source,
    created_by_user_id
  ) VALUES (
    _org_id,
    _payment_id,
    _invoice_id,
    _applied_amount,
    current_date,
    'manual',
    _user_id
  );

  UPDATE public.invoices
  SET
    amount_paid = _new_amount_paid,
    remaining_balance = _new_remaining,
    paid_at = CASE WHEN _new_remaining = 0 THEN now() ELSE paid_at END,
    state = CASE
      WHEN _new_remaining = 0 THEN 'paid'
      ELSE 'partially_paid'
    END,
    updated_at = now()
  WHERE id = _invoice_id;

  RETURN _payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_invoice_hold(
  _invoice_id uuid,
  _org_id uuid,
  _on_hold boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.invoices
  SET
    on_hold_reason = CASE WHEN _on_hold THEN NULLIF(_reason, '') ELSE NULL END,
    state = CASE
      WHEN _on_hold THEN 'on_hold'
      WHEN dispute_active THEN 'disputed'
      WHEN COALESCE(remaining_balance, 0) <= 0 THEN 'paid'
      WHEN due_date < current_date THEN 'overdue'
      WHEN due_date = current_date THEN 'due_today'
      WHEN due_date <= current_date + 7 THEN 'due_soon'
      ELSE 'sent'
    END,
    updated_at = now()
  WHERE id = _invoice_id AND organization_id = _org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_invoice_dispute(
  _invoice_id uuid,
  _org_id uuid,
  _dispute_active boolean,
  _dispute_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.invoices
  SET
    dispute_active = _dispute_active,
    dispute_reason = CASE WHEN _dispute_active THEN NULLIF(_dispute_reason, '') ELSE NULL END,
    dispute_created_at = CASE WHEN _dispute_active THEN COALESCE(dispute_created_at, now()) ELSE NULL END,
    state = CASE
      WHEN _dispute_active THEN 'disputed'
      WHEN on_hold_reason IS NOT NULL THEN 'on_hold'
      WHEN COALESCE(remaining_balance, 0) <= 0 THEN 'paid'
      WHEN due_date < current_date THEN 'overdue'
      WHEN due_date = current_date THEN 'due_today'
      WHEN due_date <= current_date + 7 THEN 'due_soon'
      ELSE 'sent'
    END,
    updated_at = now()
  WHERE id = _invoice_id AND organization_id = _org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_member_by_email(_org_id uuid, _email text, _role text DEFAULT 'member')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _target_user_id uuid;
  _membership_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND status = 'active'
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only owners and admins can invite members';
  END IF;

  SELECT id INTO _target_user_id
  FROM public.profiles
  WHERE lower(email) = lower(_email)
  LIMIT 1;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'User must sign up before they can be invited';
  END IF;

  SELECT id INTO _membership_id
  FROM public.memberships
  WHERE organization_id = _org_id AND user_id = _target_user_id
  LIMIT 1;

  IF _membership_id IS NOT NULL THEN
    UPDATE public.memberships
    SET role = COALESCE(NULLIF(_role, ''), role), updated_at = now()
    WHERE id = _membership_id;
    RETURN _membership_id;
  END IF;

  INSERT INTO public.memberships (
    organization_id,
    user_id,
    role,
    status,
    invited_by_user_id,
    invitation_token,
    invitation_expires_at
  ) VALUES (
    _org_id,
    _target_user_id,
    COALESCE(NULLIF(_role, ''), 'member'),
    'invited',
    _user_id,
    gen_random_uuid()::text,
    now() + interval '7 days'
  ) RETURNING id INTO _membership_id;

  RETURN _membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manual_thread_reply(_thread_id uuid, _body_text text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _thread record;
  _message_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, organization_id, client_id, channel, subject
  INTO _thread
  FROM public.communication_threads
  WHERE id = _thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _thread.organization_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  INSERT INTO public.outbound_messages (
    organization_id,
    client_id,
    communication_thread_id,
    channel,
    source_type,
    idempotency_key,
    body_text,
    subject,
    send_status,
    approval_required,
    approval_status,
    collection_stage
  ) VALUES (
    _thread.organization_id,
    _thread.client_id,
    _thread.id,
    _thread.channel,
    'manual_reply',
    gen_random_uuid()::text,
    _body_text,
    _thread.subject,
    'manual_draft',
    false,
    'not_required',
    'manual_reply'
  ) RETURNING id INTO _message_id;

  RETURN _message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_approval_message_body(_message_id uuid, _body_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id INTO _org_id
  FROM public.outbound_messages
  WHERE id = _message_id;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  UPDATE public.outbound_messages
  SET
    body_text = _body_text,
    edits_made = true,
    edits_applied = jsonb_build_object('updated_by', _user_id, 'updated_at', now()),
    updated_at = now()
  WHERE id = _message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_feature_flag(_flag_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _is_internal boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_internal INTO _is_internal
  FROM public.profiles
  WHERE id = _user_id;

  IF COALESCE(_is_internal, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Internal access required';
  END IF;

  UPDATE public.feature_flags
  SET enabled_by_default = _enabled,
      rollout_percentage = CASE WHEN _enabled THEN 100 ELSE 0 END,
      updated_at = now(),
      created_by_user_id = _user_id
  WHERE id = _flag_id;
END;
$$;
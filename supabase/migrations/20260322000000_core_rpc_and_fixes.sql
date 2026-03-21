
-- ============================================================
-- MIGRATION: Core RPCs, Read-Model Refresh, and Gap Fixes
-- ============================================================

-- ─── 1. Allow audit_log inserts via RPC (security definer bypasses append-only trigger) ───

CREATE OR REPLACE FUNCTION public.append_audit_log(
  _org_id UUID,
  _entity_type TEXT,
  _entity_id UUID,
  _action_type TEXT,
  _reason TEXT DEFAULT NULL,
  _reason_code TEXT DEFAULT NULL,
  _before_snapshot JSONB DEFAULT NULL,
  _after_snapshot JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _log_id UUID;
BEGIN
  INSERT INTO public.audit_logs(
    organization_id, actor_user_id, actor_type,
    action_type, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, reason_code, occurred_at
  )
  VALUES (
    _org_id, _user_id, 'user',
    _action_type, _entity_type, _entity_id,
    _before_snapshot, _after_snapshot, _reason, _reason_code, now()
  )
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$$;

-- ─── 2. Read-model refresh ───

CREATE OR REPLACE FUNCTION public.refresh_org_read_models(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
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

  -- Refresh read_invoice_list
  DELETE FROM public.read_invoice_list WHERE organization_id = _org_id;

  INSERT INTO public.read_invoice_list (
    organization_id, invoice_id, client_display_name, invoice_number,
    amount, remaining_balance, currency, due_date, state,
    days_overdue, aging_bucket, collection_priority,
    last_action_taken_at, next_action_planned_at,
    contact_name, contact_email, risk_score, refreshed_at
  )
  SELECT
    i.organization_id,
    i.id,
    c.display_name,
    i.invoice_number,
    i.amount,
    i.remaining_balance,
    i.currency,
    i.due_date,
    i.state,
    CASE WHEN i.state IN ('overdue','partially_paid') THEN GREATEST(0, CURRENT_DATE - i.due_date) ELSE NULL END,
    CASE
      WHEN i.state IN ('paid','cancelled','written_off') THEN NULL
      WHEN CURRENT_DATE <= i.due_date THEN 'current'
      WHEN CURRENT_DATE - i.due_date <= 30 THEN '1_30'
      WHEN CURRENT_DATE - i.due_date <= 60 THEN '31_60'
      WHEN CURRENT_DATE - i.due_date <= 90 THEN '61_90'
      ELSE '90_plus'
    END,
    i.collection_priority,
    i.last_action_taken_at,
    i.next_action_planned_at,
    cc.full_name,
    cc.email,
    i.risk_score,
    now()
  FROM public.invoices i
  JOIN public.clients c ON c.id = i.client_id
  LEFT JOIN public.client_contacts cc ON cc.client_id = i.client_id AND cc.is_primary = TRUE
  WHERE i.organization_id = _org_id;

  -- Refresh read_client_summary
  DELETE FROM public.read_client_summary WHERE organization_id = _org_id;

  INSERT INTO public.read_client_summary (
    organization_id, client_id, display_name, sensitivity_level, do_not_automate,
    overdue_total, due_soon_total, outstanding_total, overdue_invoice_count,
    risk_score, refreshed_at
  )
  SELECT
    c.organization_id,
    c.id,
    c.display_name,
    c.sensitivity_level,
    c.do_not_automate,
    COALESCE(SUM(CASE WHEN i.state = 'overdue' THEN i.remaining_balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN i.state IN ('due_soon','due_today') THEN i.remaining_balance ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN i.state NOT IN ('paid','cancelled','written_off') THEN i.remaining_balance ELSE 0 END), 0),
    COUNT(CASE WHEN i.state = 'overdue' THEN 1 END),
    MAX(i.risk_score),
    now()
  FROM public.clients c
  LEFT JOIN public.invoices i ON i.client_id = c.id AND i.organization_id = _org_id
  WHERE c.organization_id = _org_id
  GROUP BY c.organization_id, c.id, c.display_name, c.sensitivity_level, c.do_not_automate;

  -- Refresh read_home_summary
  INSERT INTO public.read_home_summary (
    organization_id,
    overdue_total, overdue_count,
    due_soon_total, due_soon_count,
    approvals_pending, replies_needing_attention,
    high_risk_client_count, automation_paused, refreshed_at
  )
  SELECT
    _org_id,
    COALESCE(SUM(CASE WHEN i.state = 'overdue' THEN i.remaining_balance ELSE 0 END), 0),
    COUNT(CASE WHEN i.state = 'overdue' THEN 1 END)::INT,
    COALESCE(SUM(CASE WHEN i.state IN ('due_soon','due_today') THEN i.remaining_balance ELSE 0 END), 0),
    COUNT(CASE WHEN i.state IN ('due_soon','due_today') THEN 1 END)::INT,
    (SELECT COUNT(*)::INT FROM public.approvals WHERE organization_id = _org_id AND status = 'pending'),
    (SELECT COUNT(*)::INT FROM public.inbound_messages WHERE organization_id = _org_id AND requires_manual_review = TRUE AND action_outcome IS NULL),
    (SELECT COUNT(*)::INT FROM public.clients WHERE organization_id = _org_id AND client_status = 'active'),
    COALESCE((SELECT (setting_value::TEXT)::BOOLEAN FROM public.organization_settings WHERE organization_id = _org_id AND setting_key = 'automation_paused' LIMIT 1), FALSE),
    now()
  FROM public.invoices i
  WHERE i.organization_id = _org_id AND i.state NOT IN ('cancelled','written_off')
  ON CONFLICT (organization_id) DO UPDATE SET
    overdue_total = EXCLUDED.overdue_total,
    overdue_count = EXCLUDED.overdue_count,
    due_soon_total = EXCLUDED.due_soon_total,
    due_soon_count = EXCLUDED.due_soon_count,
    approvals_pending = EXCLUDED.approvals_pending,
    replies_needing_attention = EXCLUDED.replies_needing_attention,
    high_risk_client_count = EXCLUDED.high_risk_client_count,
    automation_paused = EXCLUDED.automation_paused,
    refreshed_at = now();
END;
$$;

-- ─── 3. Mark invoice paid (records payment + allocates + transitions state + audit log) ───

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  _invoice_id UUID,
  _org_id UUID,
  _payment_amount NUMERIC DEFAULT NULL,
  _payment_method TEXT DEFAULT 'manual',
  _payment_date DATE DEFAULT CURRENT_DATE,
  _notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _inv RECORD;
  _payment_id UUID;
  _actual_amount NUMERIC;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _inv FROM public.invoices
  WHERE id = _invoice_id AND organization_id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  _actual_amount := COALESCE(_payment_amount, _inv.remaining_balance);

  -- Record payment
  INSERT INTO public.payments(
    organization_id, client_id, amount, currency,
    payment_date, payment_method, confidence, source,
    notes, created_by_user_id
  )
  VALUES (
    _org_id, _inv.client_id, _actual_amount, _inv.currency,
    _payment_date, _payment_method, 'confirmed', 'manual',
    _notes, _user_id
  )
  RETURNING id INTO _payment_id;

  -- Allocate payment to invoice
  INSERT INTO public.payment_allocations(
    organization_id, payment_id, invoice_id, allocated_amount,
    allocation_date, allocation_source, created_by_user_id
  )
  VALUES (
    _org_id, _payment_id, _invoice_id, _actual_amount,
    _payment_date, 'manual', _user_id
  )
  ON CONFLICT (payment_id, invoice_id) DO NOTHING;

  -- Update invoice state
  UPDATE public.invoices
  SET
    state = CASE WHEN _actual_amount >= remaining_balance THEN 'paid' ELSE 'partially_paid' END,
    remaining_balance = GREATEST(0, remaining_balance - _actual_amount),
    amount_paid = amount_paid + _actual_amount,
    paid_at = CASE WHEN _actual_amount >= remaining_balance THEN now() ELSE NULL END,
    last_action_taken_at = now(),
    updated_at = now()
  WHERE id = _invoice_id AND organization_id = _org_id;

  -- Write audit log
  PERFORM public.append_audit_log(
    _org_id, 'invoice', _invoice_id,
    'invoice_marked_paid',
    COALESCE(_notes, 'Invoice marked as paid manually'),
    'manual_payment',
    jsonb_build_object('state', _inv.state, 'remaining_balance', _inv.remaining_balance),
    jsonb_build_object('state', 'paid', 'remaining_balance', 0, 'payment_amount', _actual_amount)
  );

  -- Refresh read models
  PERFORM public.refresh_org_read_models(_org_id);
END;
$$;

-- ─── 4. Set invoice on hold / resume ───

CREATE OR REPLACE FUNCTION public.set_invoice_hold(
  _invoice_id UUID,
  _org_id UUID,
  _on_hold BOOLEAN,
  _reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _inv RECORD;
  _new_state TEXT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id AND organization_id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF _on_hold THEN
    _new_state := 'on_hold';
  ELSE
    -- Resume: go back to appropriate state based on due date
    IF CURRENT_DATE < _inv.due_date THEN _new_state := 'sent';
    ELSE _new_state := 'overdue';
    END IF;
  END IF;

  UPDATE public.invoices
  SET
    state = _new_state,
    on_hold_reason = CASE WHEN _on_hold THEN _reason ELSE NULL END,
    updated_at = now()
  WHERE id = _invoice_id AND organization_id = _org_id;

  PERFORM public.append_audit_log(
    _org_id, 'invoice', _invoice_id,
    CASE WHEN _on_hold THEN 'invoice_put_on_hold' ELSE 'invoice_resumed' END,
    COALESCE(_reason, CASE WHEN _on_hold THEN 'Invoice paused by user' ELSE 'Invoice resumed by user' END),
    CASE WHEN _on_hold THEN 'manual_hold' ELSE 'manual_resume' END,
    jsonb_build_object('state', _inv.state),
    jsonb_build_object('state', _new_state)
  );

  PERFORM public.refresh_org_read_models(_org_id);
END;
$$;

-- ─── 5. Set invoice dispute ───

CREATE OR REPLACE FUNCTION public.set_invoice_dispute(
  _invoice_id UUID,
  _org_id UUID,
  _dispute_active BOOLEAN,
  _dispute_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _inv RECORD;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id AND organization_id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  UPDATE public.invoices
  SET
    dispute_active = _dispute_active,
    dispute_reason = CASE WHEN _dispute_active THEN _dispute_reason ELSE NULL END,
    dispute_created_at = CASE WHEN _dispute_active AND NOT _inv.dispute_active THEN now() ELSE dispute_created_at END,
    state = CASE WHEN _dispute_active THEN 'disputed' ELSE CASE WHEN CURRENT_DATE > _inv.due_date THEN 'overdue' ELSE 'sent' END END,
    updated_at = now()
  WHERE id = _invoice_id AND organization_id = _org_id;

  PERFORM public.append_audit_log(
    _org_id, 'invoice', _invoice_id,
    CASE WHEN _dispute_active THEN 'dispute_created' ELSE 'dispute_resolved' END,
    COALESCE(_dispute_reason, CASE WHEN _dispute_active THEN 'Dispute raised by user' ELSE 'Dispute resolved' END),
    CASE WHEN _dispute_active THEN 'manual_dispute' ELSE 'dispute_resolved' END,
    jsonb_build_object('state', _inv.state, 'dispute_active', _inv.dispute_active),
    jsonb_build_object('state', CASE WHEN _dispute_active THEN 'disputed' ELSE 'overdue' END, 'dispute_active', _dispute_active)
  );

  PERFORM public.refresh_org_read_models(_org_id);
END;
$$;

-- ─── 6. Toggle automation pause (persisted to org_settings) ───

CREATE OR REPLACE FUNCTION public.toggle_automation_pause(
  _org_id UUID,
  _paused BOOLEAN,
  _reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  INSERT INTO public.organization_settings(organization_id, setting_key, setting_value, last_modified_by)
  VALUES (_org_id, 'automation_paused', to_jsonb(_paused), _user_id)
  ON CONFLICT (organization_id, setting_key) DO UPDATE
    SET setting_value = to_jsonb(_paused),
        last_modified_by = _user_id,
        updated_at = now();

  IF _paused THEN
    -- Cancel all queued workflow actions
    UPDATE public.workflow_actions
    SET status = 'cancelled', cancelled_reason = 'emergency_stop', cancelled_at = now()
    WHERE organization_id = _org_id AND status = 'queued';
  END IF;

  PERFORM public.append_audit_log(
    _org_id, 'organization', _org_id,
    CASE WHEN _paused THEN 'emergency_stop_activated' ELSE 'emergency_stop_deactivated' END,
    COALESCE(_reason, CASE WHEN _paused THEN 'Emergency stop activated by user' ELSE 'Automation resumed by user' END),
    CASE WHEN _paused THEN 'emergency_stop' ELSE 'resume_automation' END,
    jsonb_build_object('automation_paused', NOT _paused),
    jsonb_build_object('automation_paused', _paused)
  );

  -- Update read_home_summary.automation_paused
  UPDATE public.read_home_summary SET automation_paused = _paused, refreshed_at = now()
  WHERE organization_id = _org_id;
END;
$$;

-- ─── 7. Update organization fields ───

CREATE OR REPLACE FUNCTION public.update_org_fields(
  _org_id UUID,
  _display_name TEXT DEFAULT NULL,
  _timezone TEXT DEFAULT NULL,
  _default_currency TEXT DEFAULT NULL,
  _sender_email TEXT DEFAULT NULL,
  _sender_display_name TEXT DEFAULT NULL,
  _reply_to_address TEXT DEFAULT NULL,
  _brand_tone TEXT DEFAULT NULL,
  _custom_tone_instructions TEXT DEFAULT NULL,
  _business_hours_start TIME DEFAULT NULL,
  _business_hours_end TIME DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
      AND role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE public.organizations
  SET
    display_name         = COALESCE(_display_name, display_name),
    timezone             = COALESCE(_timezone, timezone),
    default_currency     = COALESCE(_default_currency, default_currency),
    sender_email         = COALESCE(_sender_email, sender_email),
    sender_display_name  = COALESCE(_sender_display_name, sender_display_name),
    reply_to_address     = COALESCE(_reply_to_address, reply_to_address),
    brand_tone           = COALESCE(_brand_tone, brand_tone),
    custom_tone_instructions = COALESCE(_custom_tone_instructions, custom_tone_instructions),
    business_hours_start = COALESCE(_business_hours_start, business_hours_start),
    business_hours_end   = COALESCE(_business_hours_end, business_hours_end),
    updated_at           = now()
  WHERE id = _org_id;
END;
$$;

-- ─── 8. Invite member by email ───

CREATE OR REPLACE FUNCTION public.invite_member_by_email(
  _org_id UUID,
  _email TEXT,
  _role TEXT DEFAULT 'finance_ops'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _target_user_id UUID;
  _token TEXT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Only owner/admin can invite
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
      AND role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Look up target user by email
  SELECT id INTO _target_user_id FROM public.profiles WHERE email = lower(trim(_email)) LIMIT 1;

  IF _target_user_id IS NULL THEN
    -- User doesn't exist yet — return a pending token they can use on signup
    _token := encode(gen_random_bytes(32), 'hex');
    -- Store invitation details in organization_settings for lookup later
    INSERT INTO public.organization_settings(organization_id, setting_key, setting_value, last_modified_by)
    VALUES (
      _org_id,
      'pending_invite_' || _token,
      jsonb_build_object('email', lower(trim(_email)), 'role', _role, 'invited_by', _user_id, 'expires_at', (now() + interval '48 hours')::text),
      _user_id
    )
    ON CONFLICT (organization_id, setting_key) DO NOTHING;
    RETURN 'pending:' || _token;
  END IF;

  -- User exists — create membership
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = _org_id AND user_id = _target_user_id AND status IN ('active','invited')
  ) THEN
    RAISE EXCEPTION 'User is already a member or has a pending invitation';
  END IF;

  _token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.memberships(
    organization_id, user_id, role, status,
    invited_by_user_id, invitation_token, invitation_expires_at
  )
  VALUES (
    _org_id, _target_user_id, _role, 'invited',
    _user_id, _token, now() + interval '48 hours'
  );

  RETURN 'invited:' || _token;
END;
$$;

-- ─── 9. Create invoice manually ───

CREATE OR REPLACE FUNCTION public.create_invoice_manual(
  _org_id UUID,
  _client_id UUID,
  _invoice_number TEXT,
  _amount NUMERIC,
  _currency TEXT DEFAULT 'USD',
  _due_date DATE DEFAULT NULL,
  _issue_date DATE DEFAULT CURRENT_DATE,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _invoice_id UUID;
  _due DATE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Not a member of this organization'; END IF;

  _due := COALESCE(_due_date, CURRENT_DATE + interval '30 days');

  INSERT INTO public.invoices(
    organization_id, client_id, invoice_number, amount, currency,
    remaining_balance, amount_paid, issue_date, due_date, state,
    days_until_due, source_system
  )
  VALUES(
    _org_id, _client_id, _invoice_number, _amount, _currency,
    _amount, 0, _issue_date, _due,
    CASE WHEN _due < CURRENT_DATE THEN 'overdue'
         WHEN _due = CURRENT_DATE THEN 'due_today'
         WHEN _due <= CURRENT_DATE + 7 THEN 'due_soon'
         ELSE 'sent' END,
    GREATEST(0, _due - CURRENT_DATE),
    'manual'
  )
  RETURNING id INTO _invoice_id;

  PERFORM public.append_audit_log(
    _org_id, 'invoice', _invoice_id,
    'invoice_created',
    COALESCE(_notes, 'Invoice created manually'),
    'manual_create',
    NULL,
    jsonb_build_object('invoice_number', _invoice_number, 'amount', _amount, 'due_date', _due)
  );

  PERFORM public.refresh_org_read_models(_org_id);

  RETURN _invoice_id;
END;
$$;

-- ─── 10. Create client manually ───

CREATE OR REPLACE FUNCTION public.create_client_manual(
  _org_id UUID,
  _display_name TEXT,
  _legal_name TEXT DEFAULT NULL,
  _sensitivity_level TEXT DEFAULT 'standard',
  _preferred_channel TEXT DEFAULT 'email',
  _contact_full_name TEXT DEFAULT NULL,
  _contact_email TEXT DEFAULT NULL,
  _contact_phone TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _client_id UUID;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Not a member of this organization'; END IF;

  INSERT INTO public.clients(
    organization_id, display_name, legal_name,
    sensitivity_level, preferred_channel, notes,
    account_owner_user_id, source_system
  )
  VALUES(
    _org_id, _display_name, _legal_name,
    _sensitivity_level, _preferred_channel, _notes,
    _user_id, 'manual'
  )
  RETURNING id INTO _client_id;

  -- Add primary contact if provided
  IF _contact_email IS NOT NULL OR _contact_full_name IS NOT NULL THEN
    INSERT INTO public.client_contacts(
      organization_id, client_id, full_name, email, phone,
      contact_role, is_primary, escalation_order
    )
    VALUES(
      _org_id, _client_id,
      COALESCE(_contact_full_name, _display_name),
      _contact_email, _contact_phone,
      'primary_billing', TRUE, 1
    );
  END IF;

  PERFORM public.append_audit_log(
    _org_id, 'client', _client_id,
    'client_created',
    'Client created manually',
    'manual_create',
    NULL,
    jsonb_build_object('display_name', _display_name)
  );

  PERFORM public.refresh_org_read_models(_org_id);

  RETURN _client_id;
END;
$$;

-- ─── 11. Process CSV import rows ───

CREATE OR REPLACE FUNCTION public.process_csv_import(
  _org_id UUID,
  _import_batch_id UUID,
  _rows JSONB  -- array of {client_name, invoice_number, amount, currency, due_date, contact_email, contact_name, issue_date, notes}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _row JSONB;
  _client_id UUID;
  _invoice_id UUID;
  _contact_email TEXT;
  _client_name TEXT;
  _invoice_number TEXT;
  _amount NUMERIC;
  _currency TEXT;
  _due_date DATE;
  _issue_date DATE;
  _successful INT := 0;
  _failed INT := 0;
  _duplicate INT := 0;
  _errors JSONB := '[]'::JSONB;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    BEGIN
      _client_name    := trim(_row->>'client_name');
      _invoice_number := trim(_row->>'invoice_number');
      _amount         := (_row->>'amount')::NUMERIC;
      _currency       := UPPER(COALESCE(trim(_row->>'currency'), 'USD'));
      _due_date       := (_row->>'due_date')::DATE;
      _issue_date     := CASE WHEN _row->>'issue_date' IS NOT NULL AND _row->>'issue_date' != ''
                              THEN (_row->>'issue_date')::DATE ELSE CURRENT_DATE END;
      _contact_email  := lower(trim(COALESCE(_row->>'contact_email', '')));

      -- Validate required fields
      IF _client_name IS NULL OR length(_client_name) = 0 THEN
        RAISE EXCEPTION 'Missing client_name';
      END IF;
      IF _amount IS NULL OR _amount <= 0 THEN
        RAISE EXCEPTION 'Invalid amount';
      END IF;
      IF _due_date IS NULL THEN
        RAISE EXCEPTION 'Invalid due_date';
      END IF;

      -- Check for duplicate invoice
      IF _invoice_number IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.invoices
        WHERE organization_id = _org_id AND invoice_number = _invoice_number
          AND source_system = 'csv'
      ) THEN
        _duplicate := _duplicate + 1;
        CONTINUE;
      END IF;

      -- Find or create client
      SELECT id INTO _client_id FROM public.clients
      WHERE organization_id = _org_id
        AND lower(display_name) = lower(_client_name)
        AND client_status = 'active'
      LIMIT 1;

      IF _client_id IS NULL THEN
        INSERT INTO public.clients(
          organization_id, display_name, source_system, import_batch_id
        )
        VALUES (_org_id, _client_name, 'csv', _import_batch_id)
        RETURNING id INTO _client_id;

        -- Add contact if email provided
        IF length(_contact_email) > 0 THEN
          INSERT INTO public.client_contacts(
            organization_id, client_id, full_name, email,
            contact_role, is_primary, escalation_order, source_system
          )
          VALUES(
            _org_id, _client_id,
            COALESCE(trim(_row->>'contact_name'), _client_name),
            _contact_email,
            'primary_billing', TRUE, 1, 'csv'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      -- Create invoice
      INSERT INTO public.invoices(
        organization_id, client_id, invoice_number, amount, currency,
        remaining_balance, amount_paid, issue_date, due_date,
        state, days_until_due, source_system, import_batch_id
      )
      VALUES(
        _org_id, _client_id, _invoice_number, _amount, _currency,
        _amount, 0, _issue_date, _due_date,
        CASE WHEN _due_date < CURRENT_DATE THEN 'overdue'
             WHEN _due_date = CURRENT_DATE THEN 'due_today'
             WHEN _due_date <= CURRENT_DATE + 7 THEN 'due_soon'
             ELSE 'sent' END,
        GREATEST(0, _due_date - CURRENT_DATE),
        'csv', _import_batch_id
      )
      RETURNING id INTO _invoice_id;

      _successful := _successful + 1;

    EXCEPTION WHEN OTHERS THEN
      _failed := _failed + 1;
      _errors := _errors || jsonb_build_object(
        'row', _row,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- Update import batch status
  UPDATE public.import_batches
  SET
    status = CASE WHEN _failed > 0 AND _successful = 0 THEN 'failed'
                  WHEN _failed > 0 THEN 'partial'
                  ELSE 'completed' END,
    successful_rows = _successful,
    failed_rows = _failed,
    duplicate_rows = _duplicate,
    validation_errors = _errors
  WHERE id = _import_batch_id AND organization_id = _org_id;

  PERFORM public.refresh_org_read_models(_org_id);

  RETURN jsonb_build_object(
    'successful', _successful,
    'failed', _failed,
    'duplicates', _duplicate,
    'errors', _errors
  );
END;
$$;

-- ─── 12. Submit support case ───

CREATE OR REPLACE FUNCTION public.submit_support_case(
  _org_id UUID,
  _description TEXT,
  _case_type TEXT DEFAULT NULL,
  _entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _case_id UUID;
  _recent_audit JSONB;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Not a member of this organization'; END IF;

  -- Gather last 10 audit entries for context
  SELECT jsonb_agg(row_to_json(a.*)) INTO _recent_audit
  FROM (
    SELECT id, action_type, entity_type, entity_id, reason, occurred_at
    FROM public.audit_logs
    WHERE organization_id = _org_id
      AND (_entity_id IS NULL OR entity_id = _entity_id)
    ORDER BY occurred_at DESC
    LIMIT 10
  ) a;

  INSERT INTO public.support_cases(
    organization_id, created_by_user_id, case_type, status, description,
    auto_attached_context
  )
  VALUES(
    _org_id, _user_id, _case_type, 'open', _description,
    jsonb_build_object(
      'organization_id', _org_id,
      'entity_type', _entity_type,
      'entity_id', _entity_id,
      'recent_audit_logs', COALESCE(_recent_audit, '[]'::JSONB)
    )
  )
  RETURNING id INTO _case_id;

  RETURN _case_id;
END;
$$;

-- ─── 13. RLS additions for write operations ───

-- Allow organization members to INSERT audit logs via RPC (already covered by security definer)
-- Allow members to INSERT notifications for their org
CREATE POLICY "Members can insert org notifications" ON public.notifications FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Allow members to upsert read model tables (maintained by RPCs)
ALTER TABLE public.read_invoice_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_client_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_home_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage read_invoice_list" ON public.read_invoice_list
  FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can manage read_client_summary" ON public.read_client_summary
  FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE POLICY "Members can manage read_home_summary" ON public.read_home_summary
  FOR ALL USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Allow org members to insert payments and payment_allocations
CREATE POLICY "Members can insert org payments" ON public.payments FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org payment_allocations" ON public.payment_allocations FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Allow members to create invoices
CREATE POLICY "Members can insert org invoices" ON public.invoices FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Allow members to create clients and contacts
CREATE POLICY "Members can insert org clients" ON public.clients FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org client_contacts" ON public.client_contacts FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Allow members to insert import_batches
CREATE POLICY "Members can insert org import_batches" ON public.import_batches FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update own import_batches" ON public.import_batches FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Add profile email column for invite lookup (profiles may not have email — add it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
    -- Backfill from auth.users if possible (security definer context)
  END IF;
END;
$$;

-- Trigger to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_email_update'
  ) THEN
    CREATE TRIGGER on_auth_user_email_update
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();
  END IF;
END;
$$;

-- Backfill emails from auth.users into profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;


-- ============================================================
-- MIGRATION: Integration sync trigger RPC + source precedence
-- ============================================================

-- ─── 1. trigger_integration_sync: create sync_run + invoke edge function ───

CREATE OR REPLACE FUNCTION public.trigger_integration_sync(
  _org_id        UUID,
  _integration_id UUID,
  _sync_type     TEXT DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _run_id  UUID;
  _provider TEXT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Verify membership
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get provider
  SELECT provider INTO _provider FROM public.integrations
  WHERE id = _integration_id AND organization_id = _org_id;

  IF _provider IS NULL THEN
    RAISE EXCEPTION 'Integration not found';
  END IF;

  -- Create sync_run record
  INSERT INTO public.sync_runs(
    organization_id, integration_id, provider, sync_type,
    status, started_at
  )
  VALUES (
    _org_id, _integration_id, _provider, _sync_type,
    'running', NOW()
  )
  RETURNING id INTO _run_id;

  -- Update integration last_attempted_sync_at
  UPDATE public.integrations
  SET last_attempted_sync_at = NOW()
  WHERE id = _integration_id AND organization_id = _org_id;

  -- In production, invoke the edge function via pg_net:
  -- PERFORM net.http_post(
  --   url  := current_setting('app.edge_function_url') || '/sync-integration',
  --   body := jsonb_build_object(
  --     'sync_run_id', _run_id, 'integration_id', _integration_id,
  --     'organization_id', _org_id, 'provider', _provider
  --   )::text,
  --   headers := jsonb_build_object('Content-Type','application/json')
  -- );
  --
  -- For now, the UI polls sync_run status and the edge function
  -- is invoked client-side via supabase.functions.invoke().

  PERFORM public.append_audit_log(
    _org_id, 'integration', _integration_id,
    'sync_triggered',
    format('Manual sync triggered for %s', _provider),
    'manual_sync',
    NULL,
    jsonb_build_object('sync_run_id', _run_id, 'provider', _provider)
  );

  RETURN _run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_integration_sync TO authenticated;

-- ─── 2. get_sync_runs: recent sync history per integration ───

CREATE OR REPLACE FUNCTION public.get_sync_runs(
  _org_id         UUID,
  _integration_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id                UUID,
  integration_id    UUID,
  provider          TEXT,
  sync_type         TEXT,
  status            TEXT,
  records_processed INT,
  records_created   INT,
  records_updated   INT,
  records_failed    INT,
  error_summary     JSONB,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    id, integration_id, provider, sync_type, status,
    records_processed, records_created, records_updated, records_failed,
    error_summary, started_at, completed_at
  FROM public.sync_runs
  WHERE organization_id = _org_id
    AND ((_integration_id IS NULL) OR integration_id = _integration_id)
  ORDER BY started_at DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.get_sync_runs TO authenticated;

-- ─── 3. source_precedence config per org ───
-- Defines which source "wins" when the same invoice exists in multiple sources.
-- Higher number = higher authority.

CREATE TABLE IF NOT EXISTS public.source_precedence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_system    TEXT NOT NULL,
  precedence_level INT  NOT NULL DEFAULT 50,  -- 1-100 (higher = more authoritative)
  is_authoritative BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, source_system)
);

-- Seed default precedence rules (applied on first sync trigger per org)
CREATE OR REPLACE FUNCTION public.ensure_default_precedence(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.source_precedence(organization_id, source_system, precedence_level, is_authoritative)
  VALUES
    (_org_id, 'quickbooks', 90, TRUE),
    (_org_id, 'xero',       90, TRUE),
    (_org_id, 'freshbooks', 85, TRUE),
    (_org_id, 'stripe',     75, FALSE),
    (_org_id, 'paypal',     70, FALSE),
    (_org_id, 'gmail',      30, FALSE),
    (_org_id, 'outlook',    30, FALSE),
    (_org_id, 'csv',        20, FALSE),
    (_org_id, 'manual',     10, FALSE)
  ON CONFLICT (organization_id, source_system) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_precedence TO authenticated;

ALTER TABLE public.source_precedence ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_precedence_org ON public.source_precedence
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── 4. resolve_source_conflict: apply precedence rules to conflicting imports ───

CREATE OR REPLACE FUNCTION public.resolve_source_conflict(
  _org_id          UUID,
  _invoice_id      UUID,             -- Existing canonical invoice
  _incoming_source TEXT,             -- Source trying to update
  _incoming_fields JSONB             -- Fields from the incoming source
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing_source TEXT;
  _existing_prec   INT;
  _incoming_prec   INT;
  _conflict_id     UUID;
BEGIN
  -- Get existing invoice's source
  SELECT source_system INTO _existing_source
  FROM public.invoices WHERE id = _invoice_id AND organization_id = _org_id;

  -- Get precedence levels
  SELECT COALESCE(precedence_level, 50) INTO _existing_prec
  FROM public.source_precedence
  WHERE organization_id = _org_id AND source_system = _existing_source;

  SELECT COALESCE(precedence_level, 50) INTO _incoming_prec
  FROM public.source_precedence
  WHERE organization_id = _org_id AND source_system = _incoming_source;

  IF _incoming_prec >= _existing_prec THEN
    -- Incoming wins: update canonical record
    UPDATE public.invoices SET
      remaining_balance = COALESCE((_incoming_fields->>'remaining_balance')::NUMERIC, remaining_balance),
      amount_paid       = COALESCE((_incoming_fields->>'amount_paid')::NUMERIC, amount_paid),
      state             = COALESCE(_incoming_fields->>'state', state),
      source_system     = CASE WHEN _incoming_prec > _existing_prec
                               THEN _incoming_source ELSE source_system END,
      last_synced_at    = NOW()
    WHERE id = _invoice_id AND organization_id = _org_id;

    RETURN jsonb_build_object(
      'action', 'updated',
      'winner', _incoming_source,
      'incoming_precedence', _incoming_prec,
      'existing_precedence', _existing_prec
    );
  ELSE
    -- Existing wins: create an exception for review (don't overwrite)
    INSERT INTO public.import_exceptions(
      organization_id,
      import_batch_id,
      exception_type,
      severity,
      reason,
      suggested_remediation,
      can_fix_in_ui,
      requires_reprocessing
    )
    SELECT
      _org_id,
      b.id,
      'source_conflict',
      'warning',
      format('%s data conflicts with existing %s record. Existing record is higher authority.',
             _incoming_source, _existing_source),
      format('Review incoming %s data and decide whether to override the %s record.',
             _incoming_source, _existing_source),
      TRUE,
      FALSE
    FROM public.import_batches b
    WHERE b.organization_id = _org_id
    ORDER BY b.created_at DESC
    LIMIT 1
    RETURNING id INTO _conflict_id;

    RETURN jsonb_build_object(
      'action', 'conflict_queued',
      'winner', _existing_source,
      'incoming_precedence', _incoming_prec,
      'existing_precedence', _existing_prec,
      'exception_id', _conflict_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_source_conflict TO authenticated;

-- ─── 5. Update commit_staged_import to check source precedence ───

CREATE OR REPLACE FUNCTION public.commit_staged_import(
  _org_id          UUID,
  _import_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id         UUID := auth.uid();
  _cand            RECORD;
  _client_id       UUID;
  _invoice_id      UUID;
  _committed       INT  := 0;
  _skipped         INT  := 0;
  _conflicts       INT  := 0;
  _batch_source    TEXT;
  _existing_inv    RECORD;
  _incoming_prec   INT;
  _existing_prec   INT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  -- Ensure default precedence rules exist
  PERFORM public.ensure_default_precedence(_org_id);

  -- Get batch source type
  SELECT import_type INTO _batch_source
  FROM public.import_batches WHERE id = _import_batch_id AND organization_id = _org_id;

  FOR _cand IN
    SELECT * FROM public.invoice_candidates
    WHERE import_batch_id = _import_batch_id
      AND organization_id = _org_id
      AND validation_status IN ('valid', 'warning')
      AND commit_status = 'pending'
    ORDER BY created_at
  LOOP
    BEGIN
      -- Check if invoice already exists from any source
      SELECT i.id, i.source_system INTO _existing_inv
      FROM public.invoices i
      WHERE i.organization_id = _org_id
        AND (
          (i.invoice_number IS NOT NULL AND i.invoice_number = _cand.invoice_number)
          OR (i.source_system = _cand.source_system AND i.source_record_id = _cand.source_record_id
              AND _cand.source_record_id IS NOT NULL)
        )
      LIMIT 1;

      IF _existing_inv.id IS NOT NULL THEN
        -- Conflict: check source precedence
        SELECT COALESCE(precedence_level, 50) INTO _incoming_prec
        FROM public.source_precedence
        WHERE organization_id = _org_id AND source_system = COALESCE(_cand.source_system, _batch_source, 'csv');

        SELECT COALESCE(precedence_level, 50) INTO _existing_prec
        FROM public.source_precedence
        WHERE organization_id = _org_id AND source_system = _existing_inv.source_system;

        IF _incoming_prec >= _existing_prec THEN
          -- Incoming wins: update the existing record
          UPDATE public.invoices SET
            remaining_balance = COALESCE(_cand.remaining_balance, remaining_balance),
            amount_paid       = COALESCE(_cand.amount_paid, amount_paid),
            state             = CASE WHEN _cand.due_date < CURRENT_DATE THEN 'overdue'
                                     WHEN _cand.due_date = CURRENT_DATE THEN 'due_today'
                                     WHEN _cand.due_date <= CURRENT_DATE + 7 THEN 'due_soon'
                                     ELSE 'sent' END,
            last_synced_at    = NOW()
          WHERE id = _existing_inv.id;

          UPDATE public.invoice_candidates
          SET commit_status        = 'committed',
              committed_invoice_id = _existing_inv.id,
              committed_at         = NOW()
          WHERE id = _cand.id;
          _committed := _committed + 1;
        ELSE
          -- Existing wins: queue exception
          INSERT INTO public.import_exceptions(
            organization_id, import_batch_id, candidate_id,
            exception_type, severity, reason, suggested_remediation,
            can_fix_in_ui, requires_reprocessing
          ) VALUES (
            _org_id, _import_batch_id, _cand.id,
            'source_conflict', 'warning',
            format('Invoice %s already exists (from %s). Incoming %s source has lower authority.',
                   COALESCE(_cand.invoice_number, 'unknown'), _existing_inv.source_system,
                   COALESCE(_cand.source_system, _batch_source, 'csv')),
            'Review this conflict in the exception queue. Override if the incoming data is more accurate.',
            TRUE, FALSE
          );

          UPDATE public.invoice_candidates SET commit_status = 'skipped' WHERE id = _cand.id;
          _conflicts := _conflicts + 1;
        END IF;
        CONTINUE;
      END IF;

      -- No conflict: proceed with normal commit

      -- Find or create client
      SELECT id INTO _client_id FROM public.clients
      WHERE organization_id = _org_id
        AND lower(display_name) = lower(_cand.client_name)
        AND client_status = 'active'
      LIMIT 1;

      IF _client_id IS NULL THEN
        INSERT INTO public.clients(
          organization_id, display_name, source_system, import_batch_id
        )
        VALUES (_org_id, _cand.client_name,
                COALESCE(_cand.source_system, _batch_source, 'csv'),
                _import_batch_id)
        RETURNING id INTO _client_id;

        IF _cand.billing_contact_email IS NOT NULL
           AND length(_cand.billing_contact_email) > 3 THEN
          INSERT INTO public.client_contacts(
            organization_id, client_id, full_name, email, phone,
            contact_role, is_primary, escalation_order, source_system
          )
          VALUES (
            _org_id, _client_id,
            COALESCE(_cand.billing_contact_name, _cand.client_name),
            _cand.billing_contact_email,
            _cand.billing_contact_phone,
            'primary_billing', TRUE, 1,
            COALESCE(_cand.source_system, _batch_source, 'csv')
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      -- Create invoice
      INSERT INTO public.invoices(
        organization_id, client_id,
        invoice_number, external_id, amount, currency,
        remaining_balance, amount_paid,
        issue_date, due_date,
        state, days_until_due,
        source_system, source_record_id, import_batch_id, notes
      )
      VALUES (
        _org_id, _client_id,
        _cand.invoice_number, _cand.external_invoice_id,
        _cand.total_amount, _cand.currency,
        COALESCE(_cand.remaining_balance, _cand.total_amount),
        COALESCE(_cand.amount_paid, 0),
        COALESCE(_cand.issue_date, CURRENT_DATE),
        _cand.due_date,
        CASE WHEN _cand.due_date < CURRENT_DATE THEN 'overdue'
             WHEN _cand.due_date = CURRENT_DATE THEN 'due_today'
             WHEN _cand.due_date <= CURRENT_DATE + 7 THEN 'due_soon'
             ELSE 'sent' END,
        GREATEST(0, _cand.due_date - CURRENT_DATE),
        COALESCE(_cand.source_system, _batch_source, 'csv'),
        _cand.source_record_id,
        _import_batch_id, _cand.notes
      )
      RETURNING id INTO _invoice_id;

      UPDATE public.invoice_candidates
      SET commit_status        = 'committed',
          committed_invoice_id = _invoice_id,
          committed_client_id  = _client_id,
          committed_at         = NOW()
      WHERE id = _cand.id;

      _committed := _committed + 1;
    EXCEPTION WHEN OTHERS THEN
      _skipped := _skipped + 1;
    END;
  END LOOP;

  UPDATE public.import_batches
  SET status          = CASE WHEN _committed > 0 THEN 'completed' ELSE 'failed' END,
      successful_rows = _committed,
      duplicate_rows  = _skipped + _conflicts,
      updated_at      = NOW()
  WHERE id = _import_batch_id AND organization_id = _org_id;

  PERFORM public.refresh_org_read_models(_org_id);

  RETURN jsonb_build_object(
    'committed',  _committed,
    'skipped',    _skipped,
    'conflicts',  _conflicts
  );
END;
$$;

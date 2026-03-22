
-- ============================================================
-- MIGRATION: Full Ingestion Pipeline
-- Staging tables, exception queue, mapping templates, and
-- pipeline RPCs that implement the spec architecture:
--   raw capture → normalization → staging → validation →
--   exception routing → canonical commit
-- ============================================================

-- ─── 1. Raw import records (per-row raw data preservation) ───

CREATE TABLE IF NOT EXISTS public.raw_import_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_batch_id      UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_index            INT  NOT NULL,
  raw_column_names     TEXT[] NOT NULL DEFAULT '{}',
  raw_values           JSONB NOT NULL DEFAULT '{}',
  parser_warnings      JSONB NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_import_records_batch
  ON public.raw_import_records(import_batch_id);

ALTER TABLE public.raw_import_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY raw_import_records_org_select ON public.raw_import_records
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── 2. Invoice candidates (normalized staging before canonical write) ───

CREATE TABLE IF NOT EXISTS public.invoice_candidates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_batch_id          UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  raw_record_id            UUID REFERENCES public.raw_import_records(id),
  source_type              TEXT NOT NULL DEFAULT 'csv',
  source_system            TEXT,
  source_record_id         TEXT,
  external_invoice_id      TEXT,
  invoice_number           TEXT,
  client_name              TEXT,
  client_legal_name        TEXT,
  billing_contact_name     TEXT,
  billing_contact_email    TEXT,
  billing_contact_phone    TEXT,
  issue_date               DATE,
  due_date                 DATE,
  payment_terms            TEXT,
  currency                 CHAR(3),
  subtotal_amount          NUMERIC(15,2),
  tax_amount               NUMERIC(15,2),
  total_amount             NUMERIC(15,2),
  amount_paid              NUMERIC(15,2),
  remaining_balance        NUMERIC(15,2),
  status_raw               TEXT,
  payment_link             TEXT,
  notes                    TEXT,
  custom_attributes        JSONB NOT NULL DEFAULT '{}',
  mapping_confidence       TEXT NOT NULL DEFAULT 'low',  -- high, medium, low
  mapping_version          INT  NOT NULL DEFAULT 1,
  normalization_status     TEXT NOT NULL DEFAULT 'pending', -- pending, normalized, failed
  validation_status        TEXT NOT NULL DEFAULT 'pending', -- pending, valid, invalid, warning
  validation_messages      JSONB NOT NULL DEFAULT '[]',
  commit_status            TEXT NOT NULL DEFAULT 'pending', -- pending, committed, skipped
  committed_invoice_id     UUID REFERENCES public.invoices(id),
  committed_client_id      UUID REFERENCES public.clients(id),
  committed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_candidates_batch
  ON public.invoice_candidates(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_invoice_candidates_org
  ON public.invoice_candidates(organization_id);

ALTER TABLE public.invoice_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_candidates_org_select ON public.invoice_candidates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── 3. Import exceptions (exception queue) ───

CREATE TABLE IF NOT EXISTS public.import_exceptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_batch_id        UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  raw_record_id          UUID REFERENCES public.raw_import_records(id),
  candidate_id           UUID REFERENCES public.invoice_candidates(id),
  exception_type         TEXT NOT NULL,
  -- missing_critical_field | ambiguous_mapping | duplicate_candidate |
  -- conflicting_amounts | impossible_date | invalid_email |
  -- unmatched_client | unresolved_currency | status_inconsistency |
  -- attachment_parse_failure | source_conflict
  severity               TEXT NOT NULL DEFAULT 'error', -- error, warning, info
  field_name             TEXT,
  reason                 TEXT NOT NULL,
  suggested_remediation  TEXT,
  can_fix_in_ui          BOOLEAN NOT NULL DEFAULT TRUE,
  requires_reprocessing  BOOLEAN NOT NULL DEFAULT FALSE,
  status                 TEXT NOT NULL DEFAULT 'open', -- open, resolved, ignored
  resolution_action      TEXT,  -- fixed, merged, ignored, skipped
  resolution_values      JSONB,
  resolved_at            TIMESTAMPTZ,
  resolved_by_user_id    UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_exceptions_batch
  ON public.import_exceptions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_exceptions_org_open
  ON public.import_exceptions(organization_id, status)
  WHERE status = 'open';

ALTER TABLE public.import_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_exceptions_org_select ON public.import_exceptions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── 4. Mapping templates (tenant mapping memory) ───

CREATE TABLE IF NOT EXISTS public.mapping_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type          TEXT NOT NULL DEFAULT 'csv',
  source_instance_id   UUID REFERENCES public.integrations(id),
  template_name        TEXT NOT NULL,
  header_signature     TEXT NOT NULL,  -- sorted/joined column names as fingerprint
  column_mappings      JSONB NOT NULL DEFAULT '[]',
  -- [{source_col, canonical_field, transform, confidence}]
  date_format_hint     TEXT,
  default_currency     CHAR(3),
  ignored_columns      TEXT[] NOT NULL DEFAULT '{}',
  custom_field_mappings JSONB NOT NULL DEFAULT '[]',
  template_version     INT  NOT NULL DEFAULT 1,
  times_used           INT  NOT NULL DEFAULT 0,
  last_used_at         TIMESTAMPTZ,
  created_by_user_id   UUID REFERENCES public.profiles(id),
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapping_templates_org_source
  ON public.mapping_templates(organization_id, source_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mapping_templates_org_header
  ON public.mapping_templates(organization_id, source_type, header_signature)
  WHERE source_instance_id IS NULL;

ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY mapping_templates_org_select ON public.mapping_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── 5. stage_csv_import RPC ───
-- Accepts raw rows + confirmed column mapping.
-- Preserves raw data, normalizes values, validates, creates candidates and exceptions.
-- Does NOT write to canonical tables.

CREATE OR REPLACE FUNCTION public.stage_csv_import(
  _org_id             UUID,
  _import_batch_id    UUID,
  _rows               JSONB,    -- array of raw row objects (original column names)
  _column_mapping     JSONB,    -- {source_col: canonical_field, ...}
  _date_format_hint   TEXT DEFAULT NULL,  -- 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | null=auto
  _default_currency   TEXT DEFAULT 'USD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id     UUID := auth.uid();
  _row         JSONB;
  _row_idx     INT  := 0;
  _raw_id      UUID;
  _cand_id     UUID;

  -- candidate field vars
  _invoice_number       TEXT;
  _client_name          TEXT;
  _contact_name         TEXT;
  _contact_email        TEXT;
  _contact_phone        TEXT;
  _issue_date_raw       TEXT;
  _due_date_raw         TEXT;
  _amount_raw           TEXT;
  _amount_paid_raw      TEXT;
  _remaining_raw        TEXT;
  _currency_raw         TEXT;
  _status_raw           TEXT;
  _notes_raw            TEXT;
  _payment_terms_raw    TEXT;

  _issue_date           DATE;
  _due_date             DATE;
  _total_amount         NUMERIC;
  _amount_paid          NUMERIC;
  _remaining_balance    NUMERIC;
  _currency             CHAR(3);

  _mapping_conf         TEXT;
  _valid_status         TEXT;
  _val_messages         JSONB;

  _staged     INT := 0;
  _excepted   INT := 0;
  _skipped    INT := 0;
  _errors     JSONB := '[]'::JSONB;

  -- helper to resolve a source col value from the row using mapping
  _src_col     TEXT;
  _raw_val     TEXT;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Verify user has access to this org
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update batch to processing
  UPDATE public.import_batches
  SET status = 'processing', total_rows = jsonb_array_length(_rows)
  WHERE id = _import_batch_id AND organization_id = _org_id;

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    BEGIN
      _row_idx := _row_idx + 1;

      -- ── Preserve raw record ──
      INSERT INTO public.raw_import_records(
        organization_id, import_batch_id, row_index,
        raw_column_names, raw_values
      )
      SELECT
        _org_id, _import_batch_id, _row_idx,
        ARRAY(SELECT jsonb_object_keys(_row)),
        _row
      RETURNING id INTO _raw_id;

      -- ── Extract fields using column mapping ──
      -- Helper: for each canonical field, find which source column maps to it
      _invoice_number    := NULL;
      _client_name       := NULL;
      _contact_name      := NULL;
      _contact_email     := NULL;
      _contact_phone     := NULL;
      _issue_date_raw    := NULL;
      _due_date_raw      := NULL;
      _amount_raw        := NULL;
      _amount_paid_raw   := NULL;
      _remaining_raw     := NULL;
      _currency_raw      := NULL;
      _status_raw        := NULL;
      _notes_raw         := NULL;
      _payment_terms_raw := NULL;

      -- Iterate mapping to extract values
      FOR _src_col, _raw_val IN
        SELECT key, _row ->> key
        FROM jsonb_each_text(_column_mapping)
        -- key = canonical field, value = source column name
      LOOP
        -- _src_col is canonical_field, _raw_val is source column name
        -- Get actual value from row using source column name
        DECLARE _actual_val TEXT := trim(_row ->> _raw_val);
        BEGIN
          CASE _src_col
            WHEN 'invoice_number'    THEN _invoice_number    := _actual_val;
            WHEN 'client_name'       THEN _client_name       := _actual_val;
            WHEN 'contact_name'      THEN _contact_name      := _actual_val;
            WHEN 'contact_email'     THEN _contact_email     := lower(trim(_actual_val));
            WHEN 'contact_phone'     THEN _contact_phone     := _actual_val;
            WHEN 'issue_date'        THEN _issue_date_raw    := _actual_val;
            WHEN 'due_date'          THEN _due_date_raw      := _actual_val;
            WHEN 'amount'            THEN _amount_raw        := _actual_val;
            WHEN 'amount_paid'       THEN _amount_paid_raw   := _actual_val;
            WHEN 'remaining_balance' THEN _remaining_raw     := _actual_val;
            WHEN 'currency'          THEN _currency_raw      := _actual_val;
            WHEN 'status'            THEN _status_raw        := _actual_val;
            WHEN 'notes'             THEN _notes_raw         := _actual_val;
            WHEN 'payment_terms'     THEN _payment_terms_raw := _actual_val;
            ELSE NULL;
          END CASE;
        END;
      END LOOP;

      -- ── Normalize values ──

      -- Currency
      _currency := UPPER(COALESCE(
        CASE
          WHEN _currency_raw ~ '^[A-Za-z]{3}$' THEN trim(_currency_raw)
          WHEN _currency_raw = '$'  THEN 'USD'
          WHEN _currency_raw = '£'  THEN 'GBP'
          WHEN _currency_raw = '€'  THEN 'EUR'
          WHEN _currency_raw = 'A$' THEN 'AUD'
          WHEN _currency_raw = 'C$' THEN 'CAD'
          ELSE NULL
        END,
        _default_currency,
        'USD'
      ));

      -- Amount (strip symbols, commas)
      _total_amount := CASE
        WHEN _amount_raw IS NULL OR _amount_raw = '' THEN NULL
        ELSE (regexp_replace(_amount_raw, '[^0-9.\-]', '', 'g'))::NUMERIC
      END;

      _amount_paid := CASE
        WHEN _amount_paid_raw IS NULL OR _amount_paid_raw = '' THEN 0
        ELSE (regexp_replace(_amount_paid_raw, '[^0-9.\-]', '', 'g'))::NUMERIC
      END;

      _remaining_balance := CASE
        WHEN _remaining_raw IS NULL OR _remaining_raw = '' THEN NULL
        WHEN _total_amount IS NOT NULL THEN _total_amount - COALESCE(_amount_paid, 0)
        ELSE (regexp_replace(_remaining_raw, '[^0-9.\-]', '', 'g'))::NUMERIC
      END;

      -- Dates (try multiple formats)
      _issue_date := CASE
        WHEN _issue_date_raw IS NULL OR _issue_date_raw = '' THEN NULL
        WHEN _date_format_hint = 'MM/DD/YYYY'
          THEN to_date(_issue_date_raw, 'MM/DD/YYYY')
        WHEN _date_format_hint = 'DD/MM/YYYY'
          THEN to_date(_issue_date_raw, 'DD/MM/YYYY')
        ELSE -- auto-detect
          COALESCE(
            (CASE WHEN _issue_date_raw ~ '^\d{4}-\d{2}-\d{2}$'
                  THEN _issue_date_raw::DATE ELSE NULL END),
            (CASE WHEN _issue_date_raw ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                  THEN to_date(_issue_date_raw, 'MM/DD/YYYY') ELSE NULL END),
            (CASE WHEN _issue_date_raw ~ '^\d{1,2}-\d{1,2}-\d{4}$'
                  THEN to_date(_issue_date_raw, 'MM-DD-YYYY') ELSE NULL END)
          )
      END;

      _due_date := CASE
        WHEN _due_date_raw IS NULL OR _due_date_raw = '' THEN NULL
        WHEN _date_format_hint = 'MM/DD/YYYY'
          THEN to_date(_due_date_raw, 'MM/DD/YYYY')
        WHEN _date_format_hint = 'DD/MM/YYYY'
          THEN to_date(_due_date_raw, 'DD/MM/YYYY')
        ELSE
          COALESCE(
            (CASE WHEN _due_date_raw ~ '^\d{4}-\d{2}-\d{2}$'
                  THEN _due_date_raw::DATE ELSE NULL END),
            (CASE WHEN _due_date_raw ~ '^\d{1,2}/\d{1,2}/\d{4}$'
                  THEN to_date(_due_date_raw, 'MM/DD/YYYY') ELSE NULL END),
            (CASE WHEN _due_date_raw ~ '^\d{1,2}-\d{1,2}-\d{4}$'
                  THEN to_date(_due_date_raw, 'MM-DD-YYYY') ELSE NULL END)
          )
      END;

      -- ── Validation ──
      _val_messages := '[]'::JSONB;
      _valid_status := 'valid';

      IF _client_name IS NULL OR length(trim(_client_name)) = 0 THEN
        _val_messages := _val_messages || '{"severity":"error","field":"client_name","msg":"Client name is required"}'::JSONB;
        _valid_status := 'invalid';
      END IF;

      IF _total_amount IS NULL OR _total_amount <= 0 THEN
        _val_messages := _val_messages || '{"severity":"error","field":"amount","msg":"Amount must be a positive number"}'::JSONB;
        _valid_status := 'invalid';
      END IF;

      IF _due_date IS NULL THEN
        _val_messages := _val_messages || '{"severity":"error","field":"due_date","msg":"Due date is required or could not be parsed"}'::JSONB;
        _valid_status := 'invalid';
      END IF;

      IF _due_date IS NOT NULL AND _issue_date IS NOT NULL AND _due_date < _issue_date THEN
        _val_messages := _val_messages || '{"severity":"warning","field":"due_date","msg":"Due date is before issue date"}'::JSONB;
        IF _valid_status = 'valid' THEN _valid_status := 'warning'; END IF;
      END IF;

      IF _remaining_balance IS NOT NULL AND _total_amount IS NOT NULL
         AND _remaining_balance > _total_amount THEN
        _val_messages := _val_messages || '{"severity":"warning","field":"remaining_balance","msg":"Remaining balance exceeds total amount"}'::JSONB;
        IF _valid_status = 'valid' THEN _valid_status := 'warning'; END IF;
      END IF;

      IF _contact_email IS NOT NULL AND length(_contact_email) > 0
         AND _contact_email NOT LIKE '%@%' THEN
        _val_messages := _val_messages || '{"severity":"warning","field":"contact_email","msg":"Email address appears invalid"}'::JSONB;
        IF _valid_status = 'valid' THEN _valid_status := 'warning'; END IF;
      END IF;

      -- Mapping confidence: high if all critical fields present, medium if some, low otherwise
      _mapping_conf := CASE
        WHEN _client_name IS NOT NULL AND _total_amount IS NOT NULL AND _due_date IS NOT NULL
             AND (_invoice_number IS NOT NULL OR _contact_email IS NOT NULL) THEN 'high'
        WHEN _client_name IS NOT NULL AND _total_amount IS NOT NULL THEN 'medium'
        ELSE 'low'
      END;

      -- ── Insert candidate ──
      INSERT INTO public.invoice_candidates(
        organization_id, import_batch_id, raw_record_id,
        source_type, source_record_id,
        invoice_number, client_name, billing_contact_name, billing_contact_email,
        billing_contact_phone, issue_date, due_date, payment_terms,
        currency, total_amount, amount_paid, remaining_balance,
        status_raw, notes, custom_attributes,
        mapping_confidence, normalization_status, validation_status,
        validation_messages
      )
      VALUES (
        _org_id, _import_batch_id, _raw_id,
        'csv', _invoice_number,
        _invoice_number, _client_name, _contact_name, _contact_email,
        _contact_phone, _issue_date, _due_date, _payment_terms_raw,
        _currency, _total_amount, COALESCE(_amount_paid, 0),
        COALESCE(_remaining_balance, _total_amount),
        _status_raw, _notes_raw, '{}',
        _mapping_conf, 'normalized', _valid_status,
        _val_messages
      )
      RETURNING id INTO _cand_id;

      -- ── Route to exception queue if invalid ──
      IF _valid_status = 'invalid' THEN
        -- Create an exception for each error
        INSERT INTO public.import_exceptions(
          organization_id, import_batch_id, raw_record_id, candidate_id,
          exception_type, severity, reason, suggested_remediation,
          can_fix_in_ui, requires_reprocessing
        )
        SELECT
          _org_id, _import_batch_id, _raw_id, _cand_id,
          CASE
            WHEN (msg->>'field') IN ('client_name')  THEN 'missing_critical_field'
            WHEN (msg->>'field') IN ('amount')        THEN 'missing_critical_field'
            WHEN (msg->>'field') IN ('due_date')      THEN 'missing_critical_field'
            ELSE 'source_conflict'
          END,
          msg->>'severity',
          msg->>'msg',
          'Fix the field value in the exception queue, then re-import or retry',
          TRUE,
          FALSE
        FROM jsonb_array_elements(_val_messages) AS msg
        WHERE msg->>'severity' = 'error';

        _excepted := _excepted + 1;
      ELSE
        -- Check for duplicate by invoice_number within this org
        IF _invoice_number IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.invoices
          WHERE organization_id = _org_id
            AND invoice_number = _invoice_number
            AND source_system = 'csv'
        ) THEN
          INSERT INTO public.import_exceptions(
            organization_id, import_batch_id, raw_record_id, candidate_id,
            exception_type, severity, reason, suggested_remediation,
            can_fix_in_ui, requires_reprocessing
          ) VALUES (
            _org_id, _import_batch_id, _raw_id, _cand_id,
            'duplicate_candidate', 'warning',
            format('Invoice number %s already exists', _invoice_number),
            'This invoice already exists. Skip or review to merge.',
            TRUE, FALSE
          );

          UPDATE public.invoice_candidates
          SET commit_status = 'skipped'
          WHERE id = _cand_id;

          _skipped := _skipped + 1;
        ELSE
          _staged := _staged + 1;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      _excepted := _excepted + 1;
      _errors := _errors || jsonb_build_object(
        'row_index', _row_idx,
        'row', _row,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- Update batch summary
  UPDATE public.import_batches
  SET
    status            = 'staged',
    successful_rows   = _staged,
    failed_rows       = _excepted,
    duplicate_rows    = _skipped,
    validation_errors = _errors
  WHERE id = _import_batch_id AND organization_id = _org_id;

  RETURN jsonb_build_object(
    'staged',   _staged,
    'excepted', _excepted,
    'skipped',  _skipped,
    'errors',   _errors
  );
END;
$$;

-- ─── 6. commit_staged_import RPC ───
-- Writes valid staged candidates to canonical tables.
-- Idempotent: already-committed candidates are skipped.

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
  _user_id      UUID := auth.uid();
  _cand         RECORD;
  _client_id    UUID;
  _invoice_id   UUID;
  _committed    INT := 0;
  _skipped      INT := 0;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND organization_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  FOR _cand IN
    SELECT * FROM public.invoice_candidates
    WHERE import_batch_id = _import_batch_id
      AND organization_id = _org_id
      AND validation_status IN ('valid', 'warning')
      AND commit_status = 'pending'
    ORDER BY created_at
  LOOP
    BEGIN
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
        VALUES (_org_id, _cand.client_name, 'csv', _import_batch_id)
        RETURNING id INTO _client_id;

        -- Add contact if provided
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
            'primary_billing', TRUE, 1, 'csv'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      -- Skip duplicate invoice number
      IF _cand.invoice_number IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.invoices
        WHERE organization_id = _org_id
          AND invoice_number = _cand.invoice_number
          AND source_system = 'csv'
      ) THEN
        UPDATE public.invoice_candidates
        SET commit_status = 'skipped', committed_at = NOW()
        WHERE id = _cand.id;
        _skipped := _skipped + 1;
        CONTINUE;
      END IF;

      -- Create invoice
      INSERT INTO public.invoices(
        organization_id, client_id,
        invoice_number, amount, currency,
        remaining_balance, amount_paid,
        issue_date, due_date,
        state, days_until_due,
        source_system, import_batch_id, notes
      )
      VALUES (
        _org_id, _client_id,
        _cand.invoice_number,
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
        'csv', _import_batch_id, _cand.notes
      )
      RETURNING id INTO _invoice_id;

      -- Mark candidate as committed
      UPDATE public.invoice_candidates
      SET commit_status       = 'committed',
          committed_invoice_id = _invoice_id,
          committed_client_id  = _client_id,
          committed_at         = NOW()
      WHERE id = _cand.id;

      _committed := _committed + 1;
    EXCEPTION WHEN OTHERS THEN
      _skipped := _skipped + 1;
    END;
  END LOOP;

  -- Mark batch completed
  UPDATE public.import_batches
  SET status          = CASE WHEN _committed > 0 THEN 'completed' ELSE 'failed' END,
      successful_rows = _committed,
      duplicate_rows  = _skipped,
      updated_at      = NOW()
  WHERE id = _import_batch_id AND organization_id = _org_id;

  PERFORM public.refresh_org_read_models(_org_id);

  RETURN jsonb_build_object(
    'committed', _committed,
    'skipped',   _skipped
  );
END;
$$;

-- ─── 7. resolve_import_exception RPC ───

CREATE OR REPLACE FUNCTION public.resolve_import_exception(
  _org_id        UUID,
  _exception_id  UUID,
  _action        TEXT,          -- 'fixed' | 'ignored' | 'skipped'
  _fixed_values  JSONB DEFAULT NULL   -- JSONB of field corrections
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _exc     RECORD;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _exc FROM public.import_exceptions
  WHERE id = _exception_id AND organization_id = _org_id;

  IF _exc.id IS NULL THEN RAISE EXCEPTION 'Exception not found'; END IF;
  IF _exc.status != 'open' THEN RAISE EXCEPTION 'Exception already resolved'; END IF;

  IF _action = 'fixed' AND _fixed_values IS NOT NULL AND _exc.candidate_id IS NOT NULL THEN
    -- Apply corrections to candidate
    UPDATE public.invoice_candidates
    SET
      client_name           = COALESCE(_fixed_values->>'client_name',    client_name),
      billing_contact_email = COALESCE(_fixed_values->>'contact_email',  billing_contact_email),
      due_date              = COALESCE((_fixed_values->>'due_date')::DATE, due_date),
      total_amount          = COALESCE((_fixed_values->>'amount')::NUMERIC, total_amount),
      validation_status     = 'valid',
      validation_messages   = '[]'::JSONB
    WHERE id = _exc.candidate_id AND organization_id = _org_id;
  END IF;

  IF _action IN ('ignored', 'skipped') AND _exc.candidate_id IS NOT NULL THEN
    UPDATE public.invoice_candidates
    SET commit_status = 'skipped'
    WHERE id = _exc.candidate_id AND organization_id = _org_id;
  END IF;

  UPDATE public.import_exceptions
  SET status              = 'resolved',
      resolution_action   = _action,
      resolution_values   = _fixed_values,
      resolved_at         = NOW(),
      resolved_by_user_id = _user_id
  WHERE id = _exception_id AND organization_id = _org_id;

  RETURN jsonb_build_object('ok', TRUE, 'action', _action);
END;
$$;

-- ─── 8. save_mapping_template RPC ───

CREATE OR REPLACE FUNCTION public.save_mapping_template(
  _org_id            UUID,
  _source_type       TEXT,
  _template_name     TEXT,
  _header_signature  TEXT,
  _column_mappings   JSONB,
  _date_format_hint  TEXT  DEFAULT NULL,
  _default_currency  CHAR(3) DEFAULT NULL,
  _ignored_columns   TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id     UUID := auth.uid();
  _template_id UUID;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.mapping_templates(
    organization_id, source_type, template_name, header_signature,
    column_mappings, date_format_hint, default_currency, ignored_columns,
    created_by_user_id, approved_at
  )
  VALUES (
    _org_id, _source_type, _template_name, _header_signature,
    _column_mappings, _date_format_hint, _default_currency, _ignored_columns,
    _user_id, NOW()
  )
  ON CONFLICT (organization_id, source_type, header_signature)
  WHERE source_instance_id IS NULL
  DO UPDATE SET
    column_mappings    = EXCLUDED.column_mappings,
    date_format_hint   = EXCLUDED.date_format_hint,
    default_currency   = EXCLUDED.default_currency,
    ignored_columns    = EXCLUDED.ignored_columns,
    template_version   = mapping_templates.template_version + 1,
    times_used         = mapping_templates.times_used + 1,
    last_used_at       = NOW(),
    updated_at         = NOW()
  RETURNING id INTO _template_id;

  RETURN _template_id;
END;
$$;

-- ─── 9. get_import_batches RPC ───

CREATE OR REPLACE FUNCTION public.get_import_batches(_org_id UUID)
RETURNS TABLE (
  id              UUID,
  import_type     TEXT,
  original_filename TEXT,
  status          TEXT,
  total_rows      INT,
  successful_rows INT,
  failed_rows     INT,
  duplicate_rows  INT,
  created_at      TIMESTAMPTZ,
  open_exceptions BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    b.id, b.import_type, b.original_filename, b.status,
    b.total_rows, b.successful_rows, b.failed_rows, b.duplicate_rows,
    b.created_at,
    COUNT(e.id) FILTER (WHERE e.status = 'open') AS open_exceptions
  FROM public.import_batches b
  LEFT JOIN public.import_exceptions e ON e.import_batch_id = b.id
  WHERE b.organization_id = _org_id
  GROUP BY b.id
  ORDER BY b.created_at DESC
  LIMIT 50;
$$;

-- ─── 10. get_import_candidates RPC ───

CREATE OR REPLACE FUNCTION public.get_import_candidates(_org_id UUID, _batch_id UUID)
RETURNS TABLE (
  id                   UUID,
  invoice_number       TEXT,
  client_name          TEXT,
  billing_contact_email TEXT,
  due_date             DATE,
  total_amount         NUMERIC,
  currency             CHAR(3),
  mapping_confidence   TEXT,
  validation_status    TEXT,
  validation_messages  JSONB,
  commit_status        TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    id, invoice_number, client_name, billing_contact_email,
    due_date, total_amount, currency,
    mapping_confidence, validation_status, validation_messages, commit_status
  FROM public.invoice_candidates
  WHERE organization_id = _org_id AND import_batch_id = _batch_id
  ORDER BY created_at;
$$;

-- ─── 11. get_import_exceptions RPC ───

CREATE OR REPLACE FUNCTION public.get_import_exceptions(
  _org_id    UUID,
  _batch_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  import_batch_id       UUID,
  exception_type        TEXT,
  severity              TEXT,
  field_name            TEXT,
  reason                TEXT,
  suggested_remediation TEXT,
  can_fix_in_ui         BOOLEAN,
  status                TEXT,
  raw_values            JSONB,
  candidate_snapshot    JSONB,
  created_at            TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.id, e.import_batch_id, e.exception_type, e.severity,
    e.field_name, e.reason, e.suggested_remediation, e.can_fix_in_ui,
    e.status,
    r.raw_values,
    CASE WHEN c.id IS NOT NULL THEN
      jsonb_build_object(
        'invoice_number', c.invoice_number,
        'client_name', c.client_name,
        'due_date', c.due_date,
        'total_amount', c.total_amount,
        'billing_contact_email', c.billing_contact_email
      )
    END AS candidate_snapshot,
    e.created_at
  FROM public.import_exceptions e
  LEFT JOIN public.raw_import_records r ON r.id = e.raw_record_id
  LEFT JOIN public.invoice_candidates  c ON c.id = e.candidate_id
  WHERE e.organization_id = _org_id
    AND ((_batch_id IS NULL) OR e.import_batch_id = _batch_id)
    AND e.status = 'open'
  ORDER BY e.created_at DESC;
$$;

-- ─── 12. get_mapping_templates RPC ───

CREATE OR REPLACE FUNCTION public.get_mapping_templates(
  _org_id      UUID,
  _source_type TEXT DEFAULT 'csv'
)
RETURNS TABLE (
  id               UUID,
  template_name    TEXT,
  header_signature TEXT,
  column_mappings  JSONB,
  date_format_hint TEXT,
  default_currency CHAR(3),
  ignored_columns  TEXT[],
  times_used       INT,
  last_used_at     TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    id, template_name, header_signature, column_mappings,
    date_format_hint, default_currency, ignored_columns,
    times_used, last_used_at
  FROM public.mapping_templates
  WHERE organization_id = _org_id AND source_type = _source_type
  ORDER BY times_used DESC, last_used_at DESC NULLS LAST;
$$;

-- ─── Grant execute on new functions ───

GRANT EXECUTE ON FUNCTION public.stage_csv_import       TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_staged_import   TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_import_exception TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_mapping_template  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_batches     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_candidates  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_exceptions  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mapping_templates  TO authenticated;

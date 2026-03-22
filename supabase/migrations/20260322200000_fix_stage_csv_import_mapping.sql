-- Fix: stage_csv_import column mapping extraction was using `_row ->> key`
-- (looks up canonical field name in raw row → always NULL) instead of
-- `value` (the source column name from the mapping JSONB).
-- Result: all field extractions returned NULL, sending every row to exceptions.

CREATE OR REPLACE FUNCTION public.stage_csv_import(
  _org_id             UUID,
  _import_batch_id    UUID,
  _rows               JSONB,    -- array of raw row objects (original column names)
  _column_mapping     JSONB,    -- {canonical_field: source_col, ...}
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
      -- _column_mapping format: {canonical_field: source_col_name}
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

      -- Iterate mapping: key=canonical_field, value=source_col_name
      FOR _src_col, _raw_val IN
        SELECT key, value
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

GRANT EXECUTE ON FUNCTION public.stage_csv_import TO authenticated;

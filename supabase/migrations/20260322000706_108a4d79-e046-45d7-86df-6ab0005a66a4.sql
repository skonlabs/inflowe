
-- ═══════════════════════════════════════════════════════════════════
-- Ingestion subsystem tables
-- ═══════════════════════════════════════════════════════════════════

-- Mapping templates: remembered field mappings per tenant/source
CREATE TABLE public.mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'csv',
  source_system text,
  header_signature text,
  date_format text DEFAULT 'auto',
  default_currency text DEFAULT 'USD',
  ignored_columns text[] DEFAULT '{}',
  custom_field_mappings jsonb DEFAULT '{}',
  created_by_user_id uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org mapping_templates" ON public.mapping_templates
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org mapping_templates" ON public.mapping_templates
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org mapping_templates" ON public.mapping_templates
  FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Mapping template fields: individual column → canonical field mappings
CREATE TABLE public.mapping_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.mapping_templates(id) ON DELETE CASCADE,
  source_column text NOT NULL,
  canonical_field text NOT NULL,
  transform text,
  default_value text,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mapping_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view mapping_template_fields" ON public.mapping_template_fields
  FOR SELECT USING (template_id IN (SELECT id FROM public.mapping_templates WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))));
CREATE POLICY "Members can insert mapping_template_fields" ON public.mapping_template_fields
  FOR INSERT WITH CHECK (template_id IN (SELECT id FROM public.mapping_templates WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))));
CREATE POLICY "Members can update mapping_template_fields" ON public.mapping_template_fields
  FOR UPDATE USING (template_id IN (SELECT id FROM public.mapping_templates WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))));

-- Ingestion raw records: preserve every parsed row
CREATE TABLE public.ingestion_raw_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw_columns jsonb NOT NULL DEFAULT '{}',
  raw_values jsonb NOT NULL DEFAULT '{}',
  parser_warnings text[] DEFAULT '{}',
  mapping_suggestions jsonb DEFAULT '{}',
  field_confidences jsonb DEFAULT '{}',
  row_errors text[] DEFAULT '{}',
  processing_status text NOT NULL DEFAULT 'parsed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_raw_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org ingestion_raw_records" ON public.ingestion_raw_records
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org ingestion_raw_records" ON public.ingestion_raw_records
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Ingestion candidates: normalized records ready for review/write
CREATE TABLE public.ingestion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_record_id uuid REFERENCES public.ingestion_raw_records(id),
  candidate_type text NOT NULL DEFAULT 'invoice',
  normalized_data jsonb NOT NULL DEFAULT '{}',
  mapping_confidence numeric DEFAULT 0,
  mapping_version integer DEFAULT 1,
  normalization_status text NOT NULL DEFAULT 'pending',
  validation_status text NOT NULL DEFAULT 'pending',
  validation_errors jsonb DEFAULT '[]',
  validation_warnings jsonb DEFAULT '[]',
  canonical_record_id uuid,
  write_status text NOT NULL DEFAULT 'pending',
  written_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org ingestion_candidates" ON public.ingestion_candidates
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org ingestion_candidates" ON public.ingestion_candidates
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org ingestion_candidates" ON public.ingestion_candidates
  FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Ingestion exceptions: rows that need attention
CREATE TABLE public.ingestion_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_record_id uuid REFERENCES public.ingestion_raw_records(id),
  candidate_id uuid REFERENCES public.ingestion_candidates(id),
  exception_type text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  reason text NOT NULL,
  suggested_fix text,
  field_name text,
  raw_value text,
  can_fix_in_ui boolean NOT NULL DEFAULT false,
  requires_reprocessing boolean NOT NULL DEFAULT false,
  resolution_status text NOT NULL DEFAULT 'open',
  resolved_by_user_id uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  resolution_action text,
  resolution_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org ingestion_exceptions" ON public.ingestion_exceptions
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Members can insert org ingestion_exceptions" ON public.ingestion_exceptions
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Members can update org ingestion_exceptions" ON public.ingestion_exceptions
  FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Add columns to import_batches for richer ingestion metadata
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'csv',
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS source_connection_id uuid,
  ADD COLUMN IF NOT EXISTS file_checksum text,
  ADD COLUMN IF NOT EXISTS source_headers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parser_version text DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS adapter_version text DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS mapping_template_id uuid REFERENCES public.mapping_templates(id),
  ADD COLUMN IF NOT EXISTS processing_mode text DEFAULT 'manual_upload',
  ADD COLUMN IF NOT EXISTS raw_row_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS candidates_created integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exceptions_created integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canonical_writes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz;

-- Add UPDATE policy for import_batches (currently missing)
CREATE POLICY "Members can update org import_batches" ON public.import_batches
  FOR UPDATE USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ingestion_raw_records_batch ON public.ingestion_raw_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_candidates_batch ON public.ingestion_candidates(batch_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_exceptions_batch ON public.ingestion_exceptions(batch_id);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_org ON public.mapping_templates(organization_id);

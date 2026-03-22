import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle, Info, ChevronRight, ChevronDown, Save, Loader2, X, RefreshCw, Eye, ArrowRight, Sparkles, Check, FileSpreadsheet } from 'lucide-react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/use-supabase-data';
import { useQueryClient } from '@tanstack/react-query';
import { parseCSV } from '@/lib/ingestion/csv-parser';
import { inferMappings, computeHeaderSignature } from '@/lib/ingestion/mapping-engine';
import { normalizeRow } from '@/lib/ingestion/normalizers';
import { validateInvoiceCandidate } from '@/lib/ingestion/validators';
import type { FieldMapping, MappingResult, ParsedRow, NormalizedInvoiceCandidate, ValidationResult, IngestionException } from '@/lib/ingestion/types';
import { CANONICAL_INVOICE_FIELDS } from '@/lib/ingestion/types';

type WizardStep = 'upload' | 'mapping' | 'preview' | 'exceptions' | 'importing' | 'summary';

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload',
  mapping: 'Map Fields',
  preview: 'Preview',
  exceptions: 'Exceptions',
  importing: 'Importing',
  summary: 'Summary',
};

const STEP_ORDER: WizardStep[] = ['upload', 'mapping', 'preview', 'exceptions', 'importing', 'summary'];

export default function ImportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [editedMappings, setEditedMappings] = useState<FieldMapping[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ successful: number; failed: number; exceptions: number } | null>(null);
  const [expandedMapping, setExpandedMapping] = useState<string | null>(null);
  const [ignoredColumns, setIgnoredColumns] = useState<Set<string>>(new Set());
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const defaultCurrency = (membership?.organizations as any)?.default_currency || 'USD';

  // ── Step 1: Upload ──────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'tsv', 'txt'].includes(ext || '')) {
      toast.error('Please upload a CSV file. Excel support coming soon.');
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    try {
      const text = await file.text();
      const result = parseCSV(text);

      if (result.errors.length > 0 && result.rows.length === 0) {
        toast.error(result.errors[0]);
        return;
      }

      setHeaders(result.headers);
      setRows(result.rows);

      // Auto-infer mappings
      const mapping = inferMappings(result.headers, result.rows);
      setMappingResult(mapping);
      setEditedMappings([...mapping.mappings]);

      toast.success(`Parsed ${result.totalRows} rows with ${result.headers.length} columns`);
      setStep('mapping');
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
    }
  }, []);

  // ── Step 2: Mapping manipulation ────────────────────────────

  const handleChangeMapping = (sourceColumn: string, newCanonicalField: string) => {
    setEditedMappings(prev => prev.map(m =>
      m.sourceColumn === sourceColumn
        ? { ...m, canonicalField: newCanonicalField, confidence: 'high' as const, confidenceScore: 1.0, inferenceReason: 'Manually selected' }
        : m
    ));
  };

  const handleIgnoreColumn = (sourceColumn: string) => {
    setIgnoredColumns(prev => {
      const next = new Set(prev);
      if (next.has(sourceColumn)) {
        next.delete(sourceColumn);
      } else {
        next.add(sourceColumn);
      }
      return next;
    });
  };

  const handleAddMapping = (sourceColumn: string) => {
    setEditedMappings(prev => [
      ...prev,
      {
        sourceColumn,
        canonicalField: 'notes',
        confidence: 'low' as const,
        confidenceScore: 0.3,
        sampleValues: rows.slice(0, 5).map(r => r[sourceColumn] || ''),
        isRequired: false,
        inferenceReason: 'Manually added',
      },
    ]);
  };

  const getActiveMappings = () =>
    editedMappings.filter(m => !ignoredColumns.has(m.sourceColumn));

  // ── Step 3: Normalize + Validate preview ────────────────────

  const runNormalization = useCallback(() => {
    const active = getActiveMappings();
    const parsed: ParsedRow[] = rows.map((rawValues, i) => {
      const normalized = normalizeRow(rawValues, active, defaultCurrency);
      const { validations, exceptions } = validateInvoiceCandidate(normalized, i);
      const hasError = validations.some(v => v.severity === 'error');
      const hasWarning = validations.some(v => v.severity === 'warning');
      return {
        rowIndex: i,
        rawValues,
        normalizedCandidate: normalized,
        validationResults: validations,
        exceptions,
        overallStatus: hasError ? 'error' : hasWarning ? 'warning' : 'valid',
      };
    });
    setParsedRows(parsed);
    setStep('preview');
  }, [rows, editedMappings, ignoredColumns, defaultCurrency]);

  // ── Step 4: Import execution ────────────────────────────────

  const runImport = useCallback(async () => {
    if (!orgId || !user) return;
    setStep('importing');
    setImporting(true);

    const validRows = parsedRows.filter(r => r.overallStatus !== 'error');
    const errorRows = parsedRows.filter(r => r.overallStatus === 'error');

    const batchId = crypto.randomUUID();
    let successful = 0;
    let failed = errorRows.length;

    try {
      // Create import batch
      await supabase.from('import_batches').insert({
        id: batchId,
        organization_id: orgId,
        created_by_user_id: user.id,
        import_type: 'csv',
        source_type: 'csv',
        status: 'processing',
        total_rows: rows.length,
        raw_row_count: rows.length,
        source_headers: headers,
        parser_version: '1.0',
        processing_started_at: new Date().toISOString(),
      });

      // Store raw records in batches
      const rawRecordsBatch = rows.map((rawValues, i) => ({
        batch_id: batchId,
        organization_id: orgId,
        row_index: i,
        raw_columns: headers,
        raw_values: rawValues,
        parser_warnings: [],
        processing_status: parsedRows[i]?.overallStatus === 'error' ? 'error' : 'normalized',
      }));

      // Insert raw records in chunks of 50
      for (let i = 0; i < rawRecordsBatch.length; i += 50) {
        const chunk = rawRecordsBatch.slice(i, i + 50);
        await supabase.from('ingestion_raw_records').insert(chunk);
      }

      // Process valid rows into canonical tables
      const clientIds = new Map<string, string>();

      for (const parsed of validRows) {
        const c = parsed.normalizedCandidate;
        if (!c) continue;

        try {
          const clientKey = `${c.client_name || 'Unknown'}::${c.billing_contact_email || ''}`.toLowerCase();
          let clientId = clientIds.get(clientKey);

          if (!clientId) {
            // Check existing client by name
            const { data: existingClient } = await supabase
              .from('clients')
              .select('id')
              .eq('organization_id', orgId)
              .ilike('display_name', c.client_name || 'Unknown Client')
              .limit(1)
              .maybeSingle();

            if (existingClient) {
              clientId = existingClient.id;
            } else {
              const { data: newClient, error: clientErr } = await supabase
                .from('clients')
                .insert({
                  organization_id: orgId,
                  display_name: c.client_name || 'Unknown Client',
                  legal_name: c.client_legal_name || null,
                  preferred_channel: 'email',
                  sensitivity_level: 'standard',
                })
                .select('id')
                .single();
              if (clientErr) throw clientErr;
              clientId = newClient.id;

              // Create contact if we have details
              if (c.billing_contact_email || c.billing_contact_name) {
                await supabase.from('client_contacts').insert({
                  organization_id: orgId,
                  client_id: clientId,
                  full_name: c.billing_contact_name || c.client_name || 'Billing Contact',
                  email: c.billing_contact_email || null,
                  phone: c.billing_contact_phone || null,
                  is_primary: true,
                });
              }
            }
            clientIds.set(clientKey, clientId);
          }

          // Determine state
          const amount = c.total_amount ?? c.remaining_balance ?? 0;
          const remaining = c.remaining_balance ?? amount;
          const dueDate = c.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

          let state = c.status || 'sent';
          if (!c.status) {
            if (remaining <= 0) state = 'paid';
            else {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
              const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
              if (diff < 0) state = 'overdue';
              else if (diff === 0) state = 'due_today';
              else if (diff <= 7) state = 'due_soon';
              else state = 'sent';
            }
          }

          // Idempotency check
          if (c.invoice_number) {
            const { data: existing } = await supabase
              .from('invoices')
              .select('id')
              .eq('organization_id', orgId)
              .eq('invoice_number', c.invoice_number)
              .limit(1)
              .maybeSingle();
            if (existing) {
              // Skip duplicate
              successful++;
              continue;
            }
          }

          const { error: invErr } = await supabase.from('invoices').insert({
            organization_id: orgId,
            client_id: clientId,
            invoice_number: c.invoice_number || `INV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            external_id: c.external_invoice_id || null,
            amount,
            amount_paid: c.amount_paid ?? 0,
            remaining_balance: remaining,
            currency: c.currency || defaultCurrency,
            due_date: dueDate,
            issue_date: c.issue_date || new Date().toISOString().split('T')[0],
            state,
            collection_priority: 'medium',
            import_batch_id: batchId,
            source_system: 'csv_import',
          });

          if (invErr) throw invErr;
          successful++;
        } catch (err: any) {
          failed++;
          // Store exception
          try {
            await supabase.from('ingestion_exceptions').insert({
              batch_id: batchId,
              organization_id: orgId,
              exception_type: 'canonical_write_failure',
              severity: 'error',
              reason: err.message || 'Failed to create invoice',
              field_name: 'invoice',
              can_fix_in_ui: false,
              requires_reprocessing: true,
            });
          } catch { /* best-effort */ }
        }
      }

      // Store exceptions for error rows
      for (const parsed of errorRows) {
        for (const exc of parsed.exceptions) {
          await supabase.from('ingestion_exceptions').insert({
            batch_id: batchId,
            organization_id: orgId,
            exception_type: exc.type,
            severity: exc.severity,
            reason: exc.reason,
            suggested_fix: exc.suggestedFix || null,
            field_name: exc.fieldName || null,
            raw_value: exc.rawValue || null,
            can_fix_in_ui: exc.canFixInUi,
            requires_reprocessing: exc.requiresReprocessing,
          }).catch(() => {});
        }
      }

      // Update batch status
      await supabase.from('import_batches').update({
        status: failed > 0 ? 'completed_with_errors' : 'completed',
        successful_rows: successful,
        failed_rows: failed,
        candidates_created: validRows.length,
        exceptions_created: errorRows.length,
        canonical_writes: successful,
        processing_completed_at: new Date().toISOString(),
      }).eq('id', batchId);

      setImportResult({ successful, failed, exceptions: errorRows.length });

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ['invoice-list'] });
      qc.invalidateQueries({ queryKey: ['client-summaries'] });
      qc.invalidateQueries({ queryKey: ['home-summary'] });

      setStep('summary');
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
      setImportResult({ successful, failed, exceptions: errorRows.length });
      setStep('summary');
    } finally {
      setImporting(false);
    }
  }, [orgId, user, parsedRows, rows, headers, defaultCurrency, qc]);

  // ── Save mapping template ───────────────────────────────────

  const handleSaveTemplate = async () => {
    if (!orgId || !user || !templateName.trim()) return;
    setSavingTemplate(true);

    try {
      const signature = computeHeaderSignature(headers);
      const { data: template, error: tErr } = await supabase
        .from('mapping_templates')
        .insert({
          organization_id: orgId,
          name: templateName.trim(),
          source_type: 'csv',
          header_signature: signature,
          default_currency: defaultCurrency,
          ignored_columns: Array.from(ignoredColumns),
          created_by_user_id: user.id,
          approved_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (tErr) throw tErr;

      const fields = getActiveMappings().map(m => ({
        template_id: template.id,
        source_column: m.sourceColumn,
        canonical_field: m.canonicalField,
        transform: m.transform || null,
        default_value: m.defaultValue || null,
        is_required: m.isRequired,
      }));

      if (fields.length > 0) {
        const { error: fErr } = await supabase.from('mapping_template_fields').insert(fields);
        if (fErr) throw fErr;
      }

      toast.success('Mapping template saved — future imports will auto-apply it');
      setShowSaveTemplate(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Computed stats ──────────────────────────────────────────

  const errorCount = parsedRows.filter(r => r.overallStatus === 'error').length;
  const warningCount = parsedRows.filter(r => r.overallStatus === 'warning').length;
  const validCount = parsedRows.filter(r => r.overallStatus === 'valid').length;

  const currentStepIndex = STEP_ORDER.indexOf(step);

  const confidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high': return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"><Check className="w-2.5 h-2.5" /> High</span>;
      case 'medium': return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"><AlertTriangle className="w-2.5 h-2.5" /> Med</span>;
      default: return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive"><AlertCircle className="w-2.5 h-2.5" /> Low</span>;
    }
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <button onClick={() => step === 'upload' ? navigate(-1) : setStep('upload')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> {step === 'upload' ? 'Back' : 'Start over'}
      </button>

      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload invoices, clients, or payments from any format</p>
      </ScrollReveal>

      {/* Progress steps */}
      <ScrollReveal delay={0.05}>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEP_ORDER.filter(s => s !== 'importing').map((s, i) => {
            const isActive = s === step || (step === 'importing' && s === 'exceptions');
            const isDone = STEP_ORDER.indexOf(s) < currentStepIndex;
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                {i > 0 && <div className={`w-4 h-px ${isDone ? 'bg-primary' : 'bg-border'}`} />}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' :
                  isDone ? 'bg-primary/10 text-primary' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isDone && <CheckCircle2 className="w-3 h-3" />}
                  {STEP_LABELS[s]}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>

      {/* ═══ UPLOAD STEP ═══ */}
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <ScrollReveal delay={0.1}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full glass-card rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-primary/40 transition-colors active:scale-[0.98] group"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold">Upload a file</p>
                  <p className="text-sm text-muted-foreground">CSV, TSV, or TXT — up to 20MB</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" /> Drop your invoice export here
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileSelect} className="hidden" />
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div className="glass-card rounded-xl p-4 mt-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Smart mapping
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We'll automatically detect your column names and map them to the right fields.
                  You can adjust anything before importing. Your mappings are saved for future imports.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <p className="font-medium">Supported fields</p>
                    <p className="text-muted-foreground mt-0.5">Invoice #, client, amounts, dates, contacts, status</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <p className="font-medium">Smart detection</p>
                    <p className="text-muted-foreground mt-0.5">Synonyms, patterns, value types, cross-field logic</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </motion.div>
        )}

        {/* ═══ MAPPING STEP ═══ */}
        {step === 'mapping' && mappingResult && (
          <motion.div key="mapping" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="space-y-3">

            {/* File info */}
            <div className="glass-card rounded-xl p-3 flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">{rows.length} rows · {headers.length} columns · {(fileSize / 1024).toFixed(1)} KB</p>
              </div>
              {confidenceBadge(mappingResult.overallConfidence)}
            </div>

            {/* Missing required fields warning */}
            {mappingResult.missingRequiredFields.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Missing required fields
                </p>
                <p className="text-xs text-muted-foreground">
                  {mappingResult.missingRequiredFields.map(f => CANONICAL_INVOICE_FIELDS[f]?.label || f).join(', ')}
                </p>
              </div>
            )}

            {/* Mapped fields */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Column mappings</h3>
                <span className="text-xs text-muted-foreground">{editedMappings.length} mapped</span>
              </div>
              {editedMappings.map(mapping => {
                const isIgnored = ignoredColumns.has(mapping.sourceColumn);
                const isExpanded = expandedMapping === mapping.sourceColumn;
                return (
                  <div key={mapping.sourceColumn} className={`border-t border-border/40 ${isIgnored ? 'opacity-40' : ''}`}>
                    <button
                      onClick={() => setExpandedMapping(isExpanded ? null : mapping.sourceColumn)}
                      className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{mapping.sourceColumn}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{CANONICAL_INVOICE_FIELDS[mapping.canonicalField]?.label || mapping.canonicalField}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {confidenceBadge(mapping.confidence)}
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}>
                          <div className="px-4 pb-3 space-y-2">
                            <p className="text-xs text-muted-foreground">{mapping.inferenceReason}</p>
                            {mapping.sampleValues.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {mapping.sampleValues.filter(v => v).slice(0, 3).map((v, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded bg-muted text-xs font-mono truncate max-w-[140px]">{v}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <select
                                value={mapping.canonicalField}
                                onChange={e => handleChangeMapping(mapping.sourceColumn, e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                              >
                                <option value="">— Select field —</option>
                                {Object.entries(CANONICAL_INVOICE_FIELDS).map(([key, meta]) => (
                                  <option key={key} value={key}>{meta.label}{meta.required ? ' *' : ''}</option>
                                ))}
                                <option value="_custom">Custom attribute</option>
                              </select>
                              <button
                                onClick={() => handleIgnoreColumn(mapping.sourceColumn)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors active:scale-95 ${
                                  isIgnored ? 'bg-primary/10 text-primary border-primary/30' : 'border-border hover:bg-destructive/10 hover:text-destructive'
                                }`}
                              >
                                {isIgnored ? 'Include' : 'Ignore'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Unmapped columns */}
              {mappingResult.unmappedColumns.filter(c => !ignoredColumns.has(c)).map(col => (
                <div key={col} className="border-t border-border/40 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{col}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Unmapped</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleAddMapping(col)} className="px-2 py-1 rounded text-xs text-primary hover:bg-primary/10 active:scale-95">Map</button>
                    <button onClick={() => handleIgnoreColumn(col)} className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted active:scale-95">Ignore</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Save template */}
            <div className="glass-card rounded-xl p-3 space-y-2">
              {!showSaveTemplate ? (
                <button onClick={() => setShowSaveTemplate(true)} className="flex items-center gap-2 text-sm text-primary font-medium active:scale-95">
                  <Save className="w-4 h-4" /> Save as mapping template
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Template name (e.g. QuickBooks export)"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || savingTemplate}
                      className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium active:scale-95 disabled:opacity-40"
                    >
                      {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
                    </button>
                    <button onClick={() => setShowSaveTemplate(false)} className="px-4 py-2 rounded-lg border border-border text-sm active:scale-95">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Continue */}
            <button
              onClick={runNormalization}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" /> Preview normalized data
            </button>
          </motion.div>
        )}

        {/* ═══ PREVIEW STEP ═══ */}
        {step === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="space-y-3">

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--success))]">{validCount}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Ready</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--warning))]">{warningCount}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Warnings</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-destructive">{errorCount}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Errors</p>
              </div>
            </div>

            {/* Preview table — first 10 rows */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/30">
                <h3 className="text-sm font-semibold">Preview ({Math.min(10, parsedRows.length)} of {parsedRows.length} rows)</h3>
              </div>
              <div className="overflow-x-auto">
                {parsedRows.slice(0, 10).map((parsed, i) => {
                  const c = parsed.normalizedCandidate;
                  const statusIcon = parsed.overallStatus === 'valid'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))] shrink-0" />
                    : parsed.overallStatus === 'warning'
                    ? <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--warning))] shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;

                  return (
                    <div key={i} className="px-4 py-2.5 border-t border-border/40 flex items-start gap-2">
                      {statusIcon}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">{c?.invoice_number || '—'}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground truncate">{c?.client_name || '—'}</span>
                          {c?.total_amount !== undefined && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs font-mono">{c.currency || ''} {c.total_amount?.toLocaleString()}</span>
                            </>
                          )}
                          {c?.due_date && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">Due {c.due_date}</span>
                            </>
                          )}
                        </div>
                        {parsed.validationResults.filter(v => v.severity !== 'info').map((v, j) => (
                          <p key={j} className={`text-[11px] ${v.severity === 'error' ? 'text-destructive' : 'text-[hsl(var(--warning))]'}`}>
                            {v.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => setStep('mapping')} className="flex-1 py-3 rounded-xl border border-border font-medium text-sm active:scale-[0.98]">
                ← Adjust mappings
              </button>
              {errorCount > 0 ? (
                <button onClick={() => setStep('exceptions')} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.98] flex items-center justify-center gap-1">
                  Review exceptions <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={runImport} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.98] flex items-center justify-center gap-1">
                  Import {validCount + warningCount} rows <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ EXCEPTIONS STEP ═══ */}
        {step === 'exceptions' && (
          <motion.div key="exceptions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="space-y-3">

            <div className="glass-card rounded-xl p-4 space-y-1">
              <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {errorCount} rows need attention
              </h3>
              <p className="text-xs text-muted-foreground">
                These rows have errors that prevent import. {validCount + warningCount > 0 ? `You can still import the other ${validCount + warningCount} valid rows.` : ''}
              </p>
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
              {parsedRows.filter(r => r.overallStatus === 'error').slice(0, 20).map((parsed, i) => (
                <div key={i} className="px-4 py-3 border-t first:border-t-0 border-border/40 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">Row {parsed.rowIndex + 2}</span>
                    {parsed.normalizedCandidate?.client_name && (
                      <span className="text-xs text-muted-foreground truncate">· {parsed.normalizedCandidate.client_name}</span>
                    )}
                  </div>
                  {parsed.exceptions.map((exc, j) => (
                    <div key={j} className="rounded-lg bg-destructive/5 p-2 space-y-0.5">
                      <p className="text-xs font-medium text-destructive">{exc.reason}</p>
                      {exc.suggestedFix && <p className="text-[11px] text-muted-foreground">{exc.suggestedFix}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('mapping')} className="flex-1 py-3 rounded-xl border border-border font-medium text-sm active:scale-[0.98]">
                ← Fix mappings
              </button>
              {validCount + warningCount > 0 && (
                <button onClick={runImport} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.98] flex items-center justify-center gap-1">
                  Import {validCount + warningCount} valid rows <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ IMPORTING STEP ═══ */}
        {step === 'importing' && (
          <motion.div key="importing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <div className="glass-card rounded-xl p-8 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="text-center space-y-1">
                <p className="font-semibold">Importing your data...</p>
                <p className="text-sm text-muted-foreground">Creating clients and invoices</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ SUMMARY STEP ═══ */}
        {step === 'summary' && importResult && (
          <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="space-y-4">

            <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                importResult.failed === 0 ? 'bg-[hsl(var(--success))]/10' : 'bg-[hsl(var(--warning))]/10'
              }`}>
                {importResult.failed === 0 ? (
                  <CheckCircle2 className="w-7 h-7 text-[hsl(var(--success))]" />
                ) : (
                  <AlertTriangle className="w-7 h-7 text-[hsl(var(--warning))]" />
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-lg">
                  {importResult.failed === 0 ? 'Import complete!' : 'Import completed with issues'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {importResult.successful} invoices imported successfully
                  {importResult.failed > 0 && ` · ${importResult.failed} failed`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--success))]">{importResult.successful}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Imported</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-destructive">{importResult.failed}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Failed</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--warning))]">{importResult.exceptions}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Exceptions</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => navigate('/invoices')} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.98]">
                View invoices
              </button>
              <button onClick={() => { setStep('upload'); setRows([]); setHeaders([]); setParsedRows([]); setImportResult(null); }}
                className="flex-1 py-3 rounded-xl border border-border font-medium text-sm active:scale-[0.98] flex items-center justify-center gap-1">
                <RefreshCw className="w-4 h-4" /> Import more
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

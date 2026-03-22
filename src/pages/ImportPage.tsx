/**
 * ImportPage — Full import management hub.
 *
 * Features:
 *  - Upload CSV with field mapping review (spec §4, §7, §8)
 *  - Import history with status (spec §18)
 *  - Exception queue with inline fixes (spec §12)
 *  - Saved mapping templates (spec §14)
 *  - Repeat import with auto-applied templates (spec §19.2)
 */

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Clock,
         ChevronRight, RotateCcw, BookTemplate, X, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/use-supabase-data';
import {
  useUserOrganization,
  useImportBatches,
  useImportExceptions,
  useMappingTemplates,
  useStageImport,
  useCommitImport,
  useResolveException,
  useSaveMappingTemplate,
} from '@/hooks/use-supabase-data';
import { parseCsvFile } from '@/lib/csv-parser';
import {
  inferMapping,
  buildHeaderSignature,
  matchesTemplate,
  MappingProposal,
  ConfirmedMapping,
  MappingTemplate,
} from '@/lib/mapping-engine';
import FieldMappingReview from '@/components/FieldMappingReview';

type View = 'list' | 'upload' | 'mapping' | 'staging' | 'summary' | 'exceptions';

interface ParsedFile {
  file: File;
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

const STATUS_ICON: Record<string, { icon: React.FC<{ className?: string }>; color: string; label: string }> = {
  pending:    { icon: Clock,         color: 'text-muted-foreground', label: 'Pending' },
  processing: { icon: RotateCcw,     color: 'text-primary',          label: 'Processing' },
  staged:     { icon: Clock,         color: 'text-amber-600',        label: 'Awaiting commit' },
  completed:  { icon: CheckCircle2,  color: 'text-success',          label: 'Completed' },
  partial:    { icon: AlertTriangle, color: 'text-amber-600',        label: 'Partial' },
  failed:     { icon: AlertTriangle, color: 'text-destructive',      label: 'Failed' },
};

export default function ImportPage() {
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const org   = membership?.organizations as { default_currency?: string } | undefined;
  const [view, setView] = useState<View>('list');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [proposals, setProposals] = useState<MappingProposal[]>([]);
  const [matchedTemplate, setMatchedTemplate] = useState<MappingTemplate | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [stagingResult, setStagingResult] = useState<{ staged: number; excepted: number; skipped: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [pendingMapping, setPendingMapping] = useState<ConfirmedMapping | null>(null);

  const { data: batches = [],    isLoading: batchLoading   } = useImportBatches(orgId);
  const { data: exceptions = [], isLoading: excLoading      } = useImportExceptions(orgId);
  const { data: templates  = []                             } = useMappingTemplates(orgId);

  const stageImport     = useStageImport();
  const commitImport    = useCommitImport();
  const resolveExc      = useResolveException();
  const saveTemplate    = useSaveMappingTemplate();

  const openExceptions = exceptions.filter(e => e.status === 'open');

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    try {
      const result = await parseCsvFile(file, { maxRows: 2000 });
      if (result.headers.length === 0) {
        toast.error('Could not read column headers from this file');
        return;
      }
      setParsed({ file, headers: result.headers, rows: result.rows, warnings: result.warnings });

      // Find matching saved template
      const sig = buildHeaderSignature(result.headers);
      const matched = (templates as MappingTemplate[]).find(t =>
        matchesTemplate(result.headers, t),
      ) ?? null;
      setMatchedTemplate(matched);

      // Infer mapping
      const inferred = inferMapping(result.headers, result.rows.slice(0, 10), matched);
      setProposals(inferred);

      if (result.warnings.length > 0) {
        result.warnings.forEach(w => toast.warning(w));
      }

      setView('mapping');
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
    }
  }, [templates]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Import flow ────────────────────────────────────────────────────────────

  const handleMappingConfirm = (mapping: ConfirmedMapping) => {
    setPendingMapping(mapping);
    if (!templateSaveName) {
      setShowTemplateSave(true);
    } else {
      runStaging(mapping, null);
    }
  };

  const runStaging = async (mapping: ConfirmedMapping, saveAs: string | null) => {
    if (!orgId || !parsed) return;
    setShowTemplateSave(false);

    try {
      // Create import batch record
      const batchId = crypto.randomUUID();
      const { error: batchErr } = await supabase.from('import_batches').insert({
        id:                 batchId,
        organization_id:    orgId,
        created_by_user_id: (await supabase.auth.getUser()).data.user?.id,
        import_type:        'csv',
        original_filename:  parsed.file.name,
        status:             'pending',
        total_rows:         parsed.rows.length,
        column_mapping:     mapping.fieldToColumn,
      });
      if (batchErr) throw batchErr;

      setCurrentBatchId(batchId);
      setView('staging');

      // Build canonical_field → source_column mapping (RPC expects this format)
      const result = await stageImport.mutateAsync({
        orgId,
        importBatchId: batchId,
        rows: parsed.rows,
        columnMapping: mapping.fieldToColumn,
        dateFormatHint: mapping.dateFormatHint,
        defaultCurrency: mapping.defaultCurrency,
      });

      setStagingResult(result);

      // Save template if requested
      if (saveAs && parsed.headers.length > 0) {
        const colMappings = Object.entries(mapping.fieldToColumn).map(([canonical, src]) => ({
          sourceCol: src,
          canonicalField: canonical,
        }));
        await saveTemplate.mutateAsync({
          orgId,
          sourceType: 'csv',
          templateName: saveAs,
          headerSignature: buildHeaderSignature(parsed.headers),
          columnMappings: colMappings,
          dateFormatHint: mapping.dateFormatHint,
          defaultCurrency: mapping.defaultCurrency,
          ignoredColumns: mapping.ignoredColumns,
        });
        toast.success('Mapping template saved');
      }

      setView('summary');
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
      setView('upload');
    }
  };

  const handleCommit = async () => {
    if (!orgId || !currentBatchId) return;
    try {
      const result = await commitImport.mutateAsync({ orgId, importBatchId: currentBatchId });
      toast.success(`${result.committed} invoice${result.committed !== 1 ? 's' : ''} imported successfully`);
      setView('list');
      resetState();
    } catch (err: any) {
      toast.error(err.message || 'Failed to commit import');
    }
  };

  const resetState = () => {
    setParsed(null);
    setProposals([]);
    setMatchedTemplate(null);
    setCurrentBatchId(null);
    setStagingResult(null);
    setPendingMapping(null);
  };

  // ── Exception resolution ───────────────────────────────────────────────────

  const handleIgnoreException = async (exceptionId: string) => {
    if (!orgId) return;
    try {
      await resolveExc.mutateAsync({ orgId, exceptionId, action: 'ignored' });
      toast.success('Row skipped');
    } catch (err: any) {
      toast.error(err.message || 'Failed to skip exception');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === 'mapping' && parsed && proposals.length > 0) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => { setView('upload'); setParsed(null); }} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{parsed.file.name}</span>
        </div>
        {matchedTemplate && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2">
            <BookTemplate className="w-4 h-4 text-primary shrink-0" />
            <span>Saved template <strong>{matchedTemplate.template_name}</strong> applied. Review and confirm.</span>
          </div>
        )}
        <FieldMappingReview
          headers={parsed.headers}
          sampleRows={parsed.rows.slice(0, 5)}
          proposals={proposals}
          defaultCurrency={org?.default_currency ?? 'USD'}
          onConfirm={handleMappingConfirm}
          onCancel={() => { setView('upload'); setParsed(null); }}
          hasSavedTemplate={!!matchedTemplate}
        />
        {showTemplateSave && pendingMapping && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
            <div className="w-full max-w-md bg-card rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Save this mapping?</h3>
              <p className="text-sm text-muted-foreground">
                Give it a name and future imports with the same columns will be mapped automatically.
              </p>
              <input
                type="text"
                placeholder="e.g. My QuickBooks export"
                value={templateSaveName}
                onChange={e => setTemplateSaveName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => runStaging(pendingMapping, null)}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-medium"
                >
                  Skip saving
                </button>
                <button
                  onClick={() => {
                    if (templateSaveName.trim() && pendingMapping) {
                      runStaging(pendingMapping, templateSaveName.trim());
                    }
                  }}
                  disabled={!templateSaveName.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
                >
                  Save & import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'summary' && stagingResult) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-5">
        <div className="text-center pt-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Import ready to commit</h2>
          <p className="text-muted-foreground text-sm mt-1">Review the summary before finalising.</p>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <SummaryRow label="Ready to import" value={stagingResult.staged} color="success" />
          <SummaryRow label="Need attention (exceptions)" value={stagingResult.excepted} color={stagingResult.excepted > 0 ? 'amber' : 'success'} />
          <SummaryRow label="Skipped (duplicates)" value={stagingResult.skipped} />
        </div>

        {stagingResult.excepted > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">{stagingResult.excepted} rows need attention</p>
                <p className="text-amber-700 mt-0.5">
                  You can still commit the valid rows now, then fix the exceptions later.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {stagingResult.excepted > 0 && (
            <button
              onClick={() => setView('exceptions')}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium"
            >
              View exceptions first
            </button>
          )}
          <button
            onClick={handleCommit}
            disabled={stagingResult.staged === 0 || commitImport.isPending}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
          >
            {commitImport.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importing...
              </span>
            ) : (
              `Commit ${stagingResult.staged} invoice${stagingResult.staged !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload invoices from a spreadsheet or connected source</p>
        </div>
        <button
          onClick={() => setView('upload')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <Upload className="w-4 h-4" /> New import
        </button>
      </div>

      {/* Open exceptions alert */}
      {openExceptions.length > 0 && (
        <button
          onClick={() => setView('exceptions')}
          className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {openExceptions.length} row{openExceptions.length !== 1 ? 's' : ''} need attention
              </p>
              <p className="text-xs text-amber-700 mt-0.5">These rows couldn't be imported automatically</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-600" />
        </button>
      )}

      {/* Upload area (when view=upload) */}
      {view === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv,text/csv';
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleFile(f);
              };
              input.click();
            }}
            className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Drag & drop your CSV file</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            <p className="text-xs text-muted-foreground mt-3">
              Supports any column names — we'll help you map them
            </p>
          </div>

          {templates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your saved templates</p>
              {templates.map(t => (
                <div key={t.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t.template_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Used {t.times_used}×{t.last_used_at ? ` · Last used ${new Date(t.last_used_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <BookTemplate className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setView('list')}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            ← Back to import history
          </button>
        </div>
      )}

      {/* Exception queue */}
      {view === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setView('list')} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">Exception queue ({openExceptions.length})</span>
          </div>

          {excLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
          ) : openExceptions.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
              <p className="font-medium">No exceptions</p>
              <p className="text-sm text-muted-foreground mt-1">All rows imported successfully</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openExceptions.map(exc => (
                <ExceptionCard
                  key={exc.id}
                  exception={exc}
                  onIgnore={() => handleIgnoreException(exc.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import history (default list view) */}
      {view === 'list' && (
        <div className="space-y-3">
          {batchLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading imports...</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-16">
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No imports yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload a CSV to get started</p>
              <button
                onClick={() => setView('upload')}
                className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                Upload CSV
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">Import history</p>
              {batches.map(batch => {
                const s = STATUS_ICON[batch.status] ?? STATUS_ICON.pending;
                const Icon = s.icon;
                return (
                  <div key={batch.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${s.color}`} />
                        <div>
                          <p className="text-sm font-medium">
                            {batch.original_filename ?? batch.import_type.toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(batch.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        batch.status === 'completed' ? 'text-success bg-success/10 border-success/20' :
                        batch.status === 'failed'    ? 'text-destructive bg-destructive/10 border-destructive/20' :
                        'text-amber-600 bg-amber-50 border-amber-200'
                      }`}>
                        {s.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                      <Stat label="Imported" value={batch.successful_rows} color="success" />
                      <Stat label="Exceptions" value={batch.failed_rows} color={batch.failed_rows > 0 ? 'amber' : 'neutral'} />
                      <Stat label="Skipped" value={batch.duplicate_rows} />
                    </div>

                    {batch.open_exceptions > 0 && (
                      <button
                        onClick={() => setView('exceptions')}
                        className="mt-3 w-full text-xs text-amber-600 font-medium flex items-center gap-1 justify-center py-2 rounded-lg bg-amber-50 border border-amber-200"
                      >
                        <Wrench className="w-3 h-3" />
                        Fix {batch.open_exceptions} exception{batch.open_exceptions !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${
        color === 'success' ? 'text-success' :
        color === 'amber'   ? 'text-amber-600' :
        'text-foreground'
      }`}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-base font-bold tabular-nums ${
        color === 'success' ? 'text-success' :
        color === 'amber'   ? 'text-amber-600' :
        'text-foreground'
      }`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ExceptionCard({
  exception,
  onIgnore,
}: {
  exception: {
    id: string;
    exception_type: string;
    severity: string;
    reason: string;
    suggested_remediation: string | null;
    can_fix_in_ui: boolean;
    raw_values: Record<string, string> | null;
    candidate_snapshot: Record<string, unknown> | null;
  };
  onIgnore: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const typeLabels: Record<string, string> = {
    missing_critical_field: 'Missing required field',
    duplicate_candidate:    'Duplicate invoice',
    ambiguous_mapping:      'Ambiguous column',
    conflicting_amounts:    'Amount conflict',
    impossible_date:        'Invalid date',
    invalid_email:          'Invalid email',
    unmatched_client:       'Unknown client',
    source_conflict:        'Data conflict',
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      exception.severity === 'error' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-200 bg-amber-50'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
            exception.severity === 'error' ? 'text-destructive' : 'text-amber-600'
          }`} />
          <div>
            <p className="text-sm font-medium">
              {typeLabels[exception.exception_type] ?? exception.exception_type}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{exception.reason}</p>
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-muted-foreground underline shrink-0">
          {expanded ? 'Less' : 'Details'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 text-xs">
          {exception.suggested_remediation && (
            <p className="text-muted-foreground"><strong>Suggestion:</strong> {exception.suggested_remediation}</p>
          )}
          {exception.candidate_snapshot && (
            <div className="rounded-lg bg-background border border-border p-3 font-mono space-y-0.5">
              {Object.entries(exception.candidate_snapshot).map(([k, v]) =>
                v ? <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</div> : null,
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onIgnore}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium"
        >
          <X className="w-3 h-3" /> Skip row
        </button>
      </div>
    </div>
  );
}

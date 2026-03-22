/**
 * ImportPage — Full import management hub.
 *
 * Features:
 *  - Upload CSV/Excel with field mapping review (spec §4, §7, §8)
 *  - Import history with status (spec §18)
 *  - Exception queue with inline fixes (spec §12)
 *  - Saved mapping templates (spec §14)
 *  - Repeat import with auto-applied templates (spec §19.2)
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Clock,
         ChevronRight, RotateCcw, BookTemplate, X, Wrench, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
import { parseExcelFile, isExcelFile, getSheetNames } from '@/lib/excel-parser';
import {
  inferMapping,
  buildHeaderSignature,
  matchesTemplate,
  MappingProposal,
  ConfirmedMapping,
  MappingTemplate,
  type ImportType,
} from '@/lib/mapping-engine';
import FieldMappingReview from '@/components/FieldMappingReview';

type View = 'list' | 'upload' | 'type-select' | 'mapping' | 'staging' | 'summary' | 'exceptions';

interface ParsedFile {
  file: File;
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

const STATUS_ICON: Record<string, { icon: React.FC<{ className?: string }>; color: string; label: string }> = {
  pending:    { icon: Clock,         color: 'text-muted-foreground', label: 'Pending' },
  processing: { icon: RotateCcw,     color: 'text-accent',          label: 'Processing' },
  staged:     { icon: Clock,         color: 'text-warning',          label: 'Awaiting commit' },
  completed:  { icon: CheckCircle2,  color: 'text-success',          label: 'Completed' },
  partial:    { icon: AlertTriangle, color: 'text-warning',          label: 'Partial' },
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
  const [importType, setImportType] = useState<ImportType>('invoice');

  const { data: batches = [],    isLoading: batchLoading   } = useImportBatches(orgId);
  const { data: exceptions = [], isLoading: excLoading      } = useImportExceptions(orgId);
  const { data: templates  = []                             } = useMappingTemplates(orgId);

  const stageImport     = useStageImport();
  const commitImport    = useCommitImport();
  const resolveExc      = useResolveException();
  const saveTemplate    = useSaveMappingTemplate();

  const openExceptions = exceptions.filter(e => e.status === 'open');

  // ── File handling ──────────────────────────────────────────────────────────

  const [excelSheets, setExcelSheets]   = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [pendingExcelFile, setPendingExcelFile] = useState<File | null>(null);

  const parseAndProcess = useCallback(async (file: File, sheetName?: string) => {
    try {
      const result = isExcelFile(file)
        ? await parseExcelFile(file, { maxRows: 2000, sheetName, dateFormat: 'iso' })
        : await parseCsvFile(file, { maxRows: 2000 });
      if (result.headers.length === 0) {
        toast.error('Could not read column headers from this file');
        return;
      }
      setParsed({ file, headers: result.headers, rows: result.rows, warnings: result.warnings });
      // Show type selector before mapping
      setView('type-select');
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
    }
  }, []);

  const proceedToMapping = useCallback((type: ImportType) => {
    if (!parsed) return;
    setImportType(type);
    const mappedTemplates: MappingTemplate[] = (templates ?? []).map((t: any) => ({
      id: t.id,
      templateName: t.template_name,
      headerSignature: t.header_signature,
      columnMappings: t.column_mappings ?? [],
      dateFormatHint: t.date_format_hint,
      defaultCurrency: t.default_currency,
      ignoredColumns: t.ignored_columns ?? [],
      timesUsed: t.times_used ?? 0,
      lastUsedAt: t.last_used_at,
    }));
    const matched = mappedTemplates.find(t => matchesTemplate(parsed.headers, t)) ?? null;
    setMatchedTemplate(matched);
    const inferred = inferMapping(parsed.headers, parsed.rows.slice(0, 10), matched, type);
    setProposals(inferred);
    if (parsed.warnings.length > 0) parsed.warnings.forEach(w => toast.warning(w));
    setView('mapping');
  }, [parsed, templates]);

  const handleFile = useCallback(async (file: File) => {
    const isExcel = isExcelFile(file);
    const isCsv = file.name.endsWith('.csv') || file.type.includes('csv');
    if (!isExcel && !isCsv) {
      toast.error('Please upload a CSV or Excel (.xlsx, .xls) file');
      return;
    }
    if (isExcel) {
      try {
        const sheets = await getSheetNames(file);
        if (sheets.length > 1) {
          setExcelSheets(sheets);
          setPendingExcelFile(file);
          return;
        }
      } catch (_) { /* fall through */ }
    }
    await parseAndProcess(file);
  }, [parseAndProcess]);


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
      const batchId = crypto.randomUUID();
      const { error: batchErr } = await supabase.from('import_batches').insert({
        id:                 batchId,
        organization_id:    orgId,
        created_by_user_id: (await supabase.auth.getUser()).data.user?.id,
        import_type:        importType === 'client' ? 'client_csv' : (isExcelFile(parsed.file) ? 'excel' : 'csv'),
        original_filename:  parsed.file.name,
        status:             'pending',
        total_rows:         parsed.rows.length,
        column_mapping:     mapping.fieldToColumn,
        source_headers:     parsed.headers,
      });
      if (batchErr) throw batchErr;

      setCurrentBatchId(batchId);
      setView('staging');

      const result = await stageImport.mutateAsync({
        orgId,
        importBatchId: batchId,
        rows: parsed.rows,
        columnMapping: mapping.fieldToColumn,
        dateFormatHint: mapping.dateFormatHint,
        defaultCurrency: mapping.defaultCurrency,
        importType,
      });

      setStagingResult(result);

      if (saveAs && parsed.headers.length > 0) {
        const colMappings = Object.entries(mapping.fieldToColumn).map(([canonical, src]) => ({
          sourceCol: src,
          canonicalField: canonical,
        }));
        await saveTemplate.mutateAsync({
          orgId,
          sourceType: isExcelFile(parsed.file) ? 'excel' : 'csv',
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
      const result = await commitImport.mutateAsync({ orgId, importBatchId: currentBatchId, importType });
      const entityLabel = importType === 'client' ? 'client' : 'invoice';
      const parts = [`${result.committed} ${entityLabel}${result.committed !== 1 ? 's' : ''} imported`];
      if (result.conflicts > 0) parts.push(`${result.conflicts} conflict${result.conflicts !== 1 ? 's' : ''} queued for review`);
      toast.success(parts.join(' · '));
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
    setTemplateSaveName('');
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
      <motion.div
        initial="hidden" animate="show" variants={stagger}
        className="p-4 max-w-2xl mx-auto space-y-4"
      >
        <motion.div variants={fadeUp} className="flex items-center gap-2 mb-2">
          <button onClick={() => { setView('upload'); setParsed(null); }} className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 transition-colors active:scale-[0.97]">
            <ArrowLeft className="w-4 h-4 inline mr-1" />Back
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate">{parsed.file.name}</span>
        </motion.div>
        {matchedTemplate && (
          <motion.div variants={fadeUp} className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm flex items-center gap-2">
            <BookTemplate className="w-4 h-4 text-accent shrink-0" />
            <span>Saved template <strong>{matchedTemplate.templateName}</strong> applied. Review and confirm.</span>
          </motion.div>
        )}
        <motion.div variants={fadeUp}>
          <FieldMappingReview
            headers={parsed.headers}
            sampleRows={parsed.rows.slice(0, 5)}
            proposals={proposals}
            defaultCurrency={org?.default_currency ?? 'USD'}
            onConfirm={handleMappingConfirm}
            onCancel={() => { setView('upload'); setParsed(null); }}
            hasSavedTemplate={!!matchedTemplate}
          />
        </motion.div>

        {/* Template save dialog */}
        <AnimatePresence>
          {showTemplateSave && pendingMapping && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && setShowTemplateSave(false)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md bg-card rounded-2xl p-6 space-y-4 shadow-xl border border-border"
              >
                <div className="w-10 h-1 rounded-full bg-border mx-auto sm:hidden" />
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                  <BookTemplate className="w-6 h-6 text-accent" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Save this mapping?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Future imports with the same columns will be mapped automatically.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="e.g. My QuickBooks export"
                  value={templateSaveName}
                  onChange={e => setTemplateSaveName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => runStaging(pendingMapping, null)}
                    className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] transition-all"
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
                    className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 active:scale-[0.97] transition-all"
                  >
                    Save & import
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  if (view === 'staging') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-8 flex flex-col items-center justify-center gap-4 min-h-[40vh]"
      >
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold">Analysing your file…</p>
          <p className="text-sm text-muted-foreground mt-1">Normalising rows and checking for issues</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: `${i * 300}ms` }} />
          ))}
        </div>
      </motion.div>
    );
  }

  if (view === 'summary' && stagingResult) {
    return (
      <motion.div
        initial="hidden" animate="show" variants={stagger}
        className="p-4 max-w-lg mx-auto space-y-5"
      >
        <motion.div variants={scaleIn} className="text-center pt-4">
          <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <h2 className="text-xl font-bold">Import ready to commit</h2>
          <p className="text-muted-foreground text-sm mt-1">Review the summary before finalising.</p>
        </motion.div>

        <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card divide-y divide-border shadow-sm">
          <SummaryRow label="Ready to import" value={stagingResult.staged} color="success" />
          <SummaryRow label="Need attention (exceptions)" value={stagingResult.excepted} color={stagingResult.excepted > 0 ? 'warning' : 'success'} />
          <SummaryRow label="Skipped (duplicates)" value={stagingResult.skipped} />
        </motion.div>

        {stagingResult.excepted > 0 && (
          <motion.div variants={fadeUp} className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning">{stagingResult.excepted} rows need attention</p>
                <p className="text-muted-foreground mt-0.5">
                  You can still commit the valid rows now, then fix the exceptions later.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="flex gap-3">
          {stagingResult.excepted > 0 && (
            <button
              onClick={() => setView('exceptions')}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] transition-all"
            >
              View exceptions first
            </button>
          )}
          <button
            onClick={handleCommit}
            disabled={stagingResult.staged === 0 || commitImport.isPending}
            className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 active:scale-[0.97] transition-all"
          >
            {commitImport.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Importing…
              </span>
            ) : (
              `Commit ${stagingResult.staged} ${importType === 'client' ? 'client' : 'invoice'}${stagingResult.staged !== 1 ? 's' : ''}`
            )}
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="hidden" animate="show" variants={stagger}
      className="p-4 space-y-6 max-w-2xl mx-auto"
    >
      {/* Page header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload invoices or clients from a spreadsheet</p>
        </div>
        <button
          onClick={() => setView('upload')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium shadow-sm hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] transition-all"
        >
          <Upload className="w-4 h-4" /> New import
        </button>
      </motion.div>

      {/* Open exceptions alert */}
      {openExceptions.length > 0 && (
        <motion.button
          variants={fadeUp}
          onClick={() => setView('exceptions')}
          className="w-full rounded-xl border border-warning/30 bg-warning/10 p-4 text-left flex items-center justify-between hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {openExceptions.length} row{openExceptions.length !== 1 ? 's' : ''} need attention
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">These rows couldn't be imported automatically</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-warning shrink-0" />
        </motion.button>
      )}

      {/* Type selector (invoices vs clients) */}
      <AnimatePresence mode="wait">
        {view === 'type-select' && parsed && (
          <motion.div
            key="type-select"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="text-center pt-2">
              <h2 className="text-lg font-semibold">What are you importing?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We found {parsed.headers.length} columns in <strong>{parsed.file.name}</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => proceedToMapping('invoice')}
                className="glass-card-hover rounded-xl p-6 text-center active:scale-[0.97] transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-6 h-6 text-accent" />
                </div>
                <p className="font-semibold text-sm">Invoices</p>
                <p className="text-xs text-muted-foreground mt-1">Import outstanding invoices and payment data</p>
              </button>
              <button
                onClick={() => proceedToMapping('client')}
                className="glass-card-hover rounded-xl p-6 text-center active:scale-[0.97] transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-success" />
                </div>
                <p className="font-semibold text-sm">Clients</p>
                <p className="text-xs text-muted-foreground mt-1">Import client contacts and company info</p>
              </button>
            </div>
            <button
              onClick={() => { setView('upload'); setParsed(null); }}
              className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 transition-colors active:scale-[0.97]"
            >
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Choose a different file
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload area (when view=upload) */}
      <AnimatePresence mode="wait">
        {view === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.xlsx,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleFile(f);
                };
                input.click();
              }}
              className={`group rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all active:scale-[0.99] ${
                isDragging
                  ? 'border-accent bg-accent/5 shadow-md'
                  : 'border-border bg-card hover:border-primary/40 hover:shadow-md hover:bg-muted/30'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${
                isDragging ? 'bg-accent/10' : 'bg-muted group-hover:bg-accent/10'
              }`}>
                <FileSpreadsheet className={`w-7 h-7 transition-colors ${isDragging ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'}`} />
              </div>
              <p className="font-medium">Drag & drop your file</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">
                CSV, Excel (.xlsx, .xls) · Any column names — we'll help you map them
              </p>
            </div>

            {/* Excel multi-sheet selector */}
            {excelSheets.length > 1 && pendingExcelFile && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
                <p className="text-sm font-medium">This workbook has multiple sheets. Which one contains your invoices?</p>
                <div className="space-y-2">
                  {excelSheets.map(s => (
                    <button
                      key={s}
                      onClick={async () => {
                        setExcelSheets([]);
                        await parseAndProcess(pendingExcelFile, s);
                        setPendingExcelFile(null);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-border bg-card text-sm hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {templates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Your saved templates</p>
                {templates.map(t => (
                  <div key={t.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div>
                      <p className="text-sm font-medium">{t.template_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.last_used_at ? `Last used ${new Date(t.last_used_at).toLocaleDateString()}` : 'Never used'}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <BookTemplate className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setView('list')}
              className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 transition-colors active:scale-[0.97]"
            >
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Back to import history
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exception queue */}
      <AnimatePresence mode="wait">
        {view === 'exceptions' && (
          <motion.div
            key="exceptions"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView(currentBatchId ? 'summary' : 'list')}
                className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 transition-colors active:scale-[0.97]"
              >
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />{currentBatchId ? 'Back to summary' : 'Back'}
              </button>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Exception queue ({openExceptions.length})</span>
            </div>

            {excLoading ? (
              <div className="text-center py-10">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading exceptions…</p>
              </div>
            ) : openExceptions.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-success" />
                </div>
                <p className="font-semibold">All exceptions resolved</p>
                {currentBatchId ? (
                  <button
                    onClick={() => setView('summary')}
                    className="mt-4 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold shadow-sm hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] transition-all"
                  >
                    Continue to commit
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">All rows imported successfully</p>
                )}
              </motion.div>
            ) : (
              <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-3">
                {openExceptions.map(exc => (
                  <motion.div key={exc.id} variants={fadeUp}>
                    <ExceptionCard
                      exception={exc}
                      onIgnore={() => handleIgnoreException(exc.id)}
                      onFixed={async (values) => {
                        if (!orgId) return;
                        try {
                          await resolveExc.mutateAsync({ orgId, exceptionId: exc.id, action: 'fixed', fixedValues: values });
                          toast.success('Fix applied — row ready to import');
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to apply fix');
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import history (default list view) */}
      {view === 'list' && (
        <>
          {batchLoading ? (
            <motion.div variants={fadeUp} className="text-center py-10">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading imports…</p>
            </motion.div>
          ) : batches.length === 0 ? (
            <motion.div variants={scaleIn} className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold">No imports yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload a CSV or Excel file to get started</p>
              <button
                onClick={() => setView('upload')}
                className="mt-5 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium shadow-sm hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] transition-all"
              >
                <Upload className="w-4 h-4 inline mr-1.5" />Upload file
              </button>
            </motion.div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-3">
              <motion.p variants={fadeUp} className="text-sm font-medium text-muted-foreground">Import history</motion.p>
              {batches.map(batch => {
                const s = STATUS_ICON[batch.status] ?? STATUS_ICON.pending;
                const Icon = s.icon;
                return (
                  <motion.div key={batch.id} variants={fadeUp} className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          batch.status === 'completed' ? 'bg-success/10' :
                          batch.status === 'failed' ? 'bg-destructive/10' :
                          'bg-muted'
                        }`}>
                          <Icon className={`w-4.5 h-4.5 ${s.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {batch.original_filename ?? batch.import_type.toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(batch.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                        batch.status === 'completed' ? 'text-success bg-success/10 border-success/20' :
                        batch.status === 'failed'    ? 'text-destructive bg-destructive/10 border-destructive/20' :
                        'text-warning bg-warning/10 border-warning/20'
                      }`}>
                        {s.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                      <Stat label="Imported" value={batch.successful_rows} color="success" />
                      <Stat label="Exceptions" value={batch.failed_rows} color={batch.failed_rows > 0 ? 'warning' : 'neutral'} />
                      <Stat label="Skipped" value={batch.duplicate_rows} />
                    </div>

                    {batch.open_exceptions > 0 && (
                      <button
                        onClick={() => setView('exceptions')}
                        className="mt-3 w-full text-xs text-warning font-medium flex items-center gap-1.5 justify-center py-2.5 rounded-xl bg-warning/10 border border-warning/20 hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] transition-all"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Fix {batch.open_exceptions} exception{batch.open_exceptions !== 1 ? 's' : ''}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${
        color === 'success' ? 'text-success' :
        color === 'warning' ? 'text-warning' :
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
        color === 'warning' ? 'text-warning' :
        'text-foreground'
      }`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Editable fields shown per exception type */
const FIXABLE_FIELDS: Record<string, Array<{ key: string; label: string; type: 'text' | 'date' | 'number' | 'email' }>> = {
  missing_critical_field: [
    { key: 'client_name',    label: 'Client name',  type: 'text' },
    { key: 'total_amount',   label: 'Amount',        type: 'number' },
    { key: 'due_date',       label: 'Due date',      type: 'date' },
    { key: 'billing_contact_email', label: 'Contact email', type: 'email' },
  ],
  invalid_email: [
    { key: 'billing_contact_email', label: 'Contact email', type: 'email' },
  ],
  impossible_date: [
    { key: 'due_date',       label: 'Due date',      type: 'date' },
    { key: 'issue_date',     label: 'Issue date',    type: 'date' },
  ],
  conflicting_amounts: [
    { key: 'total_amount',          label: 'Total amount',     type: 'number' },
    { key: 'amount_paid',           label: 'Amount paid',      type: 'number' },
    { key: 'remaining_balance',     label: 'Remaining balance', type: 'number' },
  ],
  unmatched_client: [
    { key: 'client_name',    label: 'Client name',   type: 'text' },
  ],
  source_conflict: [
    { key: 'client_name',    label: 'Client name',   type: 'text' },
    { key: 'total_amount',   label: 'Amount',         type: 'number' },
    { key: 'due_date',       label: 'Due date',       type: 'date' },
  ],
};

const TYPE_LABELS: Record<string, string> = {
  missing_critical_field: 'Missing required field',
  duplicate_candidate:    'Duplicate invoice',
  ambiguous_mapping:      'Ambiguous column',
  conflicting_amounts:    'Amount conflict',
  impossible_date:        'Invalid date',
  invalid_email:          'Invalid email',
  unmatched_client:       'Unknown client',
  source_conflict:        'Data conflict',
};

function ExceptionCard({
  exception,
  onIgnore,
  onFixed,
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
  onFixed: (values: Record<string, string>) => void;
}) {
  const [mode, setMode] = useState<'view' | 'fix'>('view');
  const [expanded, setExpanded] = useState(false);

  const snapshot = exception.candidate_snapshot ?? {};
  const raw      = exception.raw_values ?? {};
  const editableFields = FIXABLE_FIELDS[exception.exception_type] ?? FIXABLE_FIELDS.missing_critical_field;

  const [fixValues, setFixValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    editableFields.forEach(f => {
      init[f.key] = (snapshot[f.key] as string) ?? (raw[f.key] as string) ?? '';
    });
    return init;
  });

  const canSubmitFix = editableFields.some(f => fixValues[f.key]?.trim());
  const isError = exception.severity === 'error';

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-sm ${
      isError ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/10'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isError ? 'bg-destructive/10' : 'bg-warning/20'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${isError ? 'text-destructive' : 'text-warning'}`} />
          </div>
          <div>
            <p className="text-sm font-medium">
              {TYPE_LABELS[exception.exception_type] ?? exception.exception_type}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{exception.reason}</p>
          </div>
        </div>
        {mode === 'view' && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground underline shrink-0 active:scale-[0.95] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
          >
            {expanded ? 'Less' : 'Details'}
          </button>
        )}
      </div>

      {/* Details panel */}
      <AnimatePresence>
        {mode === 'view' && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-2 text-xs"
          >
            {exception.suggested_remediation && (
              <p className="text-muted-foreground">
                <Sparkles className="w-3 h-3 inline mr-1 text-accent" />
                <strong>Suggestion:</strong> {exception.suggested_remediation}
              </p>
            )}
            {Object.keys(snapshot).length > 0 && (
              <div className="rounded-xl bg-background border border-border p-3 font-mono space-y-0.5">
                {Object.entries(snapshot).map(([k, v]) =>
                  v ? (
                    <div key={k}>
                      <span className="text-muted-foreground">{k}:</span> {String(v)}
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline fix form */}
      <AnimatePresence>
        {mode === 'fix' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-3 pt-1"
          >
            <p className="text-xs font-medium text-muted-foreground">Edit the fields below and save to fix this row:</p>
            {editableFields.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium block mb-1">{f.label}</label>
                <input
                  type={f.type === 'number' ? 'text' : f.type}
                  value={fixValues[f.key] ?? ''}
                  onChange={e => setFixValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.type === 'date' ? 'YYYY-MM-DD' : ''}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setMode('view')}
                className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] transition-all"
              >
                Cancel
              </button>
              <button
                disabled={!canSubmitFix}
                onClick={() => {
                  onFixed(fixValues);
                  setMode('view');
                }}
                className="flex-1 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold shadow-sm hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 active:scale-[0.97] transition-all"
              >
                Save fix & retry import
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {mode === 'view' && (
        <div className="flex gap-2">
          <button
            onClick={onIgnore}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] transition-all"
          >
            <X className="w-3.5 h-3.5" /> Skip row
          </button>
          {exception.can_fix_in_ui && (
            <button
              onClick={() => setMode('fix')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] transition-all"
            >
              <Wrench className="w-3.5 h-3.5" /> Fix this row
            </button>
          )}
        </div>
      )}
    </div>
  );
}

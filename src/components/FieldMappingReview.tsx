/**
 * FieldMappingReview component
 *
 * Displays inferred column-to-field mappings for user review and confirmation.
 * Supports both invoice and client import types.
 */

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Info, ChevronDown, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  MappingProposal,
  ConfirmedMapping,
  CanonicalField,
  detectDateFormat,
  getCanonicalFields,
  getFieldMeta,
  type ImportType,
} from '@/lib/mapping-engine';

interface Props {
  headers: string[];
  sampleRows: Record<string, string>[];
  proposals: MappingProposal[];
  defaultCurrency: string;
  onConfirm: (mapping: ConfirmedMapping) => void;
  onCancel?: () => void;
  hasSavedTemplate?: boolean;
  importType?: ImportType;
}

const CONFIDENCE_COLORS = {
  high:   'text-success bg-success/10 border-success/30',
  medium: 'text-warning bg-warning/10 border-warning/30',
  low:    'text-muted-foreground bg-muted border-border',
};

const CONFIDENCE_LABELS = {
  high:   'Confident',
  medium: 'Check this',
  low:    'Needs review',
};

const DATE_FORMAT_OPTIONS = [
  { value: '',           label: 'Auto-detect' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (UK/EU)' },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function FieldMappingReview({
  headers,
  sampleRows,
  proposals,
  defaultCurrency,
  onConfirm,
  onCancel,
  hasSavedTemplate,
  importType = 'invoice',
}: Props) {
  const canonicalFields = getCanonicalFields(importType);
  const fieldMeta = getFieldMeta(importType);
  const isClientImport = importType === 'client';

  const [fieldMap, setFieldMap] = useState<Record<string, CanonicalField | ''>>(() => {
    const init: Record<string, CanonicalField | ''> = {};
    proposals.forEach(p => {
      init[p.sourceColumn] = p.suggestedField ?? '';
    });
    return init;
  });

  const [dateFormat, setDateFormat] = useState<string>(() => {
    if (isClientImport) return '';
    const dateCols = proposals.filter(p =>
      p.suggestedField === 'due_date' || p.suggestedField === 'issue_date',
    );
    const allSamples = dateCols.flatMap(p => p.sampleValues);
    return detectDateFormat(allSamples) ?? '';
  });

  const [currency, setCurrency] = useState(defaultCurrency || 'USD');
  const [showPreview, setShowPreview] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasonings, setAiReasonings] = useState<Record<string, string>>({});

  const usedFields = useMemo(
    () => new Set(Object.values(fieldMap).filter(Boolean)),
    [fieldMap],
  );

  const criticalFields: CanonicalField[] = isClientImport
    ? ['client_name']
    : ['client_name', 'amount', 'due_date'];

  const missingCritical = useMemo(() => {
    return criticalFields.filter(f => !usedFields.has(f));
  }, [usedFields, criticalFields]);

  const canProceed = missingCritical.length === 0;

  const needsAttention = proposals.filter(p => {
    if (p.confidence === 'low' && !fieldMap[p.sourceColumn]) return true;
    if (fieldMeta[p.suggestedField as CanonicalField]?.isCritical && p.confidence !== 'high') return true;
    return false;
  });

  const lowConfidenceCols = proposals.filter(
    p => p.confidence === 'low' || (!fieldMap[p.sourceColumn] && p.matchReason === 'none'),
  );

  const askAI = useCallback(async () => {
    if (lowConfidenceCols.length === 0) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-map-columns', {
        body: {
          columns: lowConfidenceCols.map(p => ({
            sourceColumn: p.sourceColumn,
            sampleValues: p.sampleValues,
            currentSuggestion: fieldMap[p.sourceColumn] || null,
          })),
          importType,
        },
      });

      if (error) throw error;

      const suggestions: Array<{
        sourceColumn: string;
        suggestedField: CanonicalField | null;
        confidence: string;
        reasoning: string;
      }> = data?.suggestions ?? [];

      const newReasonings: Record<string, string> = {};
      suggestions.forEach(s => {
        if (s.suggestedField && !fieldMap[s.sourceColumn]) {
          setFieldMap(prev => {
            const updated = { ...prev };
            if (!updated[s.sourceColumn] && s.suggestedField) {
              updated[s.sourceColumn] = s.suggestedField;
            }
            return updated;
          });
        }
        if (s.reasoning) newReasonings[s.sourceColumn] = s.reasoning;
      });
      setAiReasonings(prev => ({ ...prev, ...newReasonings }));
    } catch {
      toast.error('AI suggestions unavailable — please map columns manually');
    } finally {
      setAiLoading(false);
    }
  }, [lowConfidenceCols, fieldMap, importType]);

  function handleFieldChange(sourceCol: string, val: CanonicalField | '') {
    setFieldMap(prev => {
      const updated = { ...prev };
      if (val && val !== 'ignore') {
        Object.keys(updated).forEach(k => {
          if (k !== sourceCol && updated[k] === val) updated[k] = '';
        });
      }
      updated[sourceCol] = val;
      return updated;
    });
  }

  function buildConfirmedMapping(): ConfirmedMapping {
    const fieldToColumn: Record<string, string> = {};
    const ignoredColumns: string[] = [];

    Object.entries(fieldMap).forEach(([sourceCol, canonical]) => {
      if (!canonical || canonical === 'ignore') {
        ignoredColumns.push(sourceCol);
      } else {
        fieldToColumn[canonical] = sourceCol;
      }
    });

    return { fieldToColumn, dateFormatHint: dateFormat || null, defaultCurrency: currency, ignoredColumns };
  }

  const mappedCount = Object.values(fieldMap).filter(v => v && v !== 'ignore').length;
  const entityLabel = isClientImport ? 'client' : 'invoice';

  return (
    <motion.div
      initial="hidden" animate="show" variants={stagger}
      className="space-y-5"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h3 className="text-lg font-semibold leading-tight">
          Review {entityLabel} column mapping
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          We found {headers.length} columns — {mappedCount} mapped so far.
          {hasSavedTemplate && (
            <span className="ml-1 text-primary font-medium">Saved template applied.</span>
          )}
        </p>
      </motion.div>

      {/* Summary chips */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
        <Chip color="success">{proposals.filter(p => p.confidence === 'high').length} confident</Chip>
        <Chip color="warning">{proposals.filter(p => p.confidence === 'medium').length} to check</Chip>
        {needsAttention.length > 0 && (
          <Chip color="destructive">{needsAttention.length} need attention</Chip>
        )}
      </motion.div>

      {/* AI assist button */}
      {lowConfidenceCols.length > 0 && (
        <motion.button
          variants={fadeUp}
          onClick={askAI}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 active:scale-[0.98] transition-all"
        >
          {aiLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Asking AI…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Ask AI to suggest {lowConfidenceCols.length} unmapped column{lowConfidenceCols.length !== 1 ? 's' : ''}</>
          )}
        </motion.button>
      )}

      {/* Missing critical fields warning */}
      {missingCritical.length > 0 && (
        <motion.div variants={fadeUp} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium text-destructive">Required fields not mapped: </span>
            {missingCritical.map(f => fieldMeta[f]?.label ?? f).join(', ')}.
            Please assign these before continuing.
          </div>
        </motion.div>
      )}

      {/* Date format & currency — show date format only for invoices */}
      <motion.div variants={fadeUp} className={`flex gap-4 items-start rounded-xl border border-border bg-card p-4 ${isClientImport ? '' : ''}`}>
        {!isClientImport && (
          <div className="flex-1">
            <label className="text-sm font-medium block mb-1.5">Date format</label>
            <div className="relative">
              <select
                value={dateFormat}
                onChange={e => setDateFormat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pr-8"
              >
                {DATE_FORMAT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1.5">Default currency</label>
          <div className="relative">
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pr-8"
            >
              {['USD','GBP','EUR','CAD','AUD','CHF','NZD','SGD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </motion.div>

      {/* Column mapping table */}
      <motion.div variants={fadeUp} className="rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-0 text-xs font-medium text-muted-foreground bg-muted/40 px-4 py-2.5 border-b border-border">
          <span>Your column</span>
          <span>Maps to</span>
          <span className="w-24 text-center">Confidence</span>
        </div>
        <div className="divide-y divide-border">
          {proposals.map((p, i) => {
            const current = fieldMap[p.sourceColumn] ?? '';
            const meta = current && current !== 'ignore' ? fieldMeta[current as CanonicalField] : null;
            const isMissing = !current && fieldMeta[p.suggestedField as CanonicalField]?.isCritical;
            return (
              <motion.div
                key={p.sourceColumn}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={`px-4 py-3.5 grid grid-cols-[1fr_1fr_auto] gap-3 items-start transition-colors ${
                  isMissing ? 'bg-destructive/5' : 'hover:bg-muted/30'
                }`}
              >
                {/* Source column */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.sourceColumn}</p>
                  {p.sampleValues.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      e.g. {p.sampleValues.slice(0, 2).join(', ')}
                    </p>
                  )}
                  {p.validationHint && (
                    <div className="flex items-start gap-1 mt-1.5">
                      <Info className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-warning">{p.validationHint}</p>
                    </div>
                  )}
                  {aiReasonings[p.sourceColumn] && (
                    <div className="flex items-start gap-1 mt-1.5">
                      <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-primary/80">{aiReasonings[p.sourceColumn]}</p>
                    </div>
                  )}
                </div>

                {/* Canonical field selector */}
                <div className="min-w-0">
                  <div className="relative">
                    <select
                      value={current}
                      onChange={e => handleFieldChange(p.sourceColumn, e.target.value as CanonicalField | '')}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm appearance-none bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 pr-8 transition-colors ${
                        !current ? 'border-warning/50 text-muted-foreground' : 'border-border'
                      }`}
                    >
                      <option value="">— Not mapped —</option>
                      {(canonicalFields as readonly CanonicalField[]).filter(f => f !== 'ignore').map(f => {
                        const m = fieldMeta[f];
                        if (!m) return null;
                        const taken = usedFields.has(f) && f !== current;
                        return (
                          <option key={f} value={f} disabled={taken}>
                            {m.label}{m.required ? ' *' : ''}{taken ? ' (used)' : ''}
                          </option>
                        );
                      })}
                      <option value="ignore">— Ignore this column —</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {meta && (
                    <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                  )}
                </div>

                {/* Confidence badge */}
                <div className="w-24 flex items-start justify-center pt-1.5">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${CONFIDENCE_COLORS[p.confidence]}`}>
                    {CONFIDENCE_LABELS[p.confidence]}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Preview toggle */}
      {sampleRows.length > 0 && (
        <motion.button
          variants={fadeUp}
          onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg px-2 py-1 -mx-2 active:scale-[0.97] transition-all"
        >
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showPreview ? 'Hide preview' : `Preview mapped data (first 3 rows)`}
        </motion.button>
      )}

      {showPreview && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <MappedPreview rows={sampleRows.slice(0, 3)} fieldMap={fieldMap} fieldMeta={fieldMeta} />
        </motion.div>
      )}

      {/* Actions */}
      <motion.div variants={fadeUp} className="flex gap-3 pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-5 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] transition-all"
          >
            Back
          </button>
        )}
        <button
          disabled={!canProceed}
          onClick={() => onConfirm(buildConfirmedMapping())}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] transition-all"
        >
          {canProceed
            ? `Confirm and import ${mappedCount} fields`
            : `Fix ${missingCritical.length} required field${missingCritical.length > 1 ? 's' : ''} first`}
        </button>
      </motion.div>
    </motion.div>
  );
}

function MappedPreview({
  rows,
  fieldMap,
  fieldMeta,
}: {
  rows: Record<string, string>[];
  fieldMap: Record<string, CanonicalField | ''>;
  fieldMeta: Record<string, { label: string }>;
}) {
  const mapped = Object.entries(fieldMap)
    .filter(([, f]) => f && f !== 'ignore')
    .map(([src, can]) => ({ src, can: can as CanonicalField }));

  if (mapped.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        Preview — how your data will be imported
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {mapped.map(({ can }) => (
                <th key={can} className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  {fieldMeta[can]?.label ?? can}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-b-0 hover:bg-muted/10">
                {mapped.map(({ src, can }) => (
                  <td key={can} className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                    {row[src] || <span className="text-muted-foreground/40 italic">empty</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  const colorClass =
    color === 'success' ? 'bg-success/10 text-success border-success/20' :
    color === 'warning' ? 'bg-warning/10 text-warning border-warning/20' :
    color === 'destructive' ? 'bg-destructive/10 text-destructive border-destructive/20' :
    'bg-muted text-muted-foreground border-border';
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${colorClass}`}>
      {children}
    </span>
  );
}

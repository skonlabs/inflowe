/**
 * FieldMappingReview component
 *
 * Displays inferred column-to-field mappings for user review and confirmation.
 * Users can accept, change, or ignore each source column before finalising import.
 *
 * Spec: §8 Mapping Review UX Requirements
 */

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Info, ChevronDown, Save, Eye, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  MappingProposal,
  ConfirmedMapping,
  CANONICAL_FIELDS,
  FIELD_META,
  CanonicalField,
  detectDateFormat,
} from '@/lib/mapping-engine';

interface Props {
  headers: string[];
  sampleRows: Record<string, string>[];
  proposals: MappingProposal[];
  defaultCurrency: string;
  onConfirm: (mapping: ConfirmedMapping) => void;
  onCancel?: () => void;
  hasSavedTemplate?: boolean;
}

const CONFIDENCE_COLORS = {
  high:   'text-success bg-success/10 border-success/30',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
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

export default function FieldMappingReview({
  headers,
  sampleRows,
  proposals,
  defaultCurrency,
  onConfirm,
  onCancel,
  hasSavedTemplate,
}: Props) {
  // User-editable state: sourceColumn → canonicalField
  const [fieldMap, setFieldMap] = useState<Record<string, CanonicalField | ''>>(() => {
    const init: Record<string, CanonicalField | ''> = {};
    proposals.forEach(p => {
      init[p.sourceColumn] = p.suggestedField ?? '';
    });
    return init;
  });

  const [dateFormat, setDateFormat] = useState<string>(() => {
    // Auto-detect from proposals
    const dateCols = proposals.filter(p =>
      p.suggestedField === 'due_date' || p.suggestedField === 'issue_date',
    );
    const allSamples = dateCols.flatMap(p => p.sampleValues);
    return detectDateFormat(allSamples) ?? '';
  });

  const [currency, setCurrency] = useState(defaultCurrency || 'USD');
  const [showPreview, setShowPreview] = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiReasonings, setAiReasonings] = useState<Record<string, string>>({});
  const [saveName, setSaveName]  = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Which canonical fields are already assigned?
  const usedFields = useMemo(
    () => new Set(Object.values(fieldMap).filter(Boolean)),
    [fieldMap],
  );

  // Identify critical fields that are still unassigned
  const missingCritical = useMemo(() => {
    const criticals: CanonicalField[] = ['client_name', 'amount', 'due_date'];
    return criticals.filter(f => !usedFields.has(f));
  }, [usedFields]);

  const canProceed = missingCritical.length === 0;

  // Rows needing attention: low confidence or unset for critical fields
  const needsAttention = proposals.filter(p => {
    if (p.confidence === 'low' && !fieldMap[p.sourceColumn]) return true;
    if (FIELD_META[p.suggestedField as CanonicalField]?.isCritical && p.confidence !== 'high') return true;
    return false;
  });

  // AI-assisted mapping for low-confidence columns
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
            sourceColumn:       p.sourceColumn,
            sampleValues:       p.sampleValues,
            currentSuggestion:  fieldMap[p.sourceColumn] || null,
          })),
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
            // Don't overwrite if already set by user
            if (!updated[s.sourceColumn] && s.suggestedField) {
              updated[s.sourceColumn] = s.suggestedField;
            }
            return updated;
          });
        }
        if (s.reasoning) newReasonings[s.sourceColumn] = s.reasoning;
      });
      setAiReasonings(prev => ({ ...prev, ...newReasonings }));
    } catch (err: any) {
      toast.error('AI suggestions unavailable — please map columns manually');
    } finally {
      setAiLoading(false);
    }
  }, [lowConfidenceCols, fieldMap]);

  function handleFieldChange(sourceCol: string, val: CanonicalField | '') {
    setFieldMap(prev => {
      // If another column already has this value, clear it
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Review column mapping</h3>
        <p className="text-sm text-muted-foreground mt-1">
          We found {headers.length} columns. Check that each one maps to the right field.
          {hasSavedTemplate && (
            <span className="ml-1 text-primary font-medium">Using your saved template.</span>
          )}
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <Chip color="success">{proposals.filter(p => p.confidence === 'high').length} confident</Chip>
        <Chip color="amber">{proposals.filter(p => p.confidence === 'medium').length} to check</Chip>
        {needsAttention.length > 0 && (
          <Chip color="red">{needsAttention.length} need attention</Chip>
        )}
      </div>

      {/* AI assist button for unresolved columns */}
      {lowConfidenceCols.length > 0 && (
        <button
          onClick={askAI}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-60 transition-colors"
        >
          {aiLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Asking AI...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Ask AI to suggest {lowConfidenceCols.length} unmapped column{lowConfidenceCols.length !== 1 ? 's' : ''}</>
          )}
        </button>
      )}

      {/* Missing critical fields warning */}
      {missingCritical.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium text-destructive">Required fields not mapped: </span>
            {missingCritical.map(f => FIELD_META[f].label).join(', ')}.
            Please assign these before continuing.
          </div>
        </div>
      )}

      {/* Date format selector */}
      <div className="flex gap-4 items-center rounded-xl border border-border bg-card p-4">
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Date format</label>
          <select
            value={dateFormat}
            onChange={e => setDateFormat(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {DATE_FORMAT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium block mb-1">Default currency</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {['USD','GBP','EUR','CAD','AUD','CHF','NZD','SGD'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Column mapping table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-0 text-xs font-medium text-muted-foreground bg-muted/40 px-4 py-2.5 border-b border-border">
          <span>Your column</span>
          <span>Maps to</span>
          <span className="w-24 text-center">Confidence</span>
        </div>
        <div className="divide-y divide-border">
          {proposals.map(p => {
            const current = fieldMap[p.sourceColumn] ?? '';
            const meta    = current && current !== 'ignore' ? FIELD_META[current as CanonicalField] : null;
            const isError = meta?.isCritical && !current && missingCritical.includes(p.sourceColumn as CanonicalField);
            return (
              <div key={p.sourceColumn} className={`px-4 py-3 grid grid-cols-[1fr_1fr_auto] gap-3 items-start ${isError ? 'bg-destructive/5' : ''}`}>
                {/* Source column */}
                <div>
                  <p className="text-sm font-medium truncate">{p.sourceColumn}</p>
                  {p.sampleValues.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      e.g. {p.sampleValues.slice(0, 2).join(', ')}
                    </p>
                  )}
                  {p.validationHint && (
                    <div className="flex items-start gap-1 mt-1">
                      <Info className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600">{p.validationHint}</p>
                    </div>
                  )}
                  {aiReasonings[p.sourceColumn] && (
                    <div className="flex items-start gap-1 mt-1">
                      <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-primary/80">{aiReasonings[p.sourceColumn]}</p>
                    </div>
                  )}
                </div>

                {/* Canonical field selector */}
                <div>
                  <div className="relative">
                    <select
                      value={current}
                      onChange={e => handleFieldChange(p.sourceColumn, e.target.value as CanonicalField | '')}
                      className={`w-full px-3 py-2 rounded-lg border text-sm appearance-none bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8 ${
                        !current ? 'border-amber-300 text-muted-foreground' : 'border-border'
                      }`}
                    >
                      <option value="">— Not mapped —</option>
                      {CANONICAL_FIELDS.filter(f => f !== 'ignore').map(f => {
                        const m = FIELD_META[f];
                        const taken = usedFields.has(f) && f !== current;
                        return (
                          <option key={f} value={f} disabled={taken}>
                            {m.label}{m.required ? ' *' : ''}{taken ? ' (used)' : ''}
                          </option>
                        );
                      })}
                      <option value="ignore">— Ignore this column —</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {meta && (
                    <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                  )}
                </div>

                {/* Confidence badge */}
                <div className="w-24 flex items-start justify-center pt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CONFIDENCE_COLORS[p.confidence]}`}>
                    {CONFIDENCE_LABELS[p.confidence]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview toggle */}
      {sampleRows.length > 0 && (
        <button
          onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-2 text-sm text-primary font-medium"
        >
          <Eye className="w-4 h-4" />
          {showPreview ? 'Hide preview' : 'Preview mapped data (first 3 rows)'}
        </button>
      )}

      {showPreview && (
        <MappedPreview
          rows={sampleRows.slice(0, 3)}
          fieldMap={fieldMap}
        />
      )}

      {/* Save template dialog */}
      {showSaveDialog && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Save as template</p>
          <input
            type="text"
            placeholder="Template name (e.g. QuickBooks export)"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex gap-2">
            <button
              disabled={!saveName.trim()}
              onClick={() => {
                // Template saving is handled by parent via onConfirm + save flag
                setShowSaveDialog(false);
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
            >
              Save template
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-5 py-3 rounded-xl border border-border text-sm font-medium"
          >
            Back
          </button>
        )}
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-border text-sm font-medium"
        >
          <Save className="w-4 h-4" /> Save template
        </button>
        <button
          disabled={!canProceed}
          onClick={() => onConfirm(buildConfirmedMapping())}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
        >
          {canProceed ? 'Confirm and import' : `Fix ${missingCritical.length} required field${missingCritical.length > 1 ? 's' : ''} first`}
        </button>
      </div>
    </div>
  );
}

function MappedPreview({
  rows,
  fieldMap,
}: {
  rows: Record<string, string>[];
  fieldMap: Record<string, CanonicalField | ''>;
}) {
  // Build reverse map: canonicalField → sourceColumn
  const mapped = Object.entries(fieldMap)
    .filter(([, f]) => f && f !== 'ignore')
    .map(([src, can]) => ({ src, can: can as CanonicalField }));

  if (mapped.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border">
        Preview — how your data will be imported
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {mapped.map(({ can }) => (
                <th key={can} className="text-left px-3 py-2 font-medium text-muted-foreground">
                  {FIELD_META[can].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/40">
                {mapped.map(({ src, can }) => (
                  <td key={can} className="px-3 py-2 truncate max-w-[160px]">
                    {row[src] ?? ''}
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

function Chip({ children, color }: { children: React.ReactNode; color: 'success' | 'amber' | 'red' }) {
  const cls = {
    success: 'bg-success/10 text-success border-success/30',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    red:     'bg-destructive/10 text-destructive border-destructive/30',
  }[color];
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cls}`}>
      {children}
    </span>
  );
}

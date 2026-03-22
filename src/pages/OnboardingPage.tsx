import { forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Upload, Database, Mail, Play, Building2, Palette, FileSpreadsheet, Eye, Shield, Sparkles, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useStageImport, useCommitImport } from '@/hooks/use-supabase-data';
import { parseCsvFile } from '@/lib/csv-parser';
import { parseExcelFile, isExcelFile } from '@/lib/excel-parser';
import { inferMapping, buildHeaderSignature, MappingProposal, ConfirmedMapping } from '@/lib/mapping-engine';
import FieldMappingReview from '@/components/FieldMappingReview';

const steps = [
  { title: 'Create your org', icon: Building2 },
  { title: 'Set your tone', icon: Palette },
  { title: 'Choose your path', icon: FileSpreadsheet },
  { title: 'Import data', icon: Upload },
  { title: 'Map columns', icon: FileSpreadsheet },
  { title: 'Review', icon: Eye },
  { title: 'Trust mode', icon: Shield },
  { title: 'Preview actions', icon: Sparkles },
  { title: 'Go live', icon: Play },
];

interface OrgData {
  businessName: string;
  displayName: string;
  country: string;
  currency: string;
  timezone: string;
  senderEmail: string;
  senderName: string;
  brandTone: string;
  importPath: string;
  trustMode: string;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const stageImport  = useStageImport();
  const commitImport = useCommitImport();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [csvHeaders, setCsvHeaders]   = useState<string[]>([]);
  const [csvRows, setCsvRows]         = useState<Array<Record<string, string>>>([]);
  const [csvProposals, setCsvProposals] = useState<MappingProposal[]>([]);
  const [confirmedMapping, setConfirmedMapping] = useState<ConfirmedMapping | null>(null);
  const [data, setData] = useState<OrgData>({
    businessName: '',
    displayName: '',
    country: 'US',
    currency: 'USD',
    timezone: 'America/New_York',
    senderEmail: '',
    senderName: '',
    brandTone: 'professional',
    importPath: '',
    trustMode: 'approval',
  });

  const update = (field: keyof OrgData, value: string) => setData(d => ({ ...d, [field]: value }));

  const canNext = step < steps.length - 1;
  const canBack = step > 0;

  // Step 4 (Map columns) is only shown for CSV path
  const isStepVisible = (s: number) => {
    if (s === 4 && data.importPath !== 'csv') return false;
    return true;
  };

  const nextVisibleStep = (from: number) => {
    let next = from + 1;
    while (next < steps.length && !isStepVisible(next)) next++;
    return next;
  };
  const prevVisibleStep = (from: number) => {
    let prev = from - 1;
    while (prev >= 0 && !isStepVisible(prev)) prev--;
    return prev;
  };

  const isStepValid = () => {
    if (step === 0) return data.businessName.trim().length > 0;
    if (step === 1) return data.senderEmail.trim().length > 0;
    if (step === 2) return data.importPath.length > 0;
    // Step 4: mapping review — must have confirmed mapping if CSV
    if (step === 4 && data.importPath === 'csv') return confirmedMapping !== null;
    return true;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: orgId, error } = await supabase.rpc('create_organization_with_membership', {
        _legal_name: data.businessName,
        _display_name: data.displayName || data.businessName,
        _country: data.country,
        _default_currency: data.currency,
        _timezone: data.timezone,
        _sender_email: data.senderEmail || null,
        _sender_display_name: data.senderName || null,
        _brand_tone: data.brandTone,
        _is_demo: data.importPath === 'demo',
      });

      if (error) throw error;

      // If CSV path was chosen and we have a confirmed mapping, import
      if (data.importPath === 'csv' && csvRows.length > 0 && confirmedMapping && orgId) {
        try {
          const batchId = crypto.randomUUID();
          await supabase.from('import_batches').insert({
            id: batchId,
            organization_id: orgId,
            created_by_user_id: user!.id,
            import_type: 'csv',
            status: 'pending',
            total_rows: csvRows.length,
            column_mapping: confirmedMapping.fieldToColumn,
          });
          await stageImport.mutateAsync({
            orgId,
            importBatchId: batchId,
            rows: csvRows,
            columnMapping: confirmedMapping.fieldToColumn,
            dateFormatHint: confirmedMapping.dateFormatHint,
            defaultCurrency: confirmedMapping.defaultCurrency,
          });
          await commitImport.mutateAsync({ orgId, importBatchId: batchId });
        } catch (importErr: any) {
          // Non-fatal — org is created, import can be retried from /import
          toast.warning(`Org created but CSV import failed: ${importErr?.message ?? 'unknown error'}`);
        }
      }

      // Invalidate cached membership query so ProtectedRoute picks up the new org
      await queryClient.invalidateQueries({ queryKey: ['user-organization'] });

      toast.success('InFlowe is ready! Welcome aboard.');
      navigate('/');
    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">IF</span>
          </div>
          <span className="font-semibold text-lg">InFlowe</span>
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Step {step + 1} of {steps.length}</p>
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && <StepOrganization data={data} update={update} />}
            {step === 1 && <StepTone data={data} update={update} />}
            {step === 2 && <StepPath data={data} update={update} />}
            {step === 3 && (
              <StepImport
                data={data}
                onDataParsed={(rows, headers, proposals) => {
                  setCsvRows(rows);
                  setCsvHeaders(headers);
                  setCsvProposals(proposals);
                  setConfirmedMapping(null);
                }}
              />
            )}
            {step === 4 && data.importPath === 'csv' && csvProposals.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Map your columns</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    We've matched most columns automatically. Review and confirm before importing.
                  </p>
                </div>
                <FieldMappingReview
                  headers={csvHeaders}
                  sampleRows={csvRows.slice(0, 5)}
                  proposals={csvProposals}
                  defaultCurrency={data.currency}
                  onConfirm={(mapping) => {
                    setConfirmedMapping(mapping);
                    setStep(nextVisibleStep(4));
                  }}
                  onCancel={() => setStep(3)}
                />
              </div>
            )}
            {step === 5 && <StepReview data={data} csvRowCount={csvRows.length} confirmedMapping={confirmedMapping} />}
            {step === 6 && <StepTrust data={data} update={update} />}
            {step === 7 && <StepPreview />}
            {step === 8 && <StepActivate data={data} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex gap-3 max-w-screen-xl mx-auto">
          {canBack && (
            <button
              onClick={() => setStep(s => prevVisibleStep(s))}
              className="flex items-center justify-center gap-1 px-5 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {canNext ? (
            <button
              onClick={() => setStep(s => nextVisibleStep(s))}
              disabled={!isStepValid()}
              className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Play className="w-4 h-4" /> Launch InFlowe</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  data: OrgData;
  update?: (field: keyof OrgData, value: string) => void;
}

function StepOrganization({ data, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Let's set up your business</h2>
        <p className="text-muted-foreground text-sm mt-2">This takes about 2 minutes. You can always change these later.</p>
      </div>
      <div className="space-y-4">
        <Field label="Business name" placeholder="e.g. Acme Creative Agency" value={data.businessName} onChange={v => update?.('businessName', v)} required />
        <Field label="Display name" placeholder="How clients see you" value={data.displayName} onChange={v => update?.('displayName', v)} helper="This appears in emails sent on your behalf" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Country</label>
            <select value={data.country} onChange={e => update?.('country', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow">
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Currency</label>
            <select value={data.currency} onChange={e => update?.('currency', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow">
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Timezone</label>
          <select value={data.timezone} onChange={e => update?.('timezone', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow">
            <option value="America/New_York">Eastern (ET)</option>
            <option value="America/Chicago">Central (CT)</option>
            <option value="America/Denver">Mountain (MT)</option>
            <option value="America/Los_Angeles">Pacific (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Berlin">Berlin (CET)</option>
            <option value="Australia/Sydney">Sydney (AEST)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function StepTone({ data, update }: StepProps) {
  const tones = [
    { id: 'professional', label: 'Professional', desc: 'Polished and business-like' },
    { id: 'friendly', label: 'Friendly', desc: 'Warm and approachable' },
    { id: 'firm', label: 'Firm', desc: 'Direct and clear' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>How should we sound?</h2>
        <p className="text-muted-foreground text-sm mt-2">Choose the tone for follow-up messages sent to your clients.</p>
      </div>
      <div className="space-y-4">
        <Field label="Sender email" placeholder="billing@youragency.com" value={data.senderEmail} onChange={v => update?.('senderEmail', v)} required />
        <Field label="Sender name" placeholder="Your Agency Name" value={data.senderName} onChange={v => update?.('senderName', v)} />
        <div className="space-y-2">
          <label className="text-sm font-medium">Brand tone</label>
          {tones.map(t => (
            <button
              key={t.id}
              onClick={() => update?.('brandTone', t.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                data.brandTone === t.id ? 'border-accent bg-accent/10 ring-2 ring-accent/20' : 'border-border bg-card'
              }`}
            >
              <p className="font-medium text-sm">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPath({ data, update }: StepProps) {
  const paths = [
    { id: 'csv', icon: FileSpreadsheet, label: 'Upload a spreadsheet', desc: 'Fastest setup. Works immediately.', rec: 'Best if you track invoices in Excel or Google Sheets' },
    { id: 'mailbox', icon: Mail, label: 'Connect your email', desc: "Great if you're in Gmail or Outlook.", rec: "We'll scan for invoice-related conversations" },
    { id: 'accounting', icon: Database, label: 'Connect accounting software', desc: 'Best if you use QuickBooks or Xero.', rec: 'Auto-imports all your invoices and payments' },
    { id: 'demo', icon: Play, label: 'Explore with demo data', desc: 'Try before connecting anything.', rec: 'See how InFlowe works with sample data' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>How do you track invoices today?</h2>
        <p className="text-muted-foreground text-sm mt-2">Pick what feels right — you can add more sources later.</p>
      </div>
      <div className="space-y-3">
        {paths.map(p => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              onClick={() => update?.('importPath', p.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                data.importPath === p.id ? 'border-accent bg-accent/10 ring-2 ring-accent/20' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  <p className="text-xs text-accent mt-1">{p.rec}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepImport({
  data,
  onDataParsed,
}: StepProps & {
  onDataParsed?: (
    rows: Array<Record<string, string>>,
    headers: string[],
    proposals: MappingProposal[],
  ) => void;
}) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rowCount, setRowCount]         = useState(0);
  const [previewRows, setPreviewRows]   = useState<Record<string, string>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging]     = useState(false);

  const handleFile = async (file: File) => {
    setUploadedFile(file);
    try {
      const parsed = isExcelFile(file)
        ? await parseExcelFile(file, { maxRows: 2000, dateFormat: 'iso' })
        : await parseCsvFile(file);
      setRowCount(parsed.rows.length);
      setPreviewHeaders(parsed.headers);
      setPreviewRows(parsed.rows.slice(0, 3));
      if (parsed.rows.length > 0) {
        const proposals = inferMapping(parsed.headers, parsed.rows.slice(0, 10));
        onDataParsed?.(parsed.rows, parsed.headers, proposals);
      }
      if (parsed.warnings.length > 0) parsed.warnings.forEach(w => toast.warning(w));
    } catch (err: any) {
      toast.error(err.message || 'Failed to read file');
      setUploadedFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const csv = 'client_name,invoice_number,amount,due_date,contact_email,currency\nAcme Corp,INV-001,5000,2025-04-15,billing@acme.com,USD\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'inflowe-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Import your invoices</h2>
        <p className="text-muted-foreground text-sm mt-2">
          {data.importPath === 'demo'
            ? "We'll set up demo data so you can explore right away."
            : 'Upload your invoice spreadsheet — any column names are fine.'}
        </p>
      </div>
      {data.importPath !== 'demo' ? (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleFile(f);
              };
              input.click();
            }}
            className={`glass-card rounded-xl p-6 text-center space-y-4 cursor-pointer transition-colors ${isDragging ? 'border-2 border-primary bg-accent/30' : ''}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              {uploadedFile ? <Check className="w-8 h-8 text-success" /> : <Upload className="w-8 h-8 text-primary" />}
            </div>
            {uploadedFile ? (
              <div>
                <p className="font-medium">{uploadedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {rowCount > 0 ? `${rowCount} data rows found` : 'Processing...'}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drag & drop your CSV file</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </div>
            )}
          </div>

          {previewRows.length > 0 && previewHeaders.length > 0 && (
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
                Preview — columns detected: {previewHeaders.length}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {previewHeaders.slice(0, 5).map((h, i) => (
                        <th key={i} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border/40">
                        {previewHeaders.slice(0, 5).map((h, j) => (
                          <td key={j} className="px-3 py-2">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button onClick={downloadTemplate} className="text-sm text-accent font-medium underline underline-offset-2">
            Download template CSV
          </button>
        </>
      ) : (
        <div className="glass-card rounded-xl p-6 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-success" />
          </div>
          <p className="font-medium">Demo data loaded</p>
          <p className="text-sm text-muted-foreground">12 invoices across 7 clients are ready to explore.</p>
        </div>
      )}
      <div className="bg-accent/50 rounded-xl p-4">
        <p className="text-sm text-accent-foreground">
          💡 <strong>Tip:</strong>{' '}
          {data.importPath === 'demo'
            ? 'Demo data lets you explore all features safely. No real messages will be sent.'
            : 'Any column names work — you\'ll map them to the right fields on the next step.'}
        </p>
      </div>
    </div>
  );
}

function StepReview({
  data,
  csvRowCount,
  confirmedMapping,
}: StepProps & { csvRowCount?: number; confirmedMapping?: ConfirmedMapping | null }) {
  const mappedFieldCount = confirmedMapping
    ? Object.keys(confirmedMapping.fieldToColumn).length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Review your setup</h2>
        <p className="text-muted-foreground text-sm mt-2">Here's a summary of what we've configured.</p>
      </div>
      <div className="glass-card rounded-xl p-5 space-y-3">
        <ReviewRow label="Business" value={data.businessName || 'Not set'} />
        <ReviewRow label="Sender" value={data.senderEmail || 'Not set'} />
        <ReviewRow label="Tone" value={data.brandTone} />
        <ReviewRow label="Import source" value={data.importPath || 'Not set'} />
        {data.importPath === 'csv' && csvRowCount != null && (
          <>
            <ReviewRow label="Rows to import" value={String(csvRowCount)} />
            {mappedFieldCount > 0 && (
              <ReviewRow label="Fields mapped" value={`${mappedFieldCount} columns`} />
            )}
          </>
        )}
        {data.importPath === 'demo' && (
          <>
            <ReviewRow label="Invoices" value="12" />
            <ReviewRow label="Clients" value="7" />
          </>
        )}
      </div>
      {data.importPath === 'csv' && !confirmedMapping && csvRowCount && csvRowCount > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-sm text-warning-foreground">
          Column mapping not confirmed — go back to step 4 to map your columns.
        </div>
      )}
      <div className="bg-accent/50 rounded-xl p-4 flex items-start gap-2">
        <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <p className="text-sm">Everything looks good. You can always change these in Settings.</p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      <span className="font-semibold text-sm capitalize">{value}</span>
    </div>
  );
}

function StepTrust({ data, update }: StepProps) {
  const modes = [
    { id: 'visibility', label: 'Visibility Only', desc: "See what's overdue. No messages sent. Good starting point.", icon: Eye },
    { id: 'drafts', label: 'Drafts Only', desc: "We'll write follow-ups — you send each one manually.", icon: Edit3 },
    { id: 'approval', label: 'Approval Required', desc: 'We queue sends — you approve each before it goes. Recommended.', icon: Shield, recommended: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>How much should we do?</h2>
        <p className="text-muted-foreground text-sm mt-2">Start with what feels comfortable. You can change this anytime.</p>
      </div>
      <div className="space-y-3">
        {modes.map(m => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => update?.('trustMode', m.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] relative ${
                data.trustMode === m.id ? 'border-accent bg-accent/10 ring-2 ring-accent/20' : 'border-border bg-card'
              }`}
            >
              {m.recommended && (
                <span className="absolute -top-2 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">Recommended</span>
              )}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPreview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Here's what we'll do first</h2>
        <p className="text-muted-foreground text-sm mt-2">These are the top invoices that need attention.</p>
      </div>
      {[
        { client: 'Meridian Creative Co.', invoice: 'INV-2024-042', amount: '$8,500', days: 34, action: 'Second follow-up — firm but friendly tone' },
        { client: 'Volta Brand Agency', invoice: 'INV-2024-048', amount: '$8,750', days: 29, action: 'First reminder — sensitive client, approval required' },
        { client: 'Fern & Bloom Marketing', invoice: 'INV-2024-038', amount: '$5,600', days: 39, action: 'Firm follow-up — no prior responses' },
      ].map((item, i) => (
        <div key={i} className="glass-card rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-sm">{item.client}</p>
              <p className="text-xs text-muted-foreground">{item.invoice} · {item.amount}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full status-overdue font-medium">{item.days}d overdue</span>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 mt-2">🤖 {item.action}</p>
        </div>
      ))}
    </div>
  );
}

function StepActivate({ data }: StepProps) {
  const trustLabels: Record<string, string> = {
    visibility: 'Visibility Only — no messages will be sent',
    drafts: 'Drafts Only — you send each message manually',
    approval: 'Approval Required — we queue, you approve',
  };

  return (
    <div className="space-y-6">
      <div className="text-center pt-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>You're all set!</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">Your default follow-up workflow is ready. Here's what it will do:</p>
      </div>
      <div className="glass-card rounded-xl p-5 space-y-3">
        {[
          { emoji: '📧', text: 'Send a gentle reminder 3 days before an invoice is due' },
          { emoji: '🔔', text: 'Follow up when an invoice becomes overdue' },
          { emoji: '📣', text: 'Escalate after 14 days with no reply' },
          { emoji: '🤝', text: 'Suggest a payment plan after 30 days' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-lg">{item.emoji}</span>
            <p className="text-sm">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="bg-accent/50 rounded-xl p-4 text-center">
        <p className="text-sm font-medium">{trustLabels[data.trustMode] || 'Approval Required'}</p>
        <p className="text-xs text-muted-foreground mt-1">You're always in control.</p>
      </div>
    </div>
  );
}

const Field = forwardRef<HTMLInputElement, { label: string; placeholder: string; helper?: string; value?: string; onChange?: (v: string) => void; required?: boolean }>(
  ({ label, placeholder, helper, value, onChange, required }, ref) => {
    return (
      <div>
        <label className="text-sm font-medium block mb-1.5">{label}{required && <span className="text-destructive ml-0.5">*</span>}</label>
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          value={value || ''}
          onChange={e => onChange?.(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
        />
        {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
      </div>
    );
  }
);

Field.displayName = 'Field';

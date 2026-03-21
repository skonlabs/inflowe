import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Upload, Database, Mail, Play, Building2, Palette, FileSpreadsheet, Eye, Shield, Sparkles } from 'lucide-react';

const steps = [
  { title: 'Create your org', icon: Building2 },
  { title: 'Set your tone', icon: Palette },
  { title: 'Choose your path', icon: FileSpreadsheet },
  { title: 'Import data', icon: Upload },
  { title: 'Review', icon: Eye },
  { title: 'Trust mode', icon: Shield },
  { title: 'Preview actions', icon: Sparkles },
  { title: 'Go live', icon: Play },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const canNext = step < steps.length - 1;
  const canBack = step > 0;

  const handleFinish = () => {
    localStorage.setItem('inflowe_onboarded', 'true');
    navigate('/');
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
            {step === 0 && <StepOrganization />}
            {step === 1 && <StepTone />}
            {step === 2 && <StepPath />}
            {step === 3 && <StepImport />}
            {step === 4 && <StepReview />}
            {step === 5 && <StepTrust />}
            {step === 6 && <StepPreview />}
            {step === 7 && <StepActivate />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex gap-3 max-w-screen-xl mx-auto">
          {canBack && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center justify-center gap-1 px-5 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {canNext ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform"
            >
              <Play className="w-4 h-4" /> Launch InFlowe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepOrganization() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Let's set up your business</h2>
        <p className="text-muted-foreground text-sm mt-2">This takes about 2 minutes. You can always change these later.</p>
      </div>
      <div className="space-y-4">
        <Field label="Business name" placeholder="e.g. Acme Creative Agency" />
        <Field label="Display name" placeholder="How clients see you" helper="This appears in emails sent on your behalf" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country" placeholder="United States" />
          <Field label="Currency" placeholder="USD" />
        </div>
        <Field label="Timezone" placeholder="America/New_York" />
      </div>
    </div>
  );
}

function StepTone() {
  const [tone, setTone] = useState('professional');
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
        <Field label="Sender email" placeholder="billing@youragency.com" />
        <Field label="Sender name" placeholder="Your Agency Name" />
        <div className="space-y-2">
          <label className="text-sm font-medium">Brand tone</label>
          {tones.map(t => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                tone === t.id ? 'border-primary bg-accent ring-2 ring-primary/20' : 'border-border bg-card'
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

function StepPath() {
  const [path, setPath] = useState('');
  const paths = [
    { id: 'csv', icon: FileSpreadsheet, label: 'Upload a spreadsheet', desc: 'Fastest setup. Works immediately.', rec: 'Best if you track invoices in Excel or Google Sheets' },
    { id: 'mailbox', icon: Mail, label: 'Connect your email', desc: 'Great if you\'re in Gmail or Outlook.', rec: 'We\'ll scan for invoice-related conversations' },
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
              onClick={() => setPath(p.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                path === p.id ? 'border-primary bg-accent ring-2 ring-primary/20' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  <p className="text-xs text-primary mt-1">{p.rec}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepImport() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Import your invoices</h2>
        <p className="text-muted-foreground text-sm mt-2">We'll set up demo data so you can explore right away.</p>
      </div>
      <div className="glass-card rounded-xl p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="font-medium">Drag & drop your CSV file</p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
        </div>
        <button className="text-sm text-primary font-medium underline underline-offset-2">Download template</button>
      </div>
      <div className="bg-accent/50 rounded-xl p-4">
        <p className="text-sm text-accent-foreground">💡 <strong>Tip:</strong> For this demo, we'll load sample data. In the real app, you'd upload your invoice spreadsheet here.</p>
      </div>
    </div>
  );
}

function StepReview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ lineHeight: '1.1' }}>Review your data</h2>
        <p className="text-muted-foreground text-sm mt-2">Here's a summary of what we found.</p>
      </div>
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-sm">Invoices imported</span>
          <span className="font-semibold text-sm text-tabular">12</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-sm">Clients identified</span>
          <span className="font-semibold text-sm text-tabular">7</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-sm text-destructive">Overdue invoices</span>
          <span className="font-semibold text-sm text-tabular text-destructive">5</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm status-due-soon px-2 py-0.5 rounded-full">Due soon</span>
          <span className="font-semibold text-sm text-tabular">2</span>
        </div>
      </div>
      <div className="bg-accent/50 rounded-xl p-4 flex items-start gap-2">
        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm">All contacts have valid email addresses. You're good to go!</p>
      </div>
    </div>
  );
}

function StepTrust() {
  const [mode, setMode] = useState('approval');
  const modes = [
    { id: 'visibility', label: 'Visibility Only', desc: 'See what\'s overdue. No messages sent. Good starting point.', icon: Eye },
    { id: 'drafts', label: 'Drafts Only', desc: 'We\'ll write follow-ups — you send each one manually.', icon: Edit3 },
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
              onClick={() => setMode(m.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] relative ${
                mode === m.id ? 'border-primary bg-accent ring-2 ring-primary/20' : 'border-border bg-card'
              }`}
            >
              {m.recommended && (
                <span className="absolute -top-2 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">Recommended</span>
              )}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
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

function StepActivate() {
  return (
    <div className="space-y-6">
      <div className="text-center pt-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
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
        <p className="text-sm">Every message needs your approval before sending. <br /><span className="text-muted-foreground">You're always in control.</span></p>
      </div>
    </div>
  );
}

function Field({ label, placeholder, helper }: { label: string; placeholder: string; helper?: string }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
      />
      {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
    </div>
  );
}

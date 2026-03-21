import { ArrowLeft, ChevronRight, AlertOctagon, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useState } from 'react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [emergencyActive, setEmergencyActive] = useState(false);

  const handleEmergencyStop = () => {
    if (!emergencyActive) {
      if (confirm('⚠️ EMERGENCY STOP\n\nThis will immediately halt ALL automation and cancel all queued actions.\n\nAre you sure?')) {
        setEmergencyActive(true);
        toast.error('Emergency stop activated — all automation halted');
      }
    } else {
      setEmergencyActive(false);
      toast.success('Automation resumed');
    }
  };

  const sections = [
    {
      label: 'Organization',
      items: [
        { name: 'Business name', value: 'Demo Agency' },
        { name: 'Timezone', value: 'America/New_York' },
        { name: 'Currency', value: 'USD' },
        { name: 'Business hours', value: '9:00 AM – 5:00 PM' },
        { name: 'Holiday calendar', value: '0 holidays configured' },
      ],
    },
    {
      label: 'Sender Identity',
      items: [
        { name: 'Sender email', value: 'billing@demo-agency.com' },
        { name: 'Display name', value: 'Demo Agency' },
        { name: 'Reply-to address', value: 'billing@demo-agency.com' },
        { name: 'Brand tone', value: 'Professional' },
        { name: 'Verification status', value: '✓ Verified', highlight: true },
      ],
    },
    {
      label: 'Integrations',
      items: [
        { name: 'Gmail', value: 'Not connected' },
        { name: 'Outlook', value: 'Not connected' },
        { name: 'QuickBooks', value: 'Not connected' },
        { name: 'Xero', value: 'Not connected' },
        { name: 'Stripe', value: 'Not connected' },
      ],
    },
    {
      label: 'Team',
      items: [
        { name: 'Members', value: '1 active (Owner)' },
        { name: 'Invite team member', value: '' },
        { name: 'Manage roles', value: '' },
      ],
    },
    {
      label: 'Automation',
      items: [
        { name: 'Trust mode', value: 'Approval Required' },
        { name: 'AI drafting', value: 'Enabled' },
        { name: 'AI reply classification', value: 'Enabled' },
        { name: 'Max messages per client/month', value: '8' },
      ],
    },
    {
      label: 'Modules',
      items: [
        { name: 'Module A: Invoice Recovery', value: 'Active', highlight: true },
        { name: 'Module B: Smart Follow-Up Intelligence', value: 'Trial (12 days left)' },
        { name: 'Module C: Cash Visibility', value: 'Trial (12 days left)' },
        { name: 'Module D: Communication Hub', value: 'Not active' },
        { name: 'Module E: Advanced Automation', value: 'Not active' },
        { name: 'Module F: Payment Optimization', value: 'Not active' },
        { name: 'Module G: AI Cash Advisor', value: 'Not active' },
      ],
    },
    {
      label: 'Billing & Subscription',
      items: [
        { name: 'Plan', value: 'Trial — 12 days remaining' },
        { name: 'Usage this period', value: '7 messages, 12 invoices tracked' },
        { name: 'Upgrade plan', value: '' },
      ],
    },
    {
      label: 'Data & Privacy',
      items: [
        { name: 'Export all data', value: '' },
        { name: 'Audit log', value: '' },
        { name: 'Exit demo mode', value: '' },
      ],
    },
  ];

  return (
    <div className="px-4 py-6 space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Settings</h1>
      </ScrollReveal>

      {/* Emergency stop */}
      <ScrollReveal delay={0.05}>
        <button onClick={handleEmergencyStop}
          className={`w-full glass-card rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform ${emergencyActive ? 'border-destructive bg-destructive/5' : ''}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${emergencyActive ? 'bg-destructive' : 'bg-destructive/10'}`}>
            <AlertOctagon className={`w-5 h-5 ${emergencyActive ? 'text-destructive-foreground' : 'text-destructive'}`} />
          </div>
          <div className="text-left flex-1">
            <p className="font-medium text-sm">{emergencyActive ? 'Automation stopped — click to resume' : 'Emergency stop'}</p>
            <p className="text-xs text-muted-foreground">{emergencyActive ? 'All automation is currently halted' : 'Immediately halt all automation org-wide'}</p>
          </div>
        </button>
      </ScrollReveal>

      {/* Internal admin link */}
      <ScrollReveal delay={0.08}>
        <button onClick={() => navigate('/admin')}
          className="w-full glass-card-hover rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="font-medium text-sm">Admin Console</p>
            <p className="text-xs text-muted-foreground">Internal ops, tenant management, incident controls</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </ScrollReveal>

      {sections.map((section, i) => (
        <ScrollReveal key={section.label} delay={0.1 + i * 0.03}>
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/30">
              <h3 className="text-sm font-semibold">{section.label}</h3>
            </div>
            {section.items.map((item, j) => (
              <button key={j} className="w-full text-left flex items-center justify-between px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]">
                <span>{item.name}</span>
                <div className="flex items-center gap-2">
                  {item.value && (
                    <span className={`text-xs ${item.highlight ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{item.value}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

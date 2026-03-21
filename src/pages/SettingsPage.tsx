import { ArrowLeft, ChevronRight, AlertOctagon, Shield, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface EditingState {
  sectionLabel: string;
  itemName: string;
  value: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

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

  const startEdit = (sectionLabel: string, itemName: string, currentValue: string) => {
    setEditing({ sectionLabel, itemName, value: overrides[`${sectionLabel}:${itemName}`] || currentValue });
  };

  const saveEdit = () => {
    if (!editing) return;
    const key = `${editing.sectionLabel}:${editing.itemName}`;
    setOverrides(prev => ({ ...prev, [key]: editing.value }));
    toast.success(`${editing.itemName} updated`);
    setEditing(null);
  };

  const getDisplayValue = (sectionLabel: string, itemName: string, defaultValue: string) => {
    return overrides[`${sectionLabel}:${itemName}`] || defaultValue;
  };

  const sections = [
    {
      label: 'Organization',
      items: [
        { name: 'Business name', value: 'Demo Agency', editable: true },
        { name: 'Timezone', value: 'America/New_York', editable: true },
        { name: 'Currency', value: 'USD', editable: true },
        { name: 'Business hours', value: '9:00 AM – 5:00 PM', editable: true },
        { name: 'Holiday calendar', value: '0 holidays configured', editable: false },
      ],
    },
    {
      label: 'Sender Identity',
      items: [
        { name: 'Sender email', value: 'billing@demo-agency.com', editable: true },
        { name: 'Display name', value: 'Demo Agency', editable: true },
        { name: 'Reply-to address', value: 'billing@demo-agency.com', editable: true },
        { name: 'Brand tone', value: 'Professional', editable: true },
        { name: 'Verification status', value: '✓ Verified', highlight: true, editable: false },
      ],
    },
    {
      label: 'Integrations',
      items: [
        { name: 'Gmail', value: 'Not connected', editable: false },
        { name: 'Outlook', value: 'Not connected', editable: false },
        { name: 'QuickBooks', value: 'Not connected', editable: false },
        { name: 'Xero', value: 'Not connected', editable: false },
        { name: 'Stripe', value: 'Not connected', editable: false },
      ],
    },
    {
      label: 'Team',
      items: [
        { name: 'Members', value: '1 active (Owner)', editable: false },
        { name: 'Invite team member', value: '', editable: false },
        { name: 'Manage roles', value: '', editable: false },
      ],
    },
    {
      label: 'Automation',
      items: [
        { name: 'Trust mode', value: 'Approval Required', editable: true },
        { name: 'AI drafting', value: 'Enabled', editable: true },
        { name: 'AI reply classification', value: 'Enabled', editable: true },
        { name: 'Max messages per client/month', value: '8', editable: true },
      ],
    },
    {
      label: 'Modules',
      items: [
        { name: 'Module A: Invoice Recovery', value: 'Active', highlight: true, editable: false },
        { name: 'Module B: Smart Follow-Up Intelligence', value: 'Trial (12 days left)', editable: false },
        { name: 'Module C: Cash Visibility', value: 'Trial (12 days left)', editable: false },
        { name: 'Module D: Communication Hub', value: 'Not active', editable: false },
        { name: 'Module E: Advanced Automation', value: 'Not active', editable: false },
        { name: 'Module F: Payment Optimization', value: 'Not active', editable: false },
        { name: 'Module G: AI Cash Advisor', value: 'Not active', editable: false },
      ],
    },
    {
      label: 'Billing & Subscription',
      items: [
        { name: 'Plan', value: 'Trial — 12 days remaining', editable: false },
        { name: 'Usage this period', value: '7 messages, 12 invoices tracked', editable: false },
        { name: 'Upgrade plan', value: '', editable: false },
      ],
    },
    {
      label: 'Data & Privacy',
      items: [
        { name: 'Export all data', value: '', editable: false },
        { name: 'Audit log', value: '', editable: false },
        { name: 'Exit demo mode', value: '', editable: false },
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

      {/* Inline editor */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <div className="glass-card rounded-xl p-4 space-y-3 border-2 border-primary/30">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Edit: {editing.itemName}</p>
                <button onClick={() => setEditing(null)} className="p-1 rounded-full hover:bg-muted active:scale-95">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <input
                value={editing.value}
                onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : null)}
                className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm active:scale-95">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-card border border-border font-medium text-sm active:scale-95">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            {section.items.map((item, j) => {
              const displayVal = getDisplayValue(section.label, item.name, item.value);
              return (
                <button
                  key={j}
                  onClick={() => item.editable ? startEdit(section.label, item.name, displayVal) : undefined}
                  className={`w-full text-left flex items-center justify-between px-4 py-3 border-t border-border/40 text-sm transition-colors active:scale-[0.99] ${item.editable ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default'}`}
                >
                  <span>{item.name}</span>
                  <div className="flex items-center gap-2">
                    {displayVal && (
                      <span className={`text-xs ${item.highlight ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{displayVal}</span>
                    )}
                    {item.editable && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

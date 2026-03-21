import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Users, Activity, Flag, AlertOctagon, ChevronRight } from 'lucide-react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useState } from 'react';
import { toast } from 'sonner';

interface IncidentControl {
  label: string;
  desc: string;
  active: boolean;
  severity: string;
}

const initialIncidentControls: IncidentControl[] = [
  { label: 'Global send shutdown', desc: 'Stop ALL outbound sends across all tenants', active: false, severity: 'critical' },
  { label: 'Email channel shutdown', desc: 'Stop email sends globally', active: false, severity: 'high' },
  { label: 'WhatsApp channel shutdown', desc: 'Stop WhatsApp sends globally', active: false, severity: 'high' },
];

const tenants = [
  { id: 'o1', name: 'Demo Agency', status: 'trialing', modules: 3, sendRate: '98%', openCases: 0 },
  { id: 'o2', name: 'Stellar Creative', status: 'active', modules: 5, sendRate: '100%', openCases: 1 },
  { id: 'o3', name: 'Blueprint Studios', status: 'active', modules: 4, sendRate: '95%', openCases: 0 },
];

const queueStats = [
  { name: 'imports', depth: 0, workers: 5, failed: 0, dlq: 0 },
  { name: 'workflow-eval', depth: 3, workers: 20, failed: 0, dlq: 0 },
  { name: 'dispatch', depth: 1, workers: 50, failed: 0, dlq: 0 },
  { name: 'ai-generation', depth: 0, workers: 10, failed: 0, dlq: 0 },
  { name: 'classification', depth: 2, workers: 20, failed: 1, dlq: 0 },
  { name: 'notifications', depth: 0, workers: 20, failed: 0, dlq: 0 },
];

interface FeatureFlag {
  key: string;
  desc: string;
  enabled: boolean;
  rollout: number;
}

const initialFlags: FeatureFlag[] = [
  { key: 'ai_drafting_v2', desc: 'New AI draft generation model', enabled: true, rollout: 100 },
  { key: 'whatsapp_channel', desc: 'WhatsApp messaging channel', enabled: false, rollout: 0 },
  { key: 'payment_plans', desc: 'Payment plan creation flow', enabled: true, rollout: 50 },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const [controls, setControls] = useState(initialIncidentControls);
  const [flags, setFlags] = useState(initialFlags);

  const toggleControl = (index: number) => {
    setControls(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const newActive = !c.active;
      if (newActive) {
        toast.error(`${c.label} activated — all ${c.label.includes('Email') ? 'email' : c.label.includes('WhatsApp') ? 'WhatsApp' : ''} sends halted`, { duration: 5000 });
      } else {
        toast.success(`${c.label} deactivated — sends resumed`);
      }
      return { ...c, active: newActive };
    }));
  };

  const toggleFlag = (index: number) => {
    setFlags(prev => prev.map((f, i) => {
      if (i !== index) return f;
      const newEnabled = !f.enabled;
      toast(newEnabled ? `${f.key} enabled` : `${f.key} disabled`, { icon: newEnabled ? '🟢' : '⚪' });
      return { ...f, enabled: newEnabled, rollout: newEnabled ? 100 : 0 };
    }));
  };

  return (
    <div className="px-4 py-4 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <ScrollReveal>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Admin Console</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Internal operations and tenant management</p>
      </ScrollReveal>

      {/* Incident controls */}
      <ScrollReveal delay={0.05}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-destructive/5 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold">Incident Controls</h3>
          </div>
          {controls.map((ctrl, i) => (
            <div key={ctrl.label} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <div>
                <p className="text-sm font-medium">{ctrl.label}</p>
                <p className="text-xs text-muted-foreground">{ctrl.desc}</p>
              </div>
              <button
                onClick={() => toggleControl(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 ${
                  ctrl.active ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                }`}
              >
                {ctrl.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Tenant management */}
      <ScrollReveal delay={0.1}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <h3 className="text-sm font-semibold">Tenants</h3>
            </div>
            <span className="text-xs text-muted-foreground">{tenants.length} total</span>
          </div>
          {tenants.map(t => (
            <button key={t.id} className="w-full text-left px-4 py-3 border-t border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.status} · {t.modules} modules · Send: {t.sendRate}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* Job queues */}
      <ScrollReveal delay={0.15}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Job Queues</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Queue</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground">Depth</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground">Workers</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground">Failed</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">DLQ</th>
                </tr>
              </thead>
              <tbody>
                {queueStats.map(q => (
                  <tr key={q.name} className="border-b border-border/40">
                    <td className="px-4 py-2 font-mono text-xs">{q.name}</td>
                    <td className="text-right px-2 py-2 text-tabular">{q.depth}</td>
                    <td className="text-right px-2 py-2 text-tabular">{q.workers}</td>
                    <td className={`text-right px-2 py-2 text-tabular ${q.failed > 0 ? 'text-destructive font-medium' : ''}`}>{q.failed}</td>
                    <td className={`text-right px-4 py-2 text-tabular ${q.dlq > 0 ? 'text-destructive font-medium' : ''}`}>{q.dlq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ScrollReveal>

      {/* Feature flags */}
      <ScrollReveal delay={0.2}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
            <Flag className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Feature Flags</h3>
          </div>
          {flags.map((flag, i) => (
            <div key={flag.key} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <div>
                <p className="text-sm font-mono">{flag.key}</p>
                <p className="text-xs text-muted-foreground">{flag.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{flag.rollout}%</span>
                <button
                  onClick={() => toggleFlag(i)}
                  className={`w-10 h-6 rounded-full transition-colors relative active:scale-95 ${flag.enabled ? 'bg-success' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${flag.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </div>
  );
}

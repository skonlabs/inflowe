import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Users, Database, Activity, Flag, AlertOctagon, Search, ChevronRight } from 'lucide-react';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';

const tenants = [
  { id: 'o1', name: 'Demo Agency', status: 'trialing', modules: 3, sendRate: '98%', openCases: 0 },
  { id: 'o2', name: 'Stellar Creative', status: 'active', modules: 5, sendRate: '100%', openCases: 1 },
  { id: 'o3', name: 'Blueprint Studios', status: 'active', modules: 4, sendRate: '95%', openCases: 0 },
];

const incidentControls = [
  { label: 'Global send shutdown', desc: 'Stop ALL outbound sends across all tenants', active: false, severity: 'critical' },
  { label: 'Email channel shutdown', desc: 'Stop email sends globally', active: false, severity: 'high' },
  { label: 'WhatsApp channel shutdown', desc: 'Stop WhatsApp sends globally', active: false, severity: 'high' },
];

const queueStats = [
  { name: 'imports', depth: 0, workers: 5, failed: 0, dlq: 0 },
  { name: 'workflow-eval', depth: 3, workers: 20, failed: 0, dlq: 0 },
  { name: 'dispatch', depth: 1, workers: 50, failed: 0, dlq: 0 },
  { name: 'ai-generation', depth: 0, workers: 10, failed: 0, dlq: 0 },
  { name: 'classification', depth: 2, workers: 20, failed: 1, dlq: 0 },
  { name: 'notifications', depth: 0, workers: 20, failed: 0, dlq: 0 },
];

export default function AdminPage() {
  const navigate = useNavigate();

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
          {incidentControls.map(ctrl => (
            <div key={ctrl.label} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <div>
                <p className="text-sm font-medium">{ctrl.label}</p>
                <p className="text-xs text-muted-foreground">{ctrl.desc}</p>
              </div>
              <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 ${
                ctrl.active ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
              }`}>
                {ctrl.active ? 'Active' : 'Activate'}
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
          {[
            { key: 'ai_drafting_v2', desc: 'New AI draft generation model', enabled: true, rollout: 100 },
            { key: 'whatsapp_channel', desc: 'WhatsApp messaging channel', enabled: false, rollout: 0 },
            { key: 'payment_plans', desc: 'Payment plan creation flow', enabled: true, rollout: 50 },
          ].map(flag => (
            <div key={flag.key} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <div>
                <p className="text-sm font-mono">{flag.key}</p>
                <p className="text-xs text-muted-foreground">{flag.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{flag.rollout}%</span>
                <div className={`w-3 h-3 rounded-full ${flag.enabled ? 'bg-success' : 'bg-muted-foreground/30'}`} />
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </div>
  );
}

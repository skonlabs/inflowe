import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Users, Activity, Flag, AlertOctagon, ChevronRight, Loader2 } from 'lucide-react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface IncidentControl {
  label: string;
  desc: string;
  active: boolean;
  severity: string;
  flagKey: string;
}

const INCIDENT_CONTROLS: Omit<IncidentControl, 'active'>[] = [
  { label: 'Global send shutdown', desc: 'Stop ALL outbound sends across all tenants', severity: 'critical', flagKey: 'incident:global_send_shutdown' },
  { label: 'Email channel shutdown', desc: 'Stop email sends globally', severity: 'high', flagKey: 'incident:email_channel_shutdown' },
  { label: 'WhatsApp channel shutdown', desc: 'Stop WhatsApp sends globally', severity: 'high', flagKey: 'incident:whatsapp_channel_shutdown' },
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
  const qc = useQueryClient();
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [togglingControl, setTogglingControl] = useState<string | null>(null);

  // Load all feature flags from DB (includes incident: and regular flags)
  const { data: dbFlags = [], isLoading: flagsLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Derive incident controls active state from DB flags
  const controls: IncidentControl[] = INCIDENT_CONTROLS.map(ctrl => {
    const dbFlag = dbFlags.find(f => f.flag_key === ctrl.flagKey);
    return { ...ctrl, active: dbFlag ? dbFlag.enabled_by_default : false };
  });

  // Load tenants (organizations) from DB
  const { data: organizations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, display_name, subscription_state, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleControl = async (ctrl: IncidentControl) => {
    setTogglingControl(ctrl.flagKey);
    const newActive = !ctrl.active;
    try {
      const dbFlag = dbFlags.find(f => f.flag_key === ctrl.flagKey);
      if (!dbFlag) {
        toast.error('Incident control flag not found in DB — run latest migrations');
        return;
      }
      const { error } = await supabase.rpc('update_feature_flag', {
        _flag_id: dbFlag.id,
        _enabled: newActive,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
      if (newActive) {
        toast.error(`${ctrl.label} activated`, { duration: 5000 });
      } else {
        toast.success(`${ctrl.label} deactivated — sends resumed`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update incident control');
    } finally {
      setTogglingControl(null);
    }
  };

  const toggleFlag = async (flagId: string, flagKey: string, currentEnabled: boolean) => {
    setTogglingFlag(flagId);
    try {
      const newEnabled = !currentEnabled;
      const { error } = await supabase.rpc('update_feature_flag', {
        _flag_id: flagId,
        _enabled: newEnabled,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
      toast(newEnabled ? `${flagKey} enabled` : `${flagKey} disabled`, { icon: newEnabled ? '🟢' : '⚪' });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update flag');
    } finally {
      setTogglingFlag(null);
    }
  };

  return (
    <div className="px-4 py-4 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <ScrollReveal>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
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
          {controls.map(ctrl => (
            <div key={ctrl.label} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <div>
                <p className="text-sm font-medium">{ctrl.label}</p>
                <p className="text-xs text-muted-foreground">{ctrl.desc}</p>
              </div>
              <button
                onClick={() => toggleControl(ctrl)}
                disabled={togglingControl === ctrl.flagKey}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 disabled:opacity-60 ${
                  ctrl.active ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                }`}
              >
                {togglingControl === ctrl.flagKey ? '…' : ctrl.active ? 'Deactivate' : 'Activate'}
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
            <span className="text-xs text-muted-foreground">
              {orgsLoading ? '…' : `${organizations.length} total`}
            </span>
          </div>
          {orgsLoading ? (
            <div className="px-4 py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">No organizations found</div>
          ) : (
            organizations.map(org => (
              <div key={org.id} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                <div>
                  <p className="text-sm font-medium">{org.display_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{org.subscription_state || 'trialing'} · {new Date(org.created_at).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))
          )}
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
          <p className="px-4 py-2 text-xs text-muted-foreground">Queue stats are static in this environment (BullMQ not connected).</p>
        </div>
      </ScrollReveal>

      {/* Feature flags */}
      <ScrollReveal delay={0.2}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
            <Flag className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Feature Flags</h3>
          </div>
          {flagsLoading ? (
            <div className="px-4 py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : dbFlags.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">No feature flags configured.</div>
          ) : (
            dbFlags.map(flag => (
              <div key={flag.id} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                <div>
                  <p className="text-sm font-mono">{flag.flag_key}</p>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{flag.rollout_percentage}%</span>
                  {togglingFlag === flag.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <button
                      onClick={() => toggleFlag(flag.id, flag.flag_key, flag.enabled_by_default)}
                      className={`w-10 h-6 rounded-full transition-colors relative active:scale-95 ${flag.enabled_by_default ? 'bg-success' : 'bg-muted-foreground/30'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${flag.enabled_by_default ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}

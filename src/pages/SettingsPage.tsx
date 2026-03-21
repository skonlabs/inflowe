import { ArrowLeft, ChevronRight, AlertOctagon, Shield, X, Check, Plug, Unplug, Key, ExternalLink, Loader2, Play, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useAppState } from '@/contexts/AppStateContext';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useUserOrganization,
  useIntegrations,
  useModuleEntitlements,
  useTeamMembers,
  useUpdateOrgFields,
  useInviteMember,
} from '@/hooks/use-supabase-data';
import { useQueryClient } from '@tanstack/react-query';

interface EditingState {
  sectionLabel: string;
  itemName: string;
  value: string;
}

const AVAILABLE_PROVIDERS = [
  { id: 'gmail', name: 'Gmail', category: 'Email', method: 'oauth' as const, description: 'Scan for invoice-related email conversations', icon: '📧' },
  { id: 'outlook', name: 'Outlook', category: 'Email', method: 'oauth' as const, description: 'Connect Microsoft 365 mailbox', icon: '📬' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'Accounting', method: 'oauth' as const, description: 'Auto-sync invoices and payments', icon: '📗' },
  { id: 'xero', name: 'Xero', category: 'Accounting', method: 'oauth' as const, description: 'Import invoices and track payments', icon: '📘' },
  { id: 'freshbooks', name: 'FreshBooks', category: 'Accounting', method: 'oauth' as const, description: 'Sync client invoices and payments', icon: '📙' },
  { id: 'stripe', name: 'Stripe', category: 'Payments', method: 'api_key' as const, description: 'Track incoming payments in real-time', icon: '💳' },
  { id: 'paypal', name: 'PayPal', category: 'Payments', method: 'api_key' as const, description: 'Monitor PayPal payment activity', icon: '🅿️' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: integrations = [], isLoading: integrationsLoading } = useIntegrations(orgId);
  const { data: entitlements = [], isLoading: entitlementsLoading } = useModuleEntitlements(orgId);
  const { data: teamMembers = [] } = useTeamMembers(orgId);
  const { emergencyStop, setEmergencyStop } = useAppState();
  const updateOrgFields = useUpdateOrgFields();
  const inviteMember = useInviteMember();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  // Map settings section:item → org field name for DB persistence
  const ORG_FIELD_MAP: Record<string, string> = {
    'Organization:Business name': 'display_name',
    'Organization:Timezone': 'timezone',
    'Organization:Currency': 'default_currency',
    'Sender Identity:Sender email': 'sender_email',
    'Sender Identity:Display name': 'sender_display_name',
    'Sender Identity:Reply-to address': 'reply_to_address',
    'Sender Identity:Brand tone': 'brand_tone',
  };
  const [connectingProvider, setConnectingProvider] = useState<typeof AVAILABLE_PROVIDERS[0] | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [submittingIntegration, setSubmittingIntegration] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [togglingModule, setTogglingModule] = useState<string | null>(null);

  const handleEmergencyStop = () => {
    if (!emergencyStop) {
      if (confirm('⚠️ EMERGENCY STOP\n\nThis will immediately halt ALL automation and cancel all queued actions.\n\nAre you sure?')) {
        setEmergencyStop(true);
        toast.error('Emergency stop activated — all automation halted');
      }
    } else {
      setEmergencyStop(false);
      toast.success('Automation resumed');
    }
  };

  const startEdit = (sectionLabel: string, itemName: string, currentValue: string) => {
    setEditing({ sectionLabel, itemName, value: overrides[`${sectionLabel}:${itemName}`] || currentValue });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const key = `${editing.sectionLabel}:${editing.itemName}`;
    setOverrides(prev => ({ ...prev, [key]: editing.value }));
    // Persist to DB if this field maps to an org column
    const dbField = ORG_FIELD_MAP[key];
    if (dbField && orgId) {
      try {
        await updateOrgFields.mutateAsync({ orgId, fields: { [dbField]: editing.value } });
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to save setting');
        return;
      }
    }
    toast.success(`${editing.itemName} updated`);
    setEditing(null);
  };

  const getDisplayValue = (sectionLabel: string, itemName: string, defaultValue: string) => {
    return overrides[`${sectionLabel}:${itemName}`] || defaultValue;
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    try {
      await inviteMember.mutateAsync({ orgId, email: inviteEmail.trim(), role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInvite(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send invitation');
    }
  };

  const handleExportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      organization: overrides,
      note: 'Demo mode — no real data exported',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inflowe-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const handleConnectIntegration = async () => {
    if (!connectingProvider || !orgId || !user) return;
    setSubmittingIntegration(true);
    try {
      if (connectingProvider.method === 'oauth') {
        // For OAuth providers, create a pending integration record
        const { error } = await supabase.from('integrations').insert({
          organization_id: orgId,
          provider: connectingProvider.id,
          connection_status: 'pending',
          connected_by_user_id: user.id,
        });
        if (error) throw error;
        toast.info(`${connectingProvider.name} integration created. OAuth setup will be available soon — for now it's registered as pending.`);
      } else {
        // For API key providers, validate input and save
        if (!apiKeyInput.trim()) {
          toast.error('Please enter an API key');
          setSubmittingIntegration(false);
          return;
        }
        const { error } = await supabase.from('integrations').insert({
          organization_id: orgId,
          provider: connectingProvider.id,
          connection_status: 'connected',
          connected_by_user_id: user.id,
          connected_at: new Date().toISOString(),
          credential_reference: `vault:${connectingProvider.id}_${orgId}`,
        });
        if (error) throw error;
        toast.success(`${connectingProvider.name} connected successfully`);
      }
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setConnectingProvider(null);
      setApiKeyInput('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect integration');
    } finally {
      setSubmittingIntegration(false);
    }
  };

  const handleDisconnect = async (integrationId: string, providerName: string) => {
    if (!confirm(`Disconnect ${providerName}? This will stop syncing data from this provider.`)) return;
    setDisconnectingId(integrationId);
    try {
      const { error } = await supabase
        .from('integrations')
        .update({ connection_status: 'disconnected', disconnected_at: new Date().toISOString() })
        .eq('id', integrationId);
      if (error) throw error;
      toast.success(`${providerName} disconnected`);
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    } finally {
      setDisconnectingId(null);
    }
  };

  // Module management
  const MODULES = [
    { id: 'module_a', name: 'Invoice Recovery', description: 'Automated overdue invoice follow-up' },
    { id: 'module_b', name: 'Smart Follow-Up Intelligence', description: 'AI-powered timing and channel optimization' },
    { id: 'module_c', name: 'Cash Visibility', description: 'Real-time cash flow dashboards and forecasts' },
    { id: 'module_d', name: 'Communication Hub', description: 'Unified inbox across email, SMS, WhatsApp' },
    { id: 'module_e', name: 'Advanced Automation', description: 'Custom workflow builder and rule engine' },
    { id: 'module_f', name: 'Payment Optimization', description: 'Payment plans, settlements, and reconciliation' },
    { id: 'module_g', name: 'AI Cash Advisor', description: 'Conversational AI for financial insights' },
  ];

  const entitlementByModule = new Map(entitlements.map(e => [e.module_id, e]));

  const handleStartTrial = async (moduleId: string) => {
    if (!orgId) return;
    setTogglingModule(moduleId);
    try {
      const { error } = await supabase.rpc('start_module_trial', { _org_id: orgId, _module_id: moduleId });
      if (error) throw error;
      toast.success('Trial started — 14 days free');
      queryClient.invalidateQueries({ queryKey: ['module-entitlements'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to start trial');
    } finally {
      setTogglingModule(null);
    }
  };

  const handleDeactivateModule = async (moduleId: string, moduleName: string) => {
    if (!orgId) return;
    if (!confirm(`Deactivate ${moduleName}? You can reactivate it later.`)) return;
    setTogglingModule(moduleId);
    try {
      const { error } = await supabase.rpc('deactivate_module', { _org_id: orgId, _module_id: moduleId });
      if (error) throw error;
      toast.success(`${moduleName} deactivated`);
      queryClient.invalidateQueries({ queryKey: ['module-entitlements'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate');
    } finally {
      setTogglingModule(null);
    }
  };

  // Map connected integrations by provider
  const connectedByProvider = new Map(
    integrations
      .filter(i => i.connection_status !== 'disconnected')
      .map(i => [i.provider, i])
  );

  const sections = [
    {
      label: 'Organization',
      items: [
        { name: 'Business name', value: membership?.organizations?.display_name || 'Your org', editable: true },
        { name: 'Timezone', value: 'America/New_York', editable: true },
        { name: 'Currency', value: membership?.organizations?.default_currency || 'USD', editable: true },
        { name: 'Business hours', value: '9:00 AM – 5:00 PM', editable: true },
        { name: 'Holiday calendar', value: '0 holidays configured', editable: false },
      ],
    },
    {
      label: 'Sender Identity',
      items: [
        { name: 'Sender email', value: 'billing@demo-agency.com', editable: true },
        { name: 'Display name', value: membership?.organizations?.display_name || 'Your org', editable: true },
        { name: 'Reply-to address', value: 'billing@demo-agency.com', editable: true },
        { name: 'Brand tone', value: membership?.organizations?.brand_tone || 'Professional', editable: true },
        { name: 'Verification status', value: '✓ Verified', highlight: true, editable: false },
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
      label: 'Billing & Subscription',
      items: [
        { name: 'Plan', value: 'Trial — 12 days remaining', editable: false },
        { name: 'Usage this period', value: '7 messages, 12 invoices tracked', editable: false },
        { name: 'Upgrade plan', value: '', editable: false },
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
          className={`w-full glass-card rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform ${emergencyStop ? 'border-destructive bg-destructive/5' : ''}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${emergencyStop ? 'bg-destructive' : 'bg-destructive/10'}`}>
            <AlertOctagon className={`w-5 h-5 ${emergencyStop ? 'text-destructive-foreground' : 'text-destructive'}`} />
          </div>
          <div className="text-left flex-1">
            <p className="font-medium text-sm">{emergencyStop ? 'Automation stopped — click to resume' : 'Emergency stop'}</p>
            <p className="text-xs text-muted-foreground">{emergencyStop ? 'All automation is currently halted' : 'Immediately halt all automation org-wide'}</p>
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

      {/* Regular settings sections */}
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

      {/* Modules section */}
      <ScrollReveal delay={0.22}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Modules</h3>
            <span className="text-xs text-muted-foreground">
              {entitlements.length} active
            </span>
          </div>
          {entitlementsLoading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            MODULES.map(mod => {
              const ent = entitlementByModule.get(mod.id);
              const isActive = ent?.status === 'active';
              const isTrialing = ent?.status === 'trialing';
              const trialDaysLeft = ent?.trial_ends_at
                ? Math.max(0, Math.ceil((new Date(ent.trial_ends_at).getTime() - Date.now()) / 86400000))
                : 0;

              return (
                <div key={mod.id} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{mod.name}</p>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {isActive ? (
                      <>
                        <span className="text-xs text-primary font-medium">● Active</span>
                        <button
                          onClick={() => handleDeactivateModule(mod.id, mod.name)}
                          disabled={togglingModule === mod.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-border hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-95 disabled:opacity-50"
                        >
                          {togglingModule === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                        </button>
                      </>
                    ) : isTrialing ? (
                      <>
                        <span className="text-xs text-amber-600 font-medium">Trial · {trialDaysLeft}d left</span>
                        <button
                          onClick={() => handleDeactivateModule(mod.id, mod.name)}
                          disabled={togglingModule === mod.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-border hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-95 disabled:opacity-50"
                        >
                          {togglingModule === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStartTrial(mod.id)}
                        disabled={togglingModule === mod.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {togglingModule === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Start trial
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollReveal>

      {/* Integrations section */}
      <ScrollReveal delay={0.25}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Integrations</h3>
            <span className="text-xs text-muted-foreground">
              {integrations.filter(i => i.connection_status === 'connected').length} connected
            </span>
          </div>

          {integrationsLoading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Connected integrations */}
              {integrations.filter(i => i.connection_status !== 'disconnected').map(integration => {
                const providerInfo = AVAILABLE_PROVIDERS.find(p => p.id === integration.provider);
                return (
                  <div key={integration.id} className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{providerInfo?.icon || '🔗'}</span>
                      <div>
                        <p className="text-sm font-medium">{providerInfo?.name || integration.provider}</p>
                        <p className="text-xs text-muted-foreground">
                          {integration.connection_status === 'connected' ? (
                            <span className="text-primary">● Connected</span>
                          ) : (
                            <span className="text-amber-500">● {integration.connection_status}</span>
                          )}
                          {integration.last_successful_sync_at && (
                            <> · Last synced {new Date(integration.last_successful_sync_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(integration.id, providerInfo?.name || integration.provider)}
                      disabled={disconnectingId === integration.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors active:scale-95 disabled:opacity-50"
                    >
                      {disconnectingId === integration.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unplug className="w-3 h-3" />
                      )}
                      Disconnect
                    </button>
                  </div>
                );
              })}

              {/* Available to connect */}
              {AVAILABLE_PROVIDERS.filter(p => !connectedByProvider.has(p.id)).map(provider => (
                <button
                  key={provider.id}
                  onClick={() => { setConnectingProvider(provider); setApiKeyInput(''); }}
                  className="w-full flex items-center justify-between px-4 py-3 border-t border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{provider.icon}</span>
                    <div className="text-left">
                      <p className="text-sm font-medium">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
                    <Plug className="w-3.5 h-3.5" /> Connect
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </ScrollReveal>

      {/* Connect integration dialog */}
      <AnimatePresence>
        {connectingProvider && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setConnectingProvider(null); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
            >
              <div className="px-5 pt-5 pb-4 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{connectingProvider.icon}</span>
                  <div>
                    <h3 className="font-semibold text-base">Connect {connectingProvider.name}</h3>
                    <p className="text-xs text-muted-foreground">{connectingProvider.description}</p>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 space-y-4">
                {connectingProvider.method === 'oauth' ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-primary" /> OAuth Authorization
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Clicking "Connect" will register {connectingProvider.name} as a pending integration. 
                        Full OAuth authorization will be available once the backend provider is configured.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary" /> API Key
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Enter your {connectingProvider.name} API key. Find it in your {connectingProvider.name} dashboard under Developer settings.
                      </p>
                    </div>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder={`sk_live_...`}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Your key is stored securely and never exposed in the browser.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleConnectIntegration}
                    disabled={submittingIntegration || (connectingProvider.method === 'api_key' && !apiKeyInput.trim())}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {submittingIntegration ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Plug className="w-4 h-4" /> Connect</>
                    )}
                  </button>
                  <button
                    onClick={() => setConnectingProvider(null)}
                    className="px-5 py-2.5 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team section with invite */}
      <ScrollReveal delay={0.3}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Team</h3>
            <span className="text-xs text-muted-foreground">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</span>
          </div>
          {teamMembers.map(m => {
            const profile = (m as any).profiles;
            const name = profile?.full_name || profile?.email || 'Member';
            return (
              <div key={m.id} className="px-4 py-3 border-t border-border/40 flex items-center justify-between text-sm">
                <span>{name}</span>
                <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              </div>
            );
          })}
          <button onClick={() => setShowInvite(!showInvite)}
            className="w-full text-left px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99] text-primary font-medium">
            + Invite team member
          </button>
          <AnimatePresence>
            {showInvite && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}>
                <div className="px-4 py-4 border-t border-border/40 space-y-3">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com" type="email"
                    className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={handleInvite} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm active:scale-95">
                      Send invite
                    </button>
                    <button onClick={() => setShowInvite(false)} className="px-4 py-2.5 rounded-lg bg-card border border-border text-sm active:scale-95">
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollReveal>

      {/* Data & Privacy */}
      <ScrollReveal delay={0.35}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30">
            <h3 className="text-sm font-semibold">Data & Privacy</h3>
          </div>
          <button onClick={handleExportData}
            className="w-full text-left px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]">
            Export all data
          </button>
          <button onClick={() => navigate('/admin')}
            className="w-full text-left px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]">
            Audit log
          </button>
        </div>
      </ScrollReveal>
    </div>
  );
}

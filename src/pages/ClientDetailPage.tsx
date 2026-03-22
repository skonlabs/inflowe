import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, AlertCircle, Ban, Play, Edit3, X, Check } from 'lucide-react';
import { demoClients, demoInvoices, formatCurrency, getStateLabel, getStateClass } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { useAppState } from '@/contexts/AppStateContext';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserOrganization, useClientDetail, useClientInvoices, useUpdateClient } from '@/hooks/use-supabase-data';

const sensitivityLabels: Record<string, { label: string; className: string }> = {
  standard: { label: 'Standard', className: 'status-paid' },
  sensitive: { label: 'Sensitive', className: 'status-due-soon' },
  vip: { label: 'VIP', className: 'status-pending' },
  high_value: { label: 'High Value', className: 'status-pending' },
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clientActions, setClientAction, invoiceActions, emergencyStop } = useAppState();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbClient } = useClientDetail(id, orgId);
  const { data: dbClientInvoices } = useClientInvoices(id, orgId);
  const updateClient = useUpdateClient();

  const primaryContact = dbClient?.client_contacts
    ? ((dbClient.client_contacts as any[]).find((c: any) => c.is_primary) || (dbClient.client_contacts as any[])[0])
    : null;

  // When user has an org, only use real data — never fall back to demo.
  // Demo data is only shown for unauthenticated / demo-mode users.
  const demoClient = orgId ? null : demoClients.find(c => c.id === id);

  const client = dbClient ? {
    id: dbClient.id,
    displayName: dbClient.display_name,
    sensitivityLevel: dbClient.sensitivity_level as any,
    preferredChannel: dbClient.preferred_channel,
    contactName: primaryContact?.full_name ?? '',
    contactEmail: primaryContact?.email ?? '',
    outstandingTotal: 0,
    overdueTotal: 0,
    invoiceCount: dbClientInvoices?.length ?? 0,
    riskScore: 0,
  } : demoClient ? {
    id: demoClient.id,
    displayName: demoClient.displayName,
    sensitivityLevel: demoClient.sensitivityLevel,
    preferredChannel: demoClient.preferredChannel,
    contactName: demoClient.contactName,
    contactEmail: demoClient.contactEmail,
    outstandingTotal: demoClient.outstandingTotal,
    overdueTotal: demoClient.overdueTotal,
    invoiceCount: demoClient.invoiceCount,
    riskScore: demoClient.riskScore,
  } : null;

  // Map invoices — only fall back to demo when no orgId (demo mode)
  const clientInvoices = orgId
    ? (dbClientInvoices ?? []).map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number ?? '',
        amount: Number(inv.amount),
        remainingBalance: Number(inv.remaining_balance),
        dueDate: inv.due_date,
        state: inv.state,
        daysOverdue: inv.days_overdue ?? 0,
      }))
    : demoInvoices.filter(i => i.clientId === id).map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        remainingBalance: inv.remainingBalance,
        dueDate: inv.dueDate,
        state: inv.state,
        daysOverdue: inv.daysOverdue,
      }));

  // Calculate totals from invoices if using Supabase
  if (client && dbClientInvoices && dbClientInvoices.length > 0) {
    client.outstandingTotal = dbClientInvoices.reduce((sum, i) => sum + Number(i.remaining_balance), 0);
    client.overdueTotal = dbClientInvoices.filter(i => i.state === 'overdue').reduce((sum, i) => sum + Number(i.remaining_balance), 0);
  }

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: client?.displayName || '',
    sensitivityLevel: client?.sensitivityLevel || 'standard',
    preferredChannel: client?.preferredChannel || 'email',
    notes: '',
  });

  useEffect(() => {
    if (!client) return;
    setEditForm({
      displayName: client.displayName,
      sensitivityLevel: client.sensitivityLevel,
      preferredChannel: client.preferredChannel,
      notes: dbClient?.notes ?? '',
    });
  }, [client, dbClient?.notes]);

  if (!client) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Client not found</p>
        <button onClick={() => navigate('/clients')} className="text-primary text-sm mt-2">← Back to clients</button>
      </div>
    );
  }

  const actions = clientActions[client.id] || {};
  const isPaused = actions.isPaused || dbClient?.do_not_automate || emergencyStop || false;
  const sensitivity = sensitivityLabels[client.sensitivityLevel] || sensitivityLabels.standard;

  const handleTogglePause = async () => {
    if (!orgId) return;
    const nextPaused = !(dbClient?.do_not_automate || actions.isPaused);
    try {
      await updateClient.mutateAsync({
        clientId: client.id,
        orgId,
        fields: { do_not_automate: nextPaused },
      });
      setClientAction(client.id, { isPaused: nextPaused });
      toast(nextPaused ? `Automation paused for ${client.displayName}` : `Automation resumed for ${client.displayName}`, {
        icon: nextPaused ? '⏸️' : '▶️',
      });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update client automation');
    }
  };

  const handleSaveEdit = async () => {
    if (!orgId) return;
    try {
      await updateClient.mutateAsync({
        clientId: client.id,
        orgId,
        fields: {
          display_name: editForm.displayName,
          sensitivity_level: editForm.sensitivityLevel,
          preferred_channel: editForm.preferredChannel,
          notes: editForm.notes || null,
        },
      });
      setIsEditing(false);
      toast.success('Client details updated');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update client');
    }
  };

  return (
    <div className="px-4 py-4 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <ScrollReveal>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-lg">{client.displayName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{client.displayName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sensitivity.className}`}>{sensitivity.label}</span>
                <span className="text-xs text-muted-foreground">{client.preferredChannel}</span>
              </div>
            </div>
          </div>

          {isPaused && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning font-medium flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" /> {emergencyStop ? 'All automation halted (emergency stop)' : 'Automation paused for this client'}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-semibold text-sm text-tabular">{formatCurrency(client.outstandingTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="font-semibold text-sm text-tabular text-destructive">{formatCurrency(client.overdueTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoices</p>
              <p className="font-semibold text-sm text-tabular">{client.invoiceCount}</p>
            </div>
          </div>

          {client.riskScore > 0.3 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Risk assessment</p>
                <span className="text-xs font-medium">{Math.round(client.riskScore * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${client.riskScore > 0.7 ? 'bg-destructive' : client.riskScore > 0.4 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${client.riskScore * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </ScrollReveal>

      {/* Edit form */}
      <AnimatePresence>
        {isEditing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-sm">Edit client</h2>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Display name</label>
                <input value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Sensitivity level</label>
                <select value={editForm.sensitivityLevel} onChange={e => setEditForm(f => ({ ...f, sensitivityLevel: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="standard">Standard</option>
                  <option value="sensitive">Sensitive</option>
                  <option value="vip">VIP</option>
                  <option value="high_value">High Value</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Preferred channel</label>
                <select value={editForm.preferredChannel} onChange={e => setEditForm(f => ({ ...f, preferredChannel: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Add internal notes..."
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setIsEditing(false)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary contact */}
      {client.contactName && (
        <ScrollReveal delay={0.1}>
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-3">Primary contact</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-medium">{client.contactName.split(' ').filter(Boolean).map(w => w[0]).join('')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{client.contactName}</p>
                <p className="text-xs text-muted-foreground truncate">{client.contactEmail}</p>
              </div>
              {client.contactEmail && (
                <a href={`mailto:${client.contactEmail}`} className="p-2 rounded-full hover:bg-muted transition-colors active:scale-95">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Quick actions */}
      <ScrollReveal delay={0.15}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleTogglePause}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform">
            {isPaused && !emergencyStop ? <><Play className="w-4 h-4" /> Resume</> : <><Ban className="w-4 h-4" /> Pause</>}
          </button>
          <button onClick={() => setIsEditing(!isEditing)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform">
            <Edit3 className="w-4 h-4" /> {isEditing ? 'Cancel' : 'Edit client'}
          </button>
        </div>
      </ScrollReveal>

      {/* Client invoices */}
      <ScrollReveal delay={0.2}>
        <div className="space-y-2">
          <h2 className="font-semibold text-base">Invoices</h2>
          {clientInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices for this client.</p>
          ) : (
            <StaggerContainer className="space-y-2">
              {clientInvoices.map(inv => {
                const invActions = invoiceActions[inv.id] || {};
                const state = invActions.isPaid ? 'paid' : invActions.isDisputed ? 'disputed' : inv.state;
                return (
                  <StaggerItem key={inv.id}>
                    <button onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="glass-card-hover rounded-xl p-4 w-full text-left active:scale-[0.97] transition-transform">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm text-tabular">{formatCurrency(invActions.isPaid ? 0 : inv.remainingBalance)}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStateClass(state)}`}>
                            {getStateLabel(state)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          )}
        </div>
      </ScrollReveal>

      {/* Activity */}
      <ScrollReveal delay={0.25}>
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Recent activity</h2>
          {[
            { text: `Reminder sent for ${clientInvoices[0]?.invoiceNumber || 'invoice'}`, time: '2 weeks ago', icon: Mail },
            { text: `Invoice became overdue`, time: '29 days ago', icon: AlertCircle },
          ].map((event, i) => {
            const Icon = event.icon;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  {i < 1 && <div className="w-px h-full bg-border min-h-[16px]" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm">{event.text}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </div>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Pause, Play, CheckCircle, AlertTriangle, Clock, FileText, MessageSquare, Flag, CreditCard, DollarSign, Shield } from 'lucide-react';
import { demoInvoices, demoInvoiceTimelines, formatCurrency, getStateLabel, getStateClass } from '@/lib/demo-data';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useUserOrganization,
  useInvoiceDetail,
  useInvoiceTimeline,
  useMarkInvoicePaid,
  useSetInvoiceHold,
  useSetInvoiceDispute,
} from '@/hooks/use-supabase-data';

const TIMELINE_ICON: Record<string, React.ElementType> = {
  message_sent: Mail,
  draft_generated: FileText,
  message_failed: AlertTriangle,
  reply_received: MessageSquare,
  payment_recorded: DollarSign,
  invoice_paid: CheckCircle,
  invoice_put_on_hold: Pause,
  invoice_resumed: Play,
  invoice_disputed: Flag,
  invoice_dispute_cleared: Shield,
  invoice_imported: FileText,
  invoice_state_changed: AlertTriangle,
};

function getTimelineIcon(eventType: string): React.ElementType {
  return TIMELINE_ICON[eventType] || Clock;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbInvoice, isLoading } = useInvoiceDetail(id, orgId);
  const { data: dbTimelineEvents = [] } = useInvoiceTimeline(id, orgId);

  const isDemo = !!(membership?.organizations as any)?.is_demo;
  // Use real timeline for authenticated users; demo timeline for demo mode
  const timelineEvents = (orgId && dbTimelineEvents.length > 0) ? dbTimelineEvents
    : (!orgId || isDemo) ? (demoInvoiceTimelines[id || ''] ?? []) : dbTimelineEvents;

  const markPaid = useMarkInvoicePaid();
  const setHold = useSetInvoiceHold();
  const setDispute = useSetInvoiceDispute();

  const [showPaymentPlan, setShowPaymentPlan] = useState(false);
  const [planInstallments, setPlanInstallments] = useState(3);
  const [creatingPlan, setCreatingPlan] = useState(false);

  // Fall back to demo when no orgId OR when org is demo and DB returned nothing.
  const demoInvoice = (!orgId || (isDemo && !dbInvoice)) ? demoInvoices.find(i => i.id === id) : null;
  const isDemoRecord = !!demoInvoice;
  const invoice = dbInvoice ? {
    id: dbInvoice.id,
    invoiceNumber: dbInvoice.invoice_number ?? '',
    clientId: dbInvoice.client_id,
    clientName: (dbInvoice.clients as any)?.display_name ?? 'Unknown',
    amount: Number(dbInvoice.amount),
    remainingBalance: Number(dbInvoice.remaining_balance),
    currency: dbInvoice.currency,
    dueDate: dbInvoice.due_date,
    state: dbInvoice.state,
    daysOverdue: dbInvoice.days_overdue ?? 0,
    nextActionAt: dbInvoice.next_action_planned_at,
    contactName: (dbInvoice.client_contacts as any)?.[0]?.full_name ?? '',
    contactEmail: (dbInvoice.client_contacts as any)?.[0]?.email ?? '',
  } : demoInvoice ? {
    id: demoInvoice.id,
    invoiceNumber: demoInvoice.invoiceNumber,
    clientId: demoInvoice.clientId,
    clientName: demoInvoice.clientName,
    amount: demoInvoice.amount,
    remainingBalance: demoInvoice.remainingBalance,
    currency: demoInvoice.currency,
    dueDate: demoInvoice.dueDate,
    state: demoInvoice.state,
    daysOverdue: demoInvoice.daysOverdue,
    nextActionAt: demoInvoice.nextActionAt,
    contactName: demoInvoice.contactName,
    contactEmail: demoInvoice.contactEmail,
  } : null;

  if (isLoading) {
    return <div className="px-4 py-12 text-center"><p className="text-muted-foreground text-sm">Loading invoice…</p></div>;
  }

  if (!invoice) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Invoice not found</p>
        <button onClick={() => navigate('/invoices')} className="text-accent text-sm mt-2">← Back to invoices</button>
      </div>
    );
  }

  const isPaid = invoice.state === 'paid';
  const isPaused = invoice.state === 'on_hold';
  const isDisputed = invoice.state === 'disputed';
  const currentState = invoice.state;

  const handleMarkPaid = async () => {
    if (!orgId) { toast.info('Sign up to manage invoices'); return; }
    try {
      await markPaid.mutateAsync({ invoiceId: invoice.id, orgId, method: 'manual' });
      toast.success(`${invoice.invoiceNumber} marked as paid`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to mark invoice paid');
    }
  };

  const handleTogglePause = async () => {
    if (!orgId) { toast.info('Sign up to manage invoices'); return; }
    try {
      await setHold.mutateAsync({ invoiceId: invoice.id, orgId, onHold: !isPaused });
      toast(isPaused ? 'Automation resumed for this invoice' : 'Automation paused for this invoice', {
        icon: isPaused ? '▶️' : '⏸️',
      });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update hold status');
    }
  };

  const handleDispute = async () => {
    if (!orgId) { toast.info('Sign up to manage invoices'); return; }
    try {
      await setDispute.mutateAsync({ invoiceId: invoice.id, orgId, disputeActive: true });
      toast('Invoice flagged as disputed — automation paused', { icon: '🚩' });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to flag dispute');
    }
  };

  const handleClearDispute = async () => {
    if (!orgId) { toast.info('Sign up to manage invoices'); return; }
    try {
      await setDispute.mutateAsync({ invoiceId: invoice.id, orgId, disputeActive: false });
      toast.success('Dispute cleared');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to clear dispute');
    }
  };

  const handleCreatePlan = async () => {
    if (!orgId || !invoice) return;
    setCreatingPlan(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const installments = Array.from({ length: planInstallments }).map((_, i) => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (i + 1) * 30);
        const amount = i < planInstallments - 1
          ? Math.floor(invoice.remainingBalance / planInstallments)
          : invoice.remainingBalance - Math.floor(invoice.remainingBalance / planInstallments) * (planInstallments - 1);
        return { installment: i + 1, amount, due_date: dueDate.toISOString().split('T')[0], status: 'pending' };
      });

      // Check if payment_plans table exists by attempting the insert
      const { data: plan, error: planError } = await supabase
        .from('payment_plans' as any)
        .insert({
          organization_id: orgId,
          client_id: invoice.clientId,
          invoice_id: invoice.id,
          total_amount: invoice.remainingBalance,
          remaining_amount: invoice.remainingBalance,
          installments,
          plan_status: 'active',
          created_by_user_id: user?.id ?? null,
        } as any)
        .select('id')
        .single();

      if (planError) {
        // Table may not exist yet — show a friendly message
        if (planError.message?.includes('relation') || planError.code === '42P01' || planError.code === 'PGRST204') {
          toast.info('Payment plans feature coming soon — this requires additional setup.');
        } else {
          throw planError;
        }
        return;
      }

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ payment_plan_active: true, payment_plan_id: (plan as any).id })
        .eq('id', invoice.id)
        .eq('organization_id', orgId);

      if (invoiceError) throw invoiceError;

      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-list', orgId] });
      toast.success(`Payment plan created: ${planInstallments} installments of ${formatCurrency(Math.floor(invoice.remainingBalance / planInstallments))}`);
      setShowPaymentPlan(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create payment plan');
    } finally {
      setCreatingPlan(false);
    }
  };

  const isMutating = markPaid.isPending || setHold.isPending || setDispute.isPending;

  return (
    <div className="px-4 py-4 space-y-6 max-w-screen-lg mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <ScrollReveal>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold">{invoice.invoiceNumber}</h1>
              <button onClick={() => navigate(`/clients/${invoice.clientId}`)} className="text-sm text-accent mt-0.5 active:scale-95">
                {invoice.clientName} →
              </button>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStateClass(currentState)}`}>
              {getStateLabel(currentState)}
            </span>
          </div>

          {isPaused && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning font-medium flex items-center gap-1.5">
              <Pause className="w-3.5 h-3.5" /> Automation paused for this invoice
            </div>
          )}

          {isDisputed && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5" /> Invoice is under dispute — automation halted
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-semibold text-tabular">{formatCurrency(invoice.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="font-semibold text-tabular">{isPaid ? formatCurrency(0) : formatCurrency(invoice.remainingBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due date</p>
              <p className="text-sm">{new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days overdue</p>
              <p className="text-sm font-medium">{invoice.daysOverdue > 0 && !isPaid ? `${invoice.daysOverdue} days` : '—'}</p>
            </div>
          </div>

          {invoice.contactName && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Contact</p>
              <p className="text-sm mt-0.5">{invoice.contactName}{invoice.contactEmail ? ` · ${invoice.contactEmail}` : ''}</p>
            </div>
          )}
        </div>
      </ScrollReveal>

      {/* Explainability — calm, helpful tone */}
      {invoice.state === 'overdue' && (
        <ScrollReveal delay={0.1}>
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              What's happening with this invoice?
            </h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>This invoice is <strong>{invoice.daysOverdue} days overdue</strong>. A reminder was sent but no reply has been received yet.</p>
              <p>
                {invoice.nextActionAt
                  ? `We've scheduled a follow-up for ${new Date(invoice.nextActionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — you can approve it when it's ready.`
                  : 'No automated follow-up is scheduled. You may want to reach out manually or set up a follow-up.'}
              </p>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Quick actions */}
      <ScrollReveal delay={0.15}>
        <div className="grid grid-cols-2 gap-2">
          {!isPaid && (
            <button onClick={handleMarkPaid} disabled={isMutating}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-success text-success-foreground font-medium text-sm active:scale-95 transition-transform disabled:opacity-60">
              <CheckCircle className="w-4 h-4" /> Mark paid
            </button>
          )}
          {!isPaid && (
            <button onClick={handleTogglePause} disabled={isMutating}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform disabled:opacity-60">
              {isPaused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
            </button>
          )}
          {!isDisputed && !isPaid && (
            <button onClick={handleDispute} disabled={isMutating}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform text-destructive disabled:opacity-60">
              <Flag className="w-4 h-4" /> Flag dispute
            </button>
          )}
          {isDisputed && (
            <button onClick={handleClearDispute} disabled={isMutating}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform text-success disabled:opacity-60">
              <Shield className="w-4 h-4" /> Clear dispute
            </button>
          )}
          {!isPaid && invoice.daysOverdue > 14 && (
            <button onClick={() => setShowPaymentPlan(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform">
              <CreditCard className="w-4 h-4" /> Payment plan
            </button>
          )}
        </div>
      </ScrollReveal>

      {/* Payment plan */}
      <AnimatePresence>
        {showPaymentPlan && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <div className="glass-card rounded-2xl p-5 space-y-4 border-2 border-accent/30">
              <h3 className="font-semibold text-sm">Create payment plan</h3>
              <p className="text-sm text-muted-foreground">Split {formatCurrency(invoice.remainingBalance)} into installments for {invoice.clientName}.</p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Number of installments</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 6].map(n => (
                    <button key={n} onClick={() => setPlanInstallments(n)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors active:scale-95 ${planInstallments === n ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {n}×
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                {Array.from({ length: planInstallments }).map((_, i) => {
                  const amount = i < planInstallments - 1
                    ? Math.floor(invoice.remainingBalance / planInstallments)
                    : invoice.remainingBalance - Math.floor(invoice.remainingBalance / planInstallments) * (planInstallments - 1);
                  const date = new Date();
                  date.setDate(date.getDate() + (i + 1) * 30);
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Installment {i + 1} · {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className="font-medium text-tabular">{formatCurrency(amount)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreatePlan} disabled={creatingPlan}
                  className="flex-1 py-3 rounded-xl bg-success text-success-foreground font-medium text-sm active:scale-95 transition-transform disabled:opacity-60">
                  {creatingPlan ? 'Creating…' : 'Create plan'}
                </button>
                <button onClick={() => setShowPaymentPlan(false)}
                  className="px-4 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity timeline */}
      <ScrollReveal delay={0.2}>
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Activity</h2>
          {timelineEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-0">
              {timelineEvents.map((event, index) => {
                const Icon = getTimelineIcon(event.event_type);
                const dateStr = new Date(event.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      {index < timelineEvents.length - 1 && <div className="w-px h-full bg-border min-h-[24px]" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm capitalize">{event.display_text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}

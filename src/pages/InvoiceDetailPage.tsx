import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Pause, Play, CheckCircle, AlertTriangle, Clock, FileText, MessageSquare, Flag } from 'lucide-react';
import { demoInvoices, formatCurrency, getStateLabel, getStateClass } from '@/lib/demo-data';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useState } from 'react';
import { toast } from 'sonner';

const timelineEvents = [
  { id: 't1', type: 'message_sent', text: 'Reminder sent via email to Sarah Chen', date: 'Mar 10, 2024', icon: Mail },
  { id: 't2', type: 'invoice_state_changed', text: 'Invoice became overdue', date: 'Feb 16, 2024', icon: AlertTriangle },
  { id: 't3', type: 'invoice_imported', text: 'Invoice imported from CSV upload', date: 'Feb 1, 2024', icon: FileText },
];

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const invoice = demoInvoices.find(i => i.id === id);
  const [isPaused, setIsPaused] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isDisputed, setIsDisputed] = useState(false);

  if (!invoice) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Invoice not found</p>
        <button onClick={() => navigate('/invoices')} className="text-primary text-sm mt-2">← Back to invoices</button>
      </div>
    );
  }

  const currentState = isPaid ? 'paid' : isDisputed ? 'disputed' : invoice.state;

  const handleMarkPaid = () => {
    setIsPaid(true);
    toast.success(`${invoice.invoiceNumber} marked as paid`);
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    toast(isPaused ? 'Automation resumed for this invoice' : 'Automation paused for this invoice', {
      icon: isPaused ? '▶️' : '⏸️',
    });
  };

  const handleDispute = () => {
    setIsDisputed(true);
    toast('Invoice flagged as disputed — automation paused', { icon: '🚩' });
  };

  return (
    <div className="px-4 py-4 space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <ScrollReveal>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold">{invoice.invoiceNumber}</h1>
              <button onClick={() => navigate(`/clients/${invoice.clientId}`)} className="text-sm text-primary mt-0.5 active:scale-95">
                {invoice.clientName} →
              </button>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStateClass(currentState)}`}>
              {isPaid ? 'Paid' : isDisputed ? 'Disputed' : getStateLabel(invoice.state)}
            </span>
          </div>

          {isPaused && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning font-medium flex items-center gap-1.5">
              <Pause className="w-3.5 h-3.5" /> Automation paused for this invoice
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

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">Contact</p>
            <p className="text-sm mt-0.5">{invoice.contactName} · {invoice.contactEmail}</p>
          </div>
        </div>
      </ScrollReveal>

      {/* Explainability panel */}
      {invoice.state === 'overdue' && !isPaid && (
        <ScrollReveal delay={0.1}>
          <div className="glass-card rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              What's happening?
            </h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Last action:</span> Reminder sent on Mar 10 — no reply received.</p>
              <p><span className="font-medium">Why:</span> Invoice is {invoice.daysOverdue} days overdue. Standard follow-up workflow triggered a second reminder.</p>
              <p><span className="font-medium">Next:</span> {isPaused ? 'Automation is paused — no actions scheduled.' : invoice.nextActionAt ? `Firm follow-up scheduled for ${new Date(invoice.nextActionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No actions scheduled — needs manual attention.'}</p>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Quick actions */}
      <ScrollReveal delay={0.15}>
        <div className="grid grid-cols-2 gap-2">
          {!isPaid && (
            <button
              onClick={handleMarkPaid}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform"
            >
              <CheckCircle className="w-4 h-4" /> Mark paid
            </button>
          )}
          <button
            onClick={handleTogglePause}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform"
          >
            {isPaused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
          </button>
          {!isDisputed && !isPaid && (
            <button
              onClick={handleDispute}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform text-destructive"
            >
              <Flag className="w-4 h-4" /> Flag dispute
            </button>
          )}
        </div>
      </ScrollReveal>

      {/* Activity timeline */}
      <ScrollReveal delay={0.2}>
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Activity</h2>
          <div className="space-y-0">
            {timelineEvents.map((event, index) => {
              const Icon = event.icon;
              return (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    {index < timelineEvents.length - 1 && <div className="w-px h-full bg-border min-h-[24px]" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm">{event.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

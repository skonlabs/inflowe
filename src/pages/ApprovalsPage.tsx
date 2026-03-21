import { useState } from 'react';
import { Check, X, Edit3, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { demoApprovals, formatCurrency } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState(demoApprovals);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = approvals.filter(a => a.status === 'pending');

  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' as const } : a));
    toast.success('Message approved and queued for sending');
  };

  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' as const } : a));
    toast.info('Message rejected — no message will be sent');
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pending.length > 0 ? `${pending.length} messages waiting for your review` : 'All caught up! 🎉'}
        </p>
      </ScrollReveal>

      {pending.length === 0 && (
        <ScrollReveal delay={0.1}>
          <div className="glass-card rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-success" />
            </div>
            <p className="font-medium">No pending approvals</p>
            <p className="text-sm text-muted-foreground mt-1">We'll notify you when new follow-ups need your review.</p>
          </div>
        </ScrollReveal>
      )}

      <StaggerContainer className="space-y-3">
        {pending.map(approval => {
          const isExpanded = expandedId === approval.id;
          return (
            <StaggerItem key={approval.id}>
              <div className="glass-card rounded-xl overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                  className="w-full text-left p-4 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{approval.clientName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {approval.invoiceNumber} · {formatCurrency(approval.amount)} · {approval.stage}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full status-overdue font-medium">{approval.daysOverdue}d</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{approval.rationale}</p>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="px-4 pb-4 space-y-3">
                        {/* Message preview */}
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Edit3 className="w-3 h-3" /> Message preview
                          </p>
                          <p className="text-sm whitespace-pre-line leading-relaxed">{approval.messagePreview}</p>
                        </div>

                        {/* What happens next */}
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          If approved, this message will be sent via email. Next check-in in 7 days.
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleApprove(approval.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform"
                          >
                            <Check className="w-4 h-4" /> Approve & Send
                          </button>
                          <button
                            onClick={() => handleReject(approval.id)}
                            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </div>
  );
}

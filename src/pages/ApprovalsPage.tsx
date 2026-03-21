import { useState } from 'react';
import { Check, X, Edit3, Clock, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { demoApprovals, formatCurrency } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useUserOrganization, useApprovals } from '@/hooks/use-supabase-data';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface DisplayApproval {
  id: string;
  outboundMessageId: string | null;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  daysOverdue: number;
  stage: string;
  rationale: string;
  messagePreview: string;
  status: string;
  isSupabase: boolean;
}

export default function ApprovalsPage() {
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbApprovals } = useApprovals(orgId);
  const queryClient = useQueryClient();

  // Map Supabase approvals or fallback to demo
  const supabaseApprovals: DisplayApproval[] = (dbApprovals && dbApprovals.length > 0)
    ? dbApprovals.map(a => ({
        id: a.id,
        outboundMessageId: (a as any).outbound_message_id ?? null,
        clientName: (a.clients as any)?.display_name ?? 'Unknown',
        invoiceNumber: (a.invoices as any)?.invoice_number ?? '',
        amount: Number((a.invoices as any)?.amount ?? 0),
        daysOverdue: (a.invoices as any)?.days_overdue ?? 0,
        stage: a.approval_type,
        rationale: a.rationale_shown,
        messagePreview: (a.outbound_messages as any)?.body_text ?? '',
        status: a.status,
        isSupabase: true,
      }))
    : demoApprovals.map(a => ({
        id: a.id,
        outboundMessageId: null,
        clientName: a.clientName,
        invoiceNumber: a.invoiceNumber,
        amount: a.amount,
        daysOverdue: a.daysOverdue,
        stage: a.stage,
        rationale: a.rationale,
        messagePreview: a.messagePreview,
        status: a.status,
        isSupabase: false,
      }));

  const [localApprovals, setLocalApprovals] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});

  const pending = supabaseApprovals.filter(a => !localApprovals[a.id] && a.status === 'pending');

  const persistEditedBody = async (approval: DisplayApproval) => {
    const edited = editedMessages[approval.id];
    if (edited && edited !== approval.messagePreview && approval.outboundMessageId) {
      const { error } = await supabase.rpc('update_approval_message_body', {
        _message_id: approval.outboundMessageId,
        _body_text: edited,
      });
      if (error) throw error;
    }
  };

  const handleApprove = async (approval: DisplayApproval) => {
    try {
      if (approval.isSupabase) {
        // Persist any edited body first
        await persistEditedBody(approval);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('approvals')
          .update({ status: 'approved', decision_at: new Date().toISOString(), approver_user_id: user?.id })
          .eq('id', approval.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
      }
      setLocalApprovals(prev => ({ ...prev, [approval.id]: 'approved' }));
      setEditingId(null);
      toast.success('Message approved and queued for sending');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to approve');
    }
  };

  const handleReject = async (approval: DisplayApproval) => {
    try {
      if (approval.isSupabase) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('approvals')
          .update({ status: 'rejected', decision_at: new Date().toISOString(), approver_user_id: user?.id })
          .eq('id', approval.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
      }
      setLocalApprovals(prev => ({ ...prev, [approval.id]: 'rejected' }));
      setEditingId(null);
      toast.info('Message rejected — no message will be sent');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to reject');
    }
  };

  const startEditing = (id: string, currentText: string) => {
    setEditingId(id);
    setEditedMessages(prev => ({ ...prev, [id]: prev[id] || currentText }));
  };

  const saveEdit = async (approval: DisplayApproval) => {
    try {
      if (approval.isSupabase) {
        await persistEditedBody(approval);
      }
      setEditingId(null);
      toast.success('Message updated — review and approve when ready');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save edit');
    }
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
          const isEditing = editingId === approval.id;
          const displayText = editedMessages[approval.id] || approval.messagePreview;

          return (
            <StaggerItem key={approval.id}>
              <div className="glass-card rounded-xl overflow-hidden">
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

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="px-4 pb-4 space-y-3">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Edit3 className="w-3 h-3" /> {isEditing ? 'Editing message' : 'Message preview'}
                            </p>
                            {!isEditing ? (
                              <button onClick={() => startEditing(approval.id, displayText)} className="text-xs text-primary font-medium flex items-center gap-1 active:scale-95">
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                            ) : (
                              <button onClick={() => saveEdit(approval)} className="text-xs text-primary font-medium flex items-center gap-1 active:scale-95">
                                <Save className="w-3 h-3" /> Save
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <textarea
                              value={editedMessages[approval.id] || ''}
                              onChange={e => setEditedMessages(prev => ({ ...prev, [approval.id]: e.target.value }))}
                              className="w-full text-sm leading-relaxed bg-card border border-border rounded-lg p-3 min-h-[160px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-line leading-relaxed">{displayText}</p>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          If approved, this message will be sent via email. Next check-in in 7 days.
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleApprove(approval)} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform">
                            <Check className="w-4 h-4" /> Approve & Send
                          </button>
                          <button onClick={() => handleReject(approval)} className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform text-destructive">
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

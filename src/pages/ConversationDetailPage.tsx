import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useUserOrganization, useConversationThreads, useThreadMessages } from '@/hooks/use-supabase-data';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { demoThreadMessages } from '@/lib/demo-data';

// Demo fallback data
const demoThreadData: Record<string, { clientName: string; invoiceNumber: string; subject: string; channel: string }> = {
  t1: { clientName: 'Volta Brand Agency', invoiceNumber: 'INV-2026-048', subject: 'Re: Invoice INV-2026-048 Payment', channel: 'email' },
  t2: { clientName: 'Meridian Creative Co.', invoiceNumber: 'INV-2026-042', subject: 'Re: Payment Reminder', channel: 'email' },
  t3: { clientName: 'Northstar Digital', invoiceNumber: 'INV-2026-051', subject: 'Re: Invoice Follow-up', channel: 'email' },
  t4: { clientName: 'Fern & Bloom Marketing', invoiceNumber: 'INV-2026-038', subject: 'Payment Reminder', channel: 'email' },
  t5: { clientName: 'Bright Pixel Studios', invoiceNumber: 'INV-2026-055', subject: 'Upcoming Invoice Due', channel: 'email' },
};

const classLabels: Record<string, string> = {
  dispute_related: 'Dispute',
  out_of_office: 'Out of office',
  promise_to_pay: 'Promise to pay',
  payment_confirmed: 'Payment confirmed',
  unsubscribe_request: 'Unsubscribe',
};

export default function ConversationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const { data: dbThreads = [] } = useConversationThreads(orgId);
  const { data: dbMessages = [] } = useThreadMessages(id, orgId);

  const isDemo = !!(membership?.organizations as any)?.is_demo;
  const dbThread = dbThreads.find(t => t.id === id);
  // Fall back to demo when no orgId OR when org is demo and DB returned nothing.
  const demoThread = (!orgId || (isDemo && !dbThread)) ? demoThreadData[id || ''] : null;
  const isDemoRecord = !!demoThread;

  // Use real messages for DB threads; demo messages for demo threads
  const messages = (orgId && dbMessages.length > 0) ? dbMessages
    : (!orgId || isDemo) ? (demoThreadMessages[id || ''] ?? []) : dbMessages;

  const clientName = dbThread ? (dbThread.clients as any)?.display_name ?? 'Unknown' : demoThread?.clientName ?? '';
  const subject = dbThread?.subject ?? demoThread?.subject ?? '';
  const channel = dbThread?.channel ?? demoThread?.channel ?? 'email';

  const handleSend = async () => {
    if (!reply.trim() || !id) return;
    if (!orgId || isDemoRecord) {
      toast.info('This is demo data — connect real conversations to send replies');
      setReply('');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.rpc('create_manual_thread_reply', {
        _thread_id: id,
        _body_text: reply,
      });
      if (error) throw error;
      setReply('');
      qc.invalidateQueries({ queryKey: ['thread-messages', id] });
      toast.success('Reply saved as draft');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save reply');
    } finally {
      setSending(false);
    }
  };

  if (!dbThread && !demoThread) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Thread not found</p>
        <button onClick={() => navigate('/conversations')} className="text-accent text-sm mt-2">← Back to conversations</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 12rem)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <button onClick={() => navigate('/conversations')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 mb-2">
          <ArrowLeft className="w-4 h-4" /> Conversations
        </button>
        <h1 className="font-semibold text-sm truncate">{clientName}</h1>
        <p className="text-xs text-muted-foreground">{channel} · {subject}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No messages in this thread.</p>
        ) : (
          messages.map((msg, i) => (
            <ScrollReveal key={msg.id} delay={i * 0.06}>
              <div className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] space-y-1">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                    msg.direction === 'outbound'
                      ? 'bg-accent/10 text-foreground rounded-br-md'
                      : 'glass-card rounded-bl-md'
                  }`}>
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-muted-foreground">
                      {msg.senderName} · {new Date(msg.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {msg.classification && classLabels[msg.classification] && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                        {classLabels[msg.classification]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))
        )}
      </div>

      {/* Reply input — shown for both real and demo threads */}
      {(dbThread || demoThread) && (
        <div className="sticky bottom-20 bg-background border-t border-border px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type a reply…"
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
            />
            <button
              onClick={handleSend}
              disabled={sending || !reply.trim()}
              className="p-3 rounded-xl bg-accent text-accent-foreground active:scale-95 transition-transform disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Replies are saved as drafts and require manual sending from your email client</p>
        </div>
      )}
    </div>
  );
}

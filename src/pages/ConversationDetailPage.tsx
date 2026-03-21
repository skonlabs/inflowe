import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Phone, Mail, Info } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollReveal } from '@/components/ScrollReveal';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  text: string;
  timestamp: string;
  senderName: string;
  channel: 'email' | 'whatsapp';
  classification?: string;
}

const threadData: Record<string, { clientName: string; invoiceNumber: string; subject: string; channel: 'email' | 'whatsapp'; messages: Message[] }> = {
  t1: {
    clientName: 'Volta Brand Agency',
    invoiceNumber: 'INV-2024-035',
    subject: 'Re: Invoice INV-2024-035 Payment',
    channel: 'email',
    messages: [
      { id: 'm1', direction: 'outbound', text: 'Hi Priya,\n\nJust a friendly reminder that invoice INV-2024-035 for $4,500 was due on February 28th. Could you let us know when we can expect payment?\n\nThanks,\nYour Company', timestamp: 'Mar 1, 10:30 AM', senderName: 'InFlowe', channel: 'email' },
      { id: 'm2', direction: 'inbound', text: 'We have some concerns about the charges on this invoice. The design revision fees were not discussed beforehand. Can we schedule a call to go over the line items?', timestamp: 'Mar 5, 2:15 PM', senderName: 'Priya Patel', channel: 'email', classification: 'dispute_related' },
    ],
  },
  t2: {
    clientName: 'Meridian Creative Co.',
    invoiceNumber: 'INV-2024-042',
    subject: 'Re: Payment Reminder',
    channel: 'email',
    messages: [
      { id: 'm3', direction: 'outbound', text: 'Hi Sarah,\n\nThis is a reminder about invoice INV-2024-042 for $8,500, which was due on February 15th. Please let us know if you need anything.\n\nBest,\nYour Company', timestamp: 'Mar 10, 9:00 AM', senderName: 'InFlowe', channel: 'email' },
      { id: 'm4', direction: 'inbound', text: "Hi, I'll be out of office until March 25th. Will process this when I return.", timestamp: 'Mar 11, 4:42 PM', senderName: 'Sarah Chen', channel: 'email', classification: 'out_of_office' },
    ],
  },
  t3: {
    clientName: 'Northstar Digital',
    invoiceNumber: 'INV-2024-051',
    subject: 'Re: Invoice Follow-up',
    channel: 'email',
    messages: [
      { id: 'm5', direction: 'outbound', text: 'Hi Jake,\n\nJust a friendly reminder that invoice INV-2024-051 for $3,200 was due on March 5th. Could you let me know when we can expect payment?\n\nThanks,\nYour Company', timestamp: 'Mar 18, 10:00 AM', senderName: 'InFlowe', channel: 'email' },
      { id: 'm6', direction: 'inbound', text: 'Payment has been initiated, should arrive in 2-3 business days.', timestamp: 'Mar 18, 3:20 PM', senderName: 'Jake Morrison', channel: 'email', classification: 'promise_to_pay' },
    ],
  },
  t4: {
    clientName: 'Fern & Bloom Marketing',
    invoiceNumber: 'INV-2024-038',
    subject: 'Payment Reminder',
    channel: 'email',
    messages: [
      { id: 'm7', direction: 'outbound', text: 'Hi Amir,\n\nWe need to bring your attention to invoice INV-2024-038 for $5,600, now 39 days past due.\n\nPlease let us know your plans for payment.\n\nRegards,\nYour Company', timestamp: 'Mar 8, 11:00 AM', senderName: 'InFlowe', channel: 'email' },
    ],
  },
  t5: {
    clientName: 'Bright Pixel Studios',
    invoiceNumber: 'INV-2024-055',
    subject: 'Upcoming Invoice Due',
    channel: 'email',
    messages: [
      { id: 'm8', direction: 'outbound', text: 'Hi Marcus,\n\nJust a heads up that invoice INV-2024-055 for $15,000 is coming due on March 28th. No action needed right now — just keeping you in the loop.\n\nBest,\nYour Company', timestamp: 'Mar 19, 9:00 AM', senderName: 'InFlowe', channel: 'email' },
    ],
  },
};

export default function ConversationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reply, setReply] = useState('');
  const thread = threadData[id || ''];

  if (!thread) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Thread not found</p>
        <button onClick={() => navigate('/conversations')} className="text-primary text-sm mt-2">← Back to conversations</button>
      </div>
    );
  }

  const classLabels: Record<string, string> = {
    dispute_related: 'Dispute',
    out_of_office: 'Out of office',
    promise_to_pay: 'Promise to pay',
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 12rem)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <button onClick={() => navigate('/conversations')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95 mb-2">
          <ArrowLeft className="w-4 h-4" /> Conversations
        </button>
        <h1 className="font-semibold text-sm truncate">{thread.clientName}</h1>
        <p className="text-xs text-muted-foreground">{thread.invoiceNumber} · {thread.channel} · {thread.subject}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {thread.messages.map((msg, i) => (
          <ScrollReveal key={msg.id} delay={i * 0.06}>
            <div className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] space-y-1`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  msg.direction === 'outbound'
                    ? 'bg-primary/10 text-foreground rounded-br-md'
                    : 'glass-card rounded-bl-md'
                }`}>
                  {msg.text}
                </div>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] text-muted-foreground">{msg.senderName} · {msg.timestamp}</span>
                  {msg.classification && classLabels[msg.classification] && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                      {classLabels[msg.classification]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Reply input */}
      <div className="sticky bottom-20 bg-background border-t border-border px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a reply…"
            value={reply}
            onChange={e => setReply(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
          <button className="p-3 rounded-xl bg-primary text-primary-foreground active:scale-95 transition-transform">
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Manual replies are logged but not sent through InFlowe in demo mode</p>
      </div>
    </div>
  );
}

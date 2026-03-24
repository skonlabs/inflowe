import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare } from 'lucide-react';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { useUserOrganization, useConversationThreads } from '@/hooks/use-supabase-data';

interface Thread {
  id: string;
  clientName: string;
  invoiceNumber: string;
  subject: string;
  lastMessage: string;
  classification: 'auto_handled' | 'needs_user_input' | 'risky' | 'dispute_related';
  channel: 'email' | 'whatsapp';
  latestAt: string;
  unread: boolean;
}

const demoThreads: Thread[] = [
  { id: 't1', clientName: 'Volta Brand Agency', invoiceNumber: 'INV-2026-048', subject: 'Re: Invoice INV-2026-048 Payment', lastMessage: 'We have some concerns about the charges on this invoice — the retainer hours don\'t match our contract.', classification: 'dispute_related', channel: 'email', latestAt: '2 hours ago', unread: true },
  { id: 't2', clientName: 'Meridian Creative Co.', invoiceNumber: 'INV-2026-042', subject: 'Re: Payment Reminder', lastMessage: "Hi, I'll be out of office until next week. Will process this as soon as I'm back. Sorry for the delay!", classification: 'needs_user_input', channel: 'email', latestAt: '1 day ago', unread: true },
  { id: 't3', clientName: 'Northstar Digital', invoiceNumber: 'INV-2026-051', subject: 'Re: Invoice Follow-up', lastMessage: 'Payment has been initiated from our end — should arrive in 2–3 business days.', classification: 'auto_handled', channel: 'email', latestAt: '3 days ago', unread: false },
  { id: 't4', clientName: 'Fern & Bloom Marketing', invoiceNumber: 'INV-2026-038', subject: 'Payment Reminder', lastMessage: 'Second reminder sent via email — no reply received yet.', classification: 'auto_handled', channel: 'email', latestAt: '7 days ago', unread: false },
  { id: 't5', clientName: 'Bright Pixel Studios', invoiceNumber: 'INV-2026-055', subject: 'Upcoming Invoice Due', lastMessage: 'Gentle reminder sent — invoice due in 4 days.', classification: 'auto_handled', channel: 'email', latestAt: '2 days ago', unread: false },
];

const classificationBadge: Record<string, { label: string; className: string }> = {
  auto_handled: { label: 'Auto-handled', className: 'status-paid' },
  needs_user_input: { label: 'Needs your input', className: 'status-due-soon' },
  risky: { label: 'Sensitive', className: 'status-overdue' },
  dispute_related: { label: 'Dispute', className: 'status-overdue' },
};

const filters = ['All', 'Needs input', 'Disputes', 'Auto-handled'];

function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes || 1} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ConversationsPage() {
  const navigate = useNavigate();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbThreads = [], isLoading } = useConversationThreads(orgId);

  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');

  // When user has an org, show only real data (empty while loading).
  // Only show demo threads for users without an org.
  const threads: Thread[] = orgId
    ? dbThreads.map(t => ({
        id: t.id,
        clientName: (t.clients as any)?.display_name ?? 'Unknown Client',
        invoiceNumber: (t.invoices as any)?.invoice_number ?? '',
        subject: t.subject ?? '',
        lastMessage: t.subject ?? 'View messages',
        classification: (t.thread_classification as Thread['classification']) ?? 'auto_handled',
        channel: (t.channel as Thread['channel']) ?? 'email',
        latestAt: formatRelativeTime(t.latest_message_at),
        unread: !!t.latest_reply_at && t.thread_status === 'active',
      }))
    : demoThreads;

  const filtered = threads.filter(t => {
    if (search && !t.clientName.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeFilter === 'Needs input' && t.classification !== 'needs_user_input') return false;
    if (activeFilter === 'Disputes' && t.classification !== 'dispute_related') return false;
    if (activeFilter === 'Auto-handled' && t.classification !== 'auto_handled') return false;
    return true;
  });

  const needsAttention = threads.filter(t => t.classification === 'needs_user_input' || t.classification === 'dispute_related').length;

  return (
    <div className="px-4 py-6 space-y-4">
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? 'Loading…' : needsAttention > 0 ? `${needsAttention} needing your attention` : 'All caught up!'}
        </p>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search conversations..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
          />
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {filters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
            >{f}</button>
          ))}
        </div>
      </ScrollReveal>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Loading conversations…</p>
        </div>
      )}

      {!isLoading && (
        <StaggerContainer className="space-y-2">
          {filtered.map(thread => {
            const badge = classificationBadge[thread.classification] ?? classificationBadge.auto_handled;
            return (
              <StaggerItem key={thread.id}>
                <button
                  onClick={() => navigate(`/conversations/${thread.id}`)}
                  className="glass-card-hover rounded-xl p-4 w-full text-left active:scale-[0.97] transition-transform"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {thread.unread && <div className="w-2 h-2 rounded-full bg-accent shrink-0 animate-pulse-dot" />}
                      <span className="font-medium text-sm truncate">{thread.clientName}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${badge.className}`}>{badge.label}</span>
                  </div>
                  {thread.invoiceNumber && (
                    <p className="text-xs text-muted-foreground">{thread.invoiceNumber} · {thread.channel}</p>
                  )}
                  {!thread.invoiceNumber && (
                    <p className="text-xs text-muted-foreground">{thread.channel}</p>
                  )}
                  <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">{thread.lastMessage}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">{thread.latestAt}</p>
                </button>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No conversations match your filters</p>
        </div>
      )}
    </div>
  );
}

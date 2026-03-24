import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle2, TrendingUp, ArrowRight, Phone, Calendar, Sparkles } from 'lucide-react';
import { formatCurrency, demoApprovals, homeSummary as demoHomeSummary, aiRecommendations } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { useUserOrganization, useHomeSummary, useApprovals, useRecoveredThisWeek } from '@/hooks/use-supabase-data';

export default function HomePage() {
  const navigate = useNavigate();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbSummary } = useHomeSummary(orgId);
  const { data: dbApprovals } = useApprovals(orgId);
  const { data: recoveredThisWeek = 0 } = useRecoveredThisWeek(orgId);

  const isDemo = !!(membership?.organizations as any)?.is_demo;
  const hasRealSummary = dbSummary && (Number(dbSummary.overdue_total ?? 0) > 0 || Number(dbSummary.due_soon_total ?? 0) > 0 || (dbSummary.approvals_pending ?? 0) > 0);
  const s = hasRealSummary ? {
    overdueTotal: Number(dbSummary.overdue_total ?? 0),
    overdueCount: dbSummary.overdue_count ?? 0,
    dueSoonTotal: Number(dbSummary.due_soon_total ?? 0),
    dueSoonCount: dbSummary.due_soon_count ?? 0,
    approvalsPending: dbSummary.approvals_pending ?? 0,
    repliesNeedingAttention: dbSummary.replies_needing_attention ?? 0,
    recoveredThisWeek,
    totalOutstanding: Number(dbSummary.overdue_total ?? 0) + Number(dbSummary.due_soon_total ?? 0),
  } : demoHomeSummary;

  const approvals = (dbApprovals && dbApprovals.length > 0)
    ? dbApprovals.slice(0, 2).map(a => ({
        id: a.id,
        clientName: (a.clients as any)?.display_name ?? 'Unknown',
        invoiceNumber: (a.invoices as any)?.invoice_number ?? '',
        amount: Number((a.invoices as any)?.amount ?? 0),
        daysOverdue: (a.invoices as any)?.days_overdue ?? 0,
        stage: a.approval_type,
        rationale: a.rationale_shown,
      }))
    : demoApprovals.slice(0, 2).map(a => ({
        id: a.id,
        clientName: a.clientName,
        invoiceNumber: a.invoiceNumber,
        amount: a.amount,
        daysOverdue: a.daysOverdue,
        stage: a.stage,
        rationale: a.rationale,
      }));

  const orgName = membership?.organizations
    ? (membership.organizations as any).display_name
    : null;

  const handleRecommendationClick = (recommendationId: string) => {
    if (recommendationId === 'r1') navigate('/clients');
    else if (recommendationId === 'r2') navigate('/invoices');
    else navigate('/invoices?filter=due_soon');
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="px-4 py-6 space-y-6 max-w-screen-lg mx-auto">
      <ScrollReveal>
        <div>
          <h1 className="text-2xl font-bold" style={{ lineHeight: '1.15' }}>{greeting} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {orgName ? `${orgName} — here's what needs attention` : "Here's what needs your attention today"}
          </p>
        </div>
      </ScrollReveal>

      {/* Total outstanding — calm hero stat */}
      <ScrollReveal delay={0.05}>
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">Total outstanding</p>
          <p className="text-3xl font-bold text-tabular mt-1">{formatCurrency(s.totalOutstanding)}</p>
          {s.totalOutstanding > 0 && (
            <div className="flex gap-6 mt-4">
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${Math.min((s.overdueTotal / s.totalOutstanding) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{formatCurrency(s.overdueTotal)} overdue</p>
              </div>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${Math.min((s.dueSoonTotal / s.totalOutstanding) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{formatCurrency(s.dueSoonTotal)} due soon</p>
              </div>
            </div>
          )}
        </div>
      </ScrollReveal>

      {/* Action cards — what needs attention */}
      <StaggerContainer className="grid grid-cols-2 gap-3">
        <StaggerItem>
          <button onClick={() => navigate('/invoices?filter=overdue')} className="glass-card-hover rounded-2xl p-4 w-full text-left active:scale-[0.97] transition-transform">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle className="w-4.5 h-4.5 text-destructive" />
            </div>
            <p className="text-xl font-bold text-tabular">{formatCurrency(s.overdueTotal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.overdueCount} overdue — follow up now</p>
          </button>
        </StaggerItem>
        <StaggerItem>
          <button onClick={() => navigate('/invoices?filter=due_soon')} className="glass-card-hover rounded-2xl p-4 w-full text-left active:scale-[0.97] transition-transform">
            <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center mb-3">
              <Clock className="w-4.5 h-4.5 text-warning" />
            </div>
            <p className="text-xl font-bold text-tabular">{formatCurrency(s.dueSoonTotal)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.dueSoonCount} due soon</p>
          </button>
        </StaggerItem>
        <StaggerItem>
          <button onClick={() => navigate('/approvals')} className="glass-card-hover rounded-2xl p-4 w-full text-left active:scale-[0.97] transition-transform">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-4.5 h-4.5 text-accent" />
            </div>
            <p className="text-xl font-bold text-tabular">{s.approvalsPending}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Messages to approve</p>
          </button>
        </StaggerItem>
        <StaggerItem>
          <div className="glass-card rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center mb-3">
              <TrendingUp className="w-4.5 h-4.5 text-success" />
            </div>
            <p className="text-xl font-bold text-tabular">{formatCurrency(s.recoveredThisWeek)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Recovered this week</p>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Approvals needing action */}
      <ScrollReveal delay={0.1}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Needs your approval</h2>
            <button onClick={() => navigate('/approvals')} className="text-sm text-accent font-medium flex items-center gap-1 active:scale-95">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {approvals.length === 0 ? (
            <div className="glass-card rounded-2xl p-5 text-center">
              <p className="text-sm text-muted-foreground">No pending approvals — you're all caught up 🎉</p>
            </div>
          ) : approvals.map(a => (
            <button
              key={a.id}
              onClick={() => navigate('/approvals')}
              className="glass-card-hover rounded-2xl p-4 w-full text-left active:scale-[0.97] transition-transform"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold">{a.clientName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full status-overdue font-medium">{a.daysOverdue}d overdue</span>
              </div>
              <p className="text-xs text-muted-foreground">{a.invoiceNumber} · {formatCurrency(a.amount)} · {a.stage}</p>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{a.rationale}</p>
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* Smart suggestions */}
      <ScrollReveal delay={0.2}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-base">Smart suggestions</h2>
          </div>
          {aiRecommendations.map(r => {
            const Icon = r.icon === 'phone' ? Phone : r.icon === 'calendar' ? Calendar : TrendingUp;
            return (
              <div key={r.id} className="glass-card rounded-2xl p-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{r.text}</p>
                    <button onClick={() => handleRecommendationClick(r.id)} className="text-sm text-accent font-medium mt-2 active:scale-95">{r.action} →</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </div>
  );
}

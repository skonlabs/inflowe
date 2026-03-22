import { useState } from 'react';
import { TrendingUp, Calendar, Download, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/demo-data';
import { ScrollReveal } from '@/components/ScrollReveal';
import { toast } from 'sonner';
import { useUserOrganization, useReportsData, useWeeklyBriefs } from '@/hooks/use-supabase-data';

function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inflowe-${name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${name} report downloaded`);
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'brief'>('overview');
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;

  const { data: reportsData, isLoading: reportsLoading } = useReportsData(orgId);
  const { data: weeklyBriefs = [], isLoading: briefsLoading } = useWeeklyBriefs(orgId);

  const agingData = reportsData?.agingBuckets ?? [
    { bucket: 'Current', key: 'current', color: 'bg-success', amount: 0, count: 0 },
    { bucket: '1–30 days', key: '1_30', color: 'bg-warning', amount: 0, count: 0 },
    { bucket: '31–60 days', key: '31_60', color: 'bg-destructive/70', amount: 0, count: 0 },
    { bucket: '61–90 days', key: '61_90', color: 'bg-destructive', amount: 0, count: 0 },
    { bucket: '90+ days', key: '90_plus', color: 'bg-destructive', amount: 0, count: 0 },
  ];
  const maxAmount = Math.max(...agingData.map(d => d.amount), 1);
  const totalOutstanding = reportsData?.totalOutstanding ?? 0;
  const overdueTotal = reportsData?.overdueTotal ?? 0;
  const dueSoonTotal = reportsData?.dueSoonTotal ?? 0;
  const recoveredThisMonth = reportsData?.recoveredThisMonth ?? 0;

  const latestBrief = weeklyBriefs[0];

  const handleDownloadOverdue = () => {
    let csv = 'Invoice,Client,Amount,Days Overdue,Priority\n';
    (reportsData?.overdueInvoices ?? []).forEach(inv => {
      csv += `${(inv as any).invoice_number || ''},${(inv as any).client_id || ''},${inv.remaining_balance},${inv.days_overdue ?? 0},${inv.collection_priority ?? ''}\n`;
    });
    downloadCsv('Overdue Summary', csv);
  };

  const handleDownloadDueSoon = () => {
    let csv = 'Invoice,Client,Amount,Due Date\n';
    (reportsData?.dueSoonInvoices ?? []).forEach(inv => {
      csv += `${(inv as any).invoice_number || ''},${(inv as any).client_id || ''},${inv.remaining_balance},${inv.due_date ?? ''}\n`;
    });
    downloadCsv('Due Soon', csv);
  };

  const handleDownloadPayments = () => {
    let csv = 'Date,Amount,Method,Source\n';
    (reportsData?.payments ?? []).forEach(p => {
      csv += `${p.payment_date},${p.amount},${p.payment_method ?? ''},${p.source ?? ''}\n`;
    });
    downloadCsv('Recovered Amount', csv);
  };

  const reportActions = [
    { name: 'Overdue Summary', onDownload: handleDownloadOverdue },
    { name: 'Due Soon', onDownload: handleDownloadDueSoon },
    { name: 'Recovered Amount', onDownload: handleDownloadPayments },
  ];

  return (
    <div className="px-4 py-6 space-y-4">
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Cash visibility and collection insights</p>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <div className="flex bg-muted rounded-xl p-1">
          {(['overview', 'brief'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >{tab === 'overview' ? 'Cash Overview' : 'Weekly Brief'}</button>
          ))}
        </div>
      </ScrollReveal>

      {activeTab === 'overview' && (
        <>
          <ScrollReveal delay={0.1}>
            <div className="glass-card rounded-xl p-5">
              <p className="text-sm text-muted-foreground">Total outstanding receivables</p>
              <p className="text-3xl font-bold text-tabular mt-1">
                {reportsLoading ? '—' : formatCurrency(totalOutstanding)}
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1 text-destructive">
                  <TrendingUp className="w-4 h-4" />
                  {reportsLoading ? '—' : formatCurrency(overdueTotal)} overdue
                </span>
                <span className="flex items-center gap-1 text-warning">
                  <Calendar className="w-4 h-4" />
                  {reportsLoading ? '—' : formatCurrency(dueSoonTotal)} due soon
                </span>
              </div>
              {!reportsLoading && recoveredThisMonth > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {formatCurrency(recoveredThisMonth)} collected in the last 30 days
                </p>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-semibold text-sm mb-4">Aging breakdown</h2>
              {reportsLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <div className="space-y-3">
                  {agingData.map(d => (
                    <div key={d.bucket}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{d.bucket}</span>
                        <span className="font-medium text-tabular">
                          {formatCurrency(d.amount)}
                          <span className="text-muted-foreground text-xs ml-1">({d.count})</span>
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${d.color} transition-all duration-500`}
                          style={{ width: maxAmount > 0 ? `${(d.amount / maxAmount) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.25}>
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/30"><h3 className="text-sm font-semibold">Available reports</h3></div>
              {reportActions.map(report => (
                <button key={report.name} onClick={report.onDownload}
                  className="w-full flex items-center justify-between px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]">
                  <span>{report.name}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Download className="w-3.5 h-3.5" />
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          </ScrollReveal>
        </>
      )}

      {activeTab === 'brief' && (
        <>
          {briefsLoading ? (
            <ScrollReveal delay={0.1}>
              <div className="glass-card rounded-xl p-8 text-center text-sm text-muted-foreground">Loading weekly brief…</div>
            </ScrollReveal>
          ) : latestBrief ? (
            <>
              <ScrollReveal delay={0.1}>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-accent" />
                    <h2 className="font-semibold text-sm">
                      Week of {new Date(latestBrief.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(latestBrief.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </h2>
                  </div>
                  {latestBrief.narrative_text && (
                    <p className="text-sm leading-relaxed mb-4">{latestBrief.narrative_text}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-success/10 rounded-lg p-3">
                      <p className="text-lg font-bold text-tabular" style={{ color: 'hsl(var(--success))' }}>{formatCurrency(Number(latestBrief.recovered_amount))}</p>
                      <p className="text-xs text-muted-foreground">Recovered</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-lg font-bold text-tabular">{latestBrief.promises_to_pay_count}</p>
                      <p className="text-xs text-muted-foreground">Promises to pay</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-lg font-bold text-tabular">{latestBrief.disputes_count}</p>
                      <p className="text-xs text-muted-foreground">Disputes</p>
                    </div>
                    <div className="bg-destructive/10 rounded-lg p-3">
                      <p className="text-lg font-bold text-tabular text-destructive">{formatCurrency(Number(latestBrief.overdue_total))}</p>
                      <p className="text-xs text-muted-foreground">Total overdue</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              {Array.isArray(latestBrief.recommended_next_steps) && (latestBrief.recommended_next_steps as unknown[]).length > 0 && (
                <ScrollReveal delay={0.15}>
                  <div className="glass-card rounded-xl p-5">
                    <h2 className="font-semibold text-sm mb-3">Recommended next steps</h2>
                    <div className="space-y-3">
                      {(latestBrief.recommended_next_steps as string[]).map((rec, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">{i + 1}</span>
                          </div>
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )}
            </>
          ) : (
            <ScrollReveal delay={0.1}>
              <div className="glass-card rounded-xl p-8 text-center space-y-2">
                <p className="font-medium text-sm">No weekly brief yet</p>
                <p className="text-sm text-muted-foreground">Weekly briefs are generated automatically every Monday. Check back after your first full week.</p>
              </div>
            </ScrollReveal>
          )}
        </>
      )}
    </div>
  );
}

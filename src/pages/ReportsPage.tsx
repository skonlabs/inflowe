import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Download, ChevronRight } from 'lucide-react';
import { formatCurrency, homeSummary, demoInvoices, demoClients } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { toast } from 'sonner';

const agingData = [
  { bucket: 'Current', amount: 79800, count: 4, color: 'bg-success' },
  { bucket: '1–30 days', amount: 15950, count: 3, color: 'bg-warning' },
  { bucket: '31–60 days', amount: 17300, count: 3, color: 'bg-destructive/70' },
  { bucket: '61–90 days', amount: 3200, count: 1, color: 'bg-destructive' },
  { bucket: '90+ days', amount: 0, count: 0, color: 'bg-destructive' },
];

const weeklyBrief = {
  period: 'March 11–17, 2024',
  narrative: 'You recovered $12,000 this week from 3 overdue invoices. 1 new client went overdue. Volta Brand Agency raised a dispute on INV-2024-035 — this needs your attention.',
  recovered: 12000,
  newOverdue: 1,
  messagesSent: 7,
  approvalsCompleted: 4,
  recommendations: [
    'Reach out personally to Volta Brand Agency about the disputed invoice',
    'Consider a payment plan for Fern & Bloom — their invoice is now 39 days overdue',
    'Harbor & Co.\'s $22K invoice is due next week — they usually pay on time',
  ],
};

const reportDefinitions = [
  { name: 'Overdue Summary', generator: () => generateCsv('overdue') },
  { name: 'Due Soon', generator: () => generateCsv('due_soon') },
  { name: 'Collections Actions Taken', generator: () => generateCsv('actions') },
  { name: 'Recovered Amount', generator: () => generateCsv('recovered') },
  { name: 'Client Payment Behavior', generator: () => generateCsv('behavior') },
];

function generateCsv(type: string) {
  let csv = '';
  switch (type) {
    case 'overdue':
      csv = 'Invoice,Client,Amount,Days Overdue,Priority\n';
      demoInvoices.filter(i => i.state === 'overdue').forEach(i => {
        csv += `${i.invoiceNumber},${i.clientName},${i.remainingBalance},${i.daysOverdue},${i.collectionPriority}\n`;
      });
      break;
    case 'due_soon':
      csv = 'Invoice,Client,Amount,Due Date\n';
      demoInvoices.filter(i => i.state === 'due_soon' || i.state === 'due_today').forEach(i => {
        csv += `${i.invoiceNumber},${i.clientName},${i.remainingBalance},${i.dueDate}\n`;
      });
      break;
    case 'actions':
      csv = 'Date,Invoice,Client,Action,Channel\n';
      csv += '2024-03-10,INV-2024-042,Meridian Creative Co.,Reminder sent,Email\n';
      csv += '2024-03-15,INV-2024-045,Meridian Creative Co.,Follow-up sent,Email\n';
      csv += '2024-03-18,INV-2024-051,Northstar Digital,Reminder sent,Email\n';
      csv += '2024-03-08,INV-2024-038,Fern & Bloom Marketing,Firm follow-up sent,Email\n';
      break;
    case 'recovered':
      csv = 'Date,Invoice,Client,Amount,Method\n';
      csv += '2024-03-14,INV-2024-025,Bright Pixel Studios,12000,Bank transfer\n';
      break;
    case 'behavior':
      csv = 'Client,Outstanding,Overdue,Risk Score,Avg Days to Pay,Response Rate\n';
      demoClients.filter(c => c.status === 'active').forEach(c => {
        csv += `${c.displayName},${c.outstandingTotal},${c.overdueTotal},${Math.round(c.riskScore * 100)}%,${Math.round(15 + c.riskScore * 30)}d,${Math.round((1 - c.riskScore) * 100)}%\n`;
      });
      break;
  }
  return csv;
}

function downloadReport(name: string, generator: () => string) {
  const csv = generator();
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
  const maxAmount = Math.max(...agingData.map(d => d.amount));

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
              <p className="text-3xl font-bold text-tabular mt-1">{formatCurrency(homeSummary.totalOutstanding)}</p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1 text-destructive"><TrendingUp className="w-4 h-4" />{formatCurrency(homeSummary.overdueTotal)} overdue</span>
                <span className="flex items-center gap-1 text-warning"><Calendar className="w-4 h-4" />{formatCurrency(homeSummary.dueSoonTotal)} due soon</span>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-semibold text-sm mb-4">Aging breakdown</h2>
              <div className="space-y-3">
                {agingData.map(d => (
                  <div key={d.bucket}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{d.bucket}</span>
                      <span className="font-medium text-tabular">{formatCurrency(d.amount)}<span className="text-muted-foreground text-xs ml-1">({d.count})</span></span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${d.color} transition-all duration-500`} style={{ width: maxAmount > 0 ? `${(d.amount / maxAmount) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-semibold text-sm mb-1">Money coming in</h2>
              <p className="text-xs text-muted-foreground mb-3">Expected over the next 14 days</p>
              <div className="space-y-2">
                {[
                  { label: 'High confidence', amount: 15000, detail: 'Bright Pixel Studios — pays on time', color: 'status-paid' },
                  { label: 'Medium confidence', amount: 22000, detail: 'Harbor & Co. — due next week', color: 'status-due-soon' },
                  { label: 'Low confidence', amount: 8750, detail: 'Volta Brand Agency — dispute pending', color: 'status-overdue' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.color}`}>{item.label}</span>
                      <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                    </div>
                    <span className="font-semibold text-sm text-tabular">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.25}>
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/30"><h3 className="text-sm font-semibold">Available reports</h3></div>
              {reportDefinitions.map(report => (
                <button key={report.name} onClick={() => downloadReport(report.name, report.generator)}
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
          <ScrollReveal delay={0.1}>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Week of {weeklyBrief.period}</h2>
              </div>
              <p className="text-sm leading-relaxed">{weeklyBrief.narrative}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-success/10 rounded-lg p-3">
                  <p className="text-lg font-bold text-tabular" style={{ color: 'hsl(var(--success))' }}>{formatCurrency(weeklyBrief.recovered)}</p>
                  <p className="text-xs text-muted-foreground">Recovered</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-lg font-bold text-tabular">{weeklyBrief.messagesSent}</p>
                  <p className="text-xs text-muted-foreground">Messages sent</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-lg font-bold text-tabular">{weeklyBrief.approvalsCompleted}</p>
                  <p className="text-xs text-muted-foreground">Approvals done</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3">
                  <p className="text-lg font-bold text-tabular text-destructive">{weeklyBrief.newOverdue}</p>
                  <p className="text-xs text-muted-foreground">New overdue</p>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-semibold text-sm mb-3">Recommended next steps</h2>
              <div className="space-y-3">
                {weeklyBrief.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </>
      )}
    </div>
  );
}

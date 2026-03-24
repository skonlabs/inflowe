import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { demoInvoices, formatCurrency, getStateLabel, getStateClass } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { useAppState } from '@/contexts/AppStateContext';
import { useUserOrganization, useInvoiceList } from '@/hooks/use-supabase-data';

const filters = ['All', 'Overdue', 'Due Soon', 'Paid', 'Disputed'];
const stateMap: Record<string, string[]> = {
  All: [], Overdue: ['overdue'], 'Due Soon': ['due_soon', 'due_today'],
  Paid: ['paid'], Disputed: ['disputed'],
};

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { invoiceActions } = useAppState();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbInvoices } = useInvoiceList(orgId);

  const initialFilter = searchParams.get('filter') === 'overdue' ? 'Overdue'
    : searchParams.get('filter') === 'due_soon' ? 'Due Soon' : 'All';
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [search, setSearch] = useState('');

  const isDemo = !!(membership?.organizations as any)?.is_demo;
  const dbMapped = (dbInvoices ?? []).map(inv => ({
      id: inv.invoice_id,
      invoiceNumber: inv.invoice_number ?? '',
      clientName: inv.client_display_name ?? 'Unknown',
      amount: Number(inv.amount ?? 0),
      remainingBalance: Number(inv.remaining_balance ?? 0),
      currency: inv.currency ?? 'USD',
      dueDate: inv.due_date ?? '',
      state: (inv.state ?? 'sent') as string,
      daysOverdue: inv.days_overdue ?? 0,
      agingBucket: inv.aging_bucket ?? 'current',
      collectionPriority: inv.collection_priority ?? 'medium',
      lastActionAt: inv.last_action_taken_at,
      nextActionAt: inv.next_action_planned_at,
      riskScore: Number(inv.risk_score ?? 0),
    }));
  const invoices = (orgId && dbMapped.length > 0) ? dbMapped
    : (!orgId || isDemo) ? demoInvoices : dbMapped;

  const getEffectiveState = (inv: typeof invoices[0]) => {
    const actions = invoiceActions[inv.id] || {};
    if (actions.isPaid) return 'paid';
    if (actions.isDisputed) return 'disputed';
    return inv.state;
  };

  const filtered = invoices.filter(inv => {
    const effectiveState = getEffectiveState(inv);
    const states = stateMap[activeFilter];
    if (states && states.length > 0 && !states.includes(effectiveState)) return false;
    if (search && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) && !inv.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const overdueCount = invoices.filter(i => getEffectiveState(i) === 'overdue').length;

  return (
    <div className="px-4 py-6 space-y-4 max-w-screen-lg mx-auto">
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">{invoices.length} total · {overdueCount} overdue</p>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search invoices or clients..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow" />
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {filters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
              {f}
            </button>
          ))}
        </div>
      </ScrollReveal>

      <StaggerContainer className="space-y-2">
        {filtered.map(inv => {
          const effectiveState = getEffectiveState(inv);
          const actions = invoiceActions[inv.id] || {};
          return (
            <StaggerItem key={inv.id}>
              <button onClick={() => navigate(`/invoices/${inv.id}`)}
                className="glass-card-hover rounded-2xl p-4 w-full text-left active:scale-[0.97] transition-transform">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{inv.clientName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold text-sm text-tabular">{formatCurrency(actions.isPaid ? 0 : inv.remainingBalance)}</p>
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mt-1 ${getStateClass(effectiveState)}`}>
                      {getStateLabel(effectiveState)}
                      {inv.daysOverdue > 0 && effectiveState === 'overdue' && ` · ${inv.daysOverdue}d`}
                    </span>
                  </div>
                </div>
                {inv.nextActionAt && effectiveState !== 'paid' && (
                  <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                    Next action: {new Date(inv.nextActionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </button>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {filtered.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <p className="font-medium text-sm">No invoices match your filters</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}

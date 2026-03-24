import { useNavigate } from 'react-router-dom';
import { CreditCard, ChevronRight, Search } from 'lucide-react';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { useUserOrganization, usePaymentPlans } from '@/hooks/use-supabase-data';
import { formatCurrency } from '@/lib/demo-data';
import { useMemo, useState } from 'react';

const statusStyles: Record<string, string> = {
  active: 'status-due-soon',
  completed: 'status-paid',
  cancelled: 'status-overdue',
  defaulted: 'status-overdue',
};

export default function PaymentPlansPage() {
  const navigate = useNavigate();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: plans = [], isLoading } = usePaymentPlans(orgId);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = plans;
    if (statusFilter !== 'all') result = result.filter(p => p.plan_status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        (p.clients?.display_name ?? '').toLowerCase().includes(q) ||
        (p.invoices?.invoice_number ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [plans, statusFilter, search]);

  const filters = ['all', 'active', 'completed', 'cancelled'];

  return (
    <div className="px-4 py-4 space-y-4 max-w-screen-lg mx-auto">
      <ScrollReveal>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Payment Plans</h1>
          <span className="text-sm text-muted-foreground">{plans.length} plans</span>
        </div>
      </ScrollReveal>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search client or invoice…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 ${statusFilter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading plans…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {plans.length === 0 ? 'No payment plans yet. Create one from an invoice detail page.' : 'No plans match your filters.'}
          </p>
        </div>
      ) : (
        <StaggerContainer className="space-y-2">
          {filtered.map(plan => {
            const installments = Array.isArray(plan.installments) ? plan.installments : [];
            const paidCount = installments.filter((i: any) => i.status === 'paid').length;
            const progress = installments.length > 0 ? Math.round((paidCount / installments.length) * 100) : 0;
            return (
              <StaggerItem key={plan.id}>
                <button
                  onClick={() => navigate(`/invoices/${plan.invoice_id}`)}
                  className="glass-card-hover rounded-xl p-4 w-full text-left active:scale-[0.97] transition-transform"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{plan.clients?.display_name ?? 'Client'}</p>
                      <p className="text-xs text-muted-foreground">{plan.invoices?.invoice_number ?? 'Invoice'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[plan.plan_status] ?? 'status-pending'}`}>
                        {plan.plan_status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{formatCurrency(plan.total_amount)} total</span>
                    <span>{paidCount}/{installments.length} paid</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </button>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}
    </div>
  );
}

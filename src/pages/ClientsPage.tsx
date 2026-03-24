import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { demoClients, formatCurrency } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { useUserOrganization, useClientSummaries } from '@/hooks/use-supabase-data';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbClients } = useClientSummaries(orgId);

  const isDemo = !!(membership?.organizations as any)?.is_demo;
  const dbMapped = (dbClients ?? []).map(c => ({
      id: c.client_id,
      displayName: c.display_name ?? 'Unnamed',
      contactName: c.account_owner_name ?? '',
      outstandingTotal: Number(c.outstanding_total ?? 0),
      overdueTotal: Number(c.overdue_total ?? 0),
      riskScore: Number(c.risk_score ?? 0),
      sensitivityLevel: c.sensitivity_level ?? 'standard',
    }));
  const demoMapped = demoClients.filter(c => c.status === 'active').map(c => ({
      id: c.id,
      displayName: c.displayName,
      contactName: c.contactName,
      outstandingTotal: c.outstandingTotal,
      overdueTotal: c.overdueTotal,
      riskScore: c.riskScore,
      sensitivityLevel: c.sensitivityLevel,
    }));
  const clients = (orgId && dbMapped.length > 0) ? dbMapped
    : (!orgId || isDemo) ? demoMapped : dbMapped;

  const filtered = clients.filter(c => {
    if (search && !c.displayName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-4 py-6 space-y-4 max-w-screen-lg mx-auto">
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">{clients.length} active clients</p>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
        </div>
      </ScrollReveal>

      <StaggerContainer className="space-y-2">
        {filtered.map(client => (
          <StaggerItem key={client.id}>
            <button onClick={() => navigate(`/clients/${client.id}`)} className="glass-card-hover rounded-xl p-4 w-full text-left active:scale-[0.97] transition-transform">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-semibold text-sm">{client.displayName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{client.displayName}</p>
                    <p className="text-xs text-muted-foreground">{client.contactName}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-semibold text-sm text-tabular">{formatCurrency(client.outstandingTotal)}</p>
                  {client.overdueTotal > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium mt-0.5">
                      <AlertCircle className="w-3 h-3" />
                      {formatCurrency(client.overdueTotal)} overdue
                    </span>
                  )}
                </div>
              </div>
              {client.riskScore > 0.6 && (
                <div className="mt-2 flex items-center gap-1">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-destructive" style={{ width: `${client.riskScore * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Risk: {Math.round(client.riskScore * 100)}%</span>
                </div>
              )}
            </button>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No clients found</p>
        </div>
      )}
    </div>
  );
}

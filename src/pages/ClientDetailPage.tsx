import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, AlertCircle, Shield, Ban, ChevronRight, Edit3, MessageSquare } from 'lucide-react';
import { demoClients, demoInvoices, formatCurrency, getStateLabel, getStateClass } from '@/lib/demo-data';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';

const sensitivityLabels: Record<string, { label: string; className: string }> = {
  standard: { label: 'Standard', className: 'status-paid' },
  sensitive: { label: 'Sensitive', className: 'status-due-soon' },
  vip: { label: 'VIP', className: 'status-pending' },
  high_value: { label: 'High Value', className: 'status-pending' },
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = demoClients.find(c => c.id === id);
  const clientInvoices = demoInvoices.filter(i => i.clientId === id);

  if (!client) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Client not found</p>
        <button onClick={() => navigate('/clients')} className="text-primary text-sm mt-2">← Back to clients</button>
      </div>
    );
  }

  const sensitivity = sensitivityLabels[client.sensitivityLevel];

  return (
    <div className="px-4 py-4 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Client header */}
      <ScrollReveal>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-lg">{client.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{client.displayName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sensitivity.className}`}>{sensitivity.label}</span>
                <span className="text-xs text-muted-foreground">{client.preferredChannel}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-semibold text-sm text-tabular">{formatCurrency(client.outstandingTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="font-semibold text-sm text-tabular text-destructive">{formatCurrency(client.overdueTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoices</p>
              <p className="font-semibold text-sm text-tabular">{client.invoiceCount}</p>
            </div>
          </div>

          {/* Risk */}
          {client.riskScore > 0.3 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Risk assessment</p>
                <span className="text-xs font-medium">{Math.round(client.riskScore * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${client.riskScore > 0.7 ? 'bg-destructive' : client.riskScore > 0.4 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${client.riskScore * 100}%` }} />
              </div>
              {client.riskScore > 0.6 && (
                <p className="text-xs text-muted-foreground mt-2">This client has a pattern of late payments and low response rates to reminders.</p>
              )}
            </div>
          )}
        </div>
      </ScrollReveal>

      {/* Primary contact */}
      <ScrollReveal delay={0.1}>
        <div className="glass-card rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-3">Primary contact</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium">{client.contactName.split(' ').map(w => w[0]).join('')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{client.contactName}</p>
              <p className="text-xs text-muted-foreground truncate">{client.contactEmail}</p>
            </div>
            <button className="p-2 rounded-full hover:bg-muted transition-colors active:scale-95">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </ScrollReveal>

      {/* Quick actions */}
      <ScrollReveal delay={0.15}>
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform">
            <Ban className="w-4 h-4" /> Pause automation
          </button>
          <button className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-medium text-sm active:scale-95 transition-transform">
            <Edit3 className="w-4 h-4" /> Edit client
          </button>
        </div>
      </ScrollReveal>

      {/* Client invoices */}
      <ScrollReveal delay={0.2}>
        <div className="space-y-2">
          <h2 className="font-semibold text-base">Invoices</h2>
          {clientInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices for this client.</p>
          ) : (
            <StaggerContainer className="space-y-2">
              {clientInvoices.map(inv => (
                <StaggerItem key={inv.id}>
                  <button onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="glass-card-hover rounded-xl p-4 w-full text-left active:scale-[0.97] transition-transform">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-tabular">{formatCurrency(inv.remainingBalance)}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStateClass(inv.state)}`}>
                          {getStateLabel(inv.state)}
                        </span>
                      </div>
                    </div>
                  </button>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>
      </ScrollReveal>

      {/* Activity */}
      <ScrollReveal delay={0.25}>
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Recent activity</h2>
          {[
            { text: 'Dispute raised on INV-2024-035', time: '5 days ago', icon: AlertCircle },
            { text: 'Reminder sent for INV-2024-048', time: '2 weeks ago', icon: Mail },
            { text: 'Invoice INV-2024-048 became overdue', time: '29 days ago', icon: AlertCircle },
          ].map((event, i) => {
            const Icon = event.icon;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  {i < 2 && <div className="w-px h-full bg-border min-h-[16px]" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm">{event.text}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </div>
  );
}

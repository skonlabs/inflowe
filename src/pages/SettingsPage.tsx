import { Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollReveal } from '@/components/ScrollReveal';

export default function SettingsPage() {
  const navigate = useNavigate();

  const sections = [
    { label: 'Organization', items: ['Business name', 'Timezone', 'Currency', 'Business hours'] },
    { label: 'Sender Identity', items: ['Sender email', 'Display name', 'Brand tone'] },
    { label: 'Integrations', items: ['Email (not connected)', 'Accounting (not connected)', 'Stripe (not connected)'] },
    { label: 'Team', items: ['Invite members', 'Manage roles'] },
    { label: 'Automation', items: ['Trust mode: Approval Required', 'Emergency stop'] },
  ];

  return (
    <div className="px-4 py-6 space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Settings</h1>
      </ScrollReveal>
      {sections.map((section, i) => (
        <ScrollReveal key={section.label} delay={i * 0.05}>
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/30">
              <h3 className="text-sm font-semibold">{section.label}</h3>
            </div>
            {section.items.map((item, j) => (
              <button key={j} className="w-full text-left px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]">
                {item}
              </button>
            ))}
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}

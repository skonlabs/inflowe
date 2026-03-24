import { ReactNode, forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, Users, CheckCircle, Bell, Settings, MessageSquare, BarChart3, HelpCircle, MoreHorizontal, LogOut, Upload, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '@/contexts/AppStateContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization, useApprovals } from '@/hooks/use-supabase-data';

interface AppShellProps {
  children: ReactNode;
}

const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell({ children }, ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, markNotificationRead } = useAppState();
  const { user, signOut } = useAuth();
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;
  const { data: dbApprovals } = useApprovals(orgId);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const pendingApprovals = dbApprovals?.length ?? 0;
  const isDemo = membership?.organizations ? (membership.organizations as any).is_demo : true;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/approvals', icon: CheckCircle, label: 'Approvals', badge: pendingApprovals > 0 ? pendingApprovals : undefined },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/more', icon: MoreHorizontal, label: 'More' },
  ];

  const moreItems = [
    { path: '/import', icon: Upload, label: 'Import Data' },
    { path: '/payment-plans', icon: CreditCard, label: 'Payment Plans' },
    { path: '/conversations', icon: MessageSquare, label: 'Conversations' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/support', icon: HelpCircle, label: 'Support' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isMoreActive = moreItems.some(item => location.pathname.startsWith(item.path));

  return (
    <div ref={ref} className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/60">
        <div className="flex items-center justify-between px-4 h-14 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs tracking-wider">X</span>
            </div>
            <span className="font-semibold text-base tracking-tight">Cash Ops</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full hover:bg-muted transition-colors active:scale-95"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={signOut}
              className="p-2 rounded-full hover:bg-muted transition-colors active:scale-95"
              title="Sign out"
            >
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </button>
            {user && (
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-semibold text-accent">
                {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notification dropdown */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/10" onClick={() => setShowNotifications(false)} />
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="fixed top-14 right-2 left-2 sm:left-auto sm:w-96 z-50 bg-card rounded-2xl border border-border shadow-xl max-h-[70vh] overflow-y-auto"
            >
              <div className="p-4 border-b border-border"><h3 className="font-semibold">Notifications</h3></div>
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.map(n => (
                  <button key={n.id}
                    className={`w-full text-left p-4 border-b border-border/40 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-accent/5' : ''}`}
                    onClick={() => { markNotificationRead(n.id); setShowNotifications(false); if (n.actionUrl) navigate(n.actionUrl); }}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.createdAt}</p>
                  </button>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* More menu */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 left-2 right-2 z-50 bg-card rounded-2xl border border-border shadow-xl"
              style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {moreItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <button key={item.path}
                    onClick={() => { setShowMore(false); navigate(item.path); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/40 last:border-0 transition-colors active:scale-[0.98] ${isActive ? 'text-accent' : 'text-foreground hover:bg-muted/50'}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Demo banner */}
      {isDemo && (
        <div className="bg-accent/10 border-b border-accent/20 px-4 py-2">
          <p className="text-xs text-center text-accent font-medium">
            🎯 Demo Mode — Explore with sample data. No real messages will be sent.
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="pb-safe max-w-screen-xl mx-auto">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/60" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto">
          {navItems.map(item => {
            const isActive = item.path === '/more'
              ? isMoreActive
              : item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => {
                  if (item.path === '/more') {
                    setShowMore(!showMore);
                  } else {
                    setShowMore(false);
                    navigate(item.path);
                  }
                }}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all active:scale-95 relative ${
                  isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <div className="absolute -top-1 w-5 h-0.5 rounded-full bg-accent" />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{item.badge}</span>
                  )}
                </div>
                <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
});

export default AppShell;

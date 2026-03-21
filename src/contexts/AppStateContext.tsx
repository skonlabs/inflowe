import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { demoNotifications, Notification } from '@/lib/demo-data';
import {
  useUserOrganization,
  useOrgSettings,
  useNotifications,
  useToggleAutomationPause,
} from '@/hooks/use-supabase-data';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceAction {
  isPaid?: boolean;
  isPaused?: boolean;
  isDisputed?: boolean;
}

interface ClientAction {
  isPaused?: boolean;
  editedFields?: Record<string, string>;
}

interface AppState {
  invoiceActions: Record<string, InvoiceAction>;
  clientActions: Record<string, ClientAction>;
  notifications: Notification[];
  emergencyStop: boolean;
  setInvoiceAction: (invoiceId: string, action: Partial<InvoiceAction>) => void;
  setClientAction: (clientId: string, action: Partial<ClientAction>) => void;
  markNotificationRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  setEmergencyStop: (active: boolean) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [invoiceActions, setInvoiceActions] = useState<Record<string, InvoiceAction>>({});
  const [clientActions, setClientActions] = useState<Record<string, ClientAction>>({});

  // Load org context
  const { data: membership } = useUserOrganization();
  const orgId = membership?.organization_id;

  // Load emergency stop state from DB settings
  const { data: orgSettings } = useOrgSettings(orgId);
  const emergencyStop = (orgSettings?.['automation_paused'] as boolean | undefined) === true;

  // Load notifications from DB
  const { data: dbNotifications } = useNotifications();

  const togglePause = useToggleAutomationPause();

  // Adapt DB notifications to local Notification shape; fallback to demo if no org yet
  const notifications: Notification[] = orgId
    ? (dbNotifications ?? []).map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.notification_class,
        read: n.read_at != null,
        createdAt: (() => {
          const d = new Date(n.created_at);
          const diff = Date.now() - d.getTime();
          if (diff < 3600000) return `${Math.round(diff / 60000)} min ago`;
          if (diff < 86400000) return `${Math.round(diff / 3600000)} hours ago`;
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        })(),
        actionUrl: (n as any).action_url ?? undefined,
      }))
    : demoNotifications;

  const setEmergencyStop = useCallback((active: boolean) => {
    if (!orgId) return;
    togglePause.mutate({ orgId, paused: active });
  }, [orgId, togglePause]);

  const setInvoiceAction = useCallback((invoiceId: string, action: Partial<InvoiceAction>) => {
    setInvoiceActions(prev => ({
      ...prev,
      [invoiceId]: { ...prev[invoiceId], ...action },
    }));
  }, []);

  const setClientAction = useCallback((clientId: string, action: Partial<ClientAction>) => {
    setClientActions(prev => ({
      ...prev,
      [clientId]: { ...prev[clientId], ...action },
    }));
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  const dismissNotification = useCallback(async (id: string) => {
    await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  return (
    <AppStateContext.Provider value={{
      invoiceActions, clientActions, notifications, emergencyStop,
      setInvoiceAction, setClientAction, markNotificationRead, dismissNotification,
      setEmergencyStop,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

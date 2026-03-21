import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { demoNotifications, Notification } from '@/lib/demo-data';

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
  const [invoiceActions, setInvoiceActions] = useState<Record<string, InvoiceAction>>({});
  const [clientActions, setClientActions] = useState<Record<string, ClientAction>>({});
  const [notifications, setNotifications] = useState<Notification[]>(demoNotifications);
  const [emergencyStop, setEmergencyStopState] = useState(false);

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

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <AppStateContext.Provider value={{
      invoiceActions, clientActions, notifications, emergencyStop,
      setInvoiceAction, setClientAction, markNotificationRead, dismissNotification,
      setEmergencyStop: setEmergencyStopState,
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

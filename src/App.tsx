import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppStateProvider } from "@/contexts/AppStateContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import HomePage from "@/pages/HomePage";
import InvoicesPage from "@/pages/InvoicesPage";
import InvoiceDetailPage from "@/pages/InvoiceDetailPage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import ConversationsPage from "@/pages/ConversationsPage";
import ConversationDetailPage from "@/pages/ConversationDetailPage";
import ReportsPage from "@/pages/ReportsPage";
import SupportPage from "@/pages/SupportPage";
import AdminPage from "@/pages/AdminPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SettingsPage from "@/pages/SettingsPage";
import ImportPage from "@/pages/ImportPage";
import PaymentPlansPage from "@/pages/PaymentPlansPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const ProtectedShell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppStateProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedShell><HomePage /></ProtectedShell>} />
              <Route path="/invoices" element={<ProtectedShell><InvoicesPage /></ProtectedShell>} />
              <Route path="/invoices/:id" element={<ProtectedShell><InvoiceDetailPage /></ProtectedShell>} />
              <Route path="/clients" element={<ProtectedShell><ClientsPage /></ProtectedShell>} />
              <Route path="/clients/:id" element={<ProtectedShell><ClientDetailPage /></ProtectedShell>} />
              <Route path="/approvals" element={<ProtectedShell><ApprovalsPage /></ProtectedShell>} />
              <Route path="/conversations" element={<ProtectedShell><ConversationsPage /></ProtectedShell>} />
              <Route path="/conversations/:id" element={<ProtectedShell><ConversationDetailPage /></ProtectedShell>} />
              <Route path="/reports" element={<ProtectedShell><ReportsPage /></ProtectedShell>} />
              <Route path="/support" element={<ProtectedShell><SupportPage /></ProtectedShell>} />
              <Route path="/admin" element={<ProtectedShell><AdminPage /></ProtectedShell>} />
              <Route path="/settings" element={<ProtectedShell><SettingsPage /></ProtectedShell>} />
              <Route path="/import" element={<ProtectedShell><ImportPage /></ProtectedShell>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppStateProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

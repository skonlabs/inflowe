import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import HomePage from "@/pages/HomePage";
import InvoicesPage from "@/pages/InvoicesPage";
import InvoiceDetailPage from "@/pages/InvoiceDetailPage";
import ClientsPage from "@/pages/ClientsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/" element={<AppShell><HomePage /></AppShell>} />
          <Route path="/invoices" element={<AppShell><InvoicesPage /></AppShell>} />
          <Route path="/invoices/:id" element={<AppShell><InvoiceDetailPage /></AppShell>} />
          <Route path="/clients" element={<AppShell><ClientsPage /></AppShell>} />
          <Route path="/approvals" element={<AppShell><ApprovalsPage /></AppShell>} />
          <Route path="/settings" element={<AppShell><SettingsPage /></AppShell>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

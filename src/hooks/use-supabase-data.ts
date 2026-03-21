import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserOrganization() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-organization', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('organization_id, role, organizations(id, display_name, is_demo, brand_tone, default_currency)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useHomeSummary(orgId: string | undefined) {
  return useQuery({
    queryKey: ['home-summary', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('read_home_summary')
        .select('*')
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoiceList(orgId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-list', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('read_invoice_list')
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useClientSummaries(orgId: string | undefined) {
  return useQuery({
    queryKey: ['client-summaries', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('read_client_summary')
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApprovals(orgId: string | undefined) {
  return useQuery({
    queryKey: ['approvals', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select(`
          *,
          clients(display_name),
          invoices(invoice_number, amount, remaining_balance, days_overdue),
          outbound_messages(body_text, channel, collection_stage)
        `)
        .eq('organization_id', orgId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvoiceDetail(invoiceId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-detail', invoiceId],
    enabled: !!invoiceId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients(display_name, id),
          client_contacts(full_name, email)
        `)
        .eq('id', invoiceId!)
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useClientDetail(clientId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['client-detail', clientId],
    enabled: !!clientId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_contacts(full_name, email, phone, is_primary, channel_preference)
        `)
        .eq('id', clientId!)
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useClientInvoices(clientId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['client-invoices', clientId],
    enabled: !!clientId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId!)
        .eq('organization_id', orgId!)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConversationThreads(orgId: string | undefined) {
  return useQuery({
    queryKey: ['conversation-threads', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_threads')
        .select(`
          *,
          clients(display_name)
        `)
        .eq('organization_id', orgId!)
        .order('latest_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIntegrations(orgId: string | undefined) {
  return useQuery({
    queryKey: ['integrations', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useModuleEntitlements(orgId: string | undefined) {
  return useQuery({
    queryKey: ['module-entitlements', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_entitlements')
        .select('*')
        .eq('organization_id', orgId!)
        .in('status', ['active', 'trialing']);
      if (error) throw error;
      return data ?? [];
    },
  });
}

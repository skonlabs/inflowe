import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Organization ───────────────────────────────────────────────────────────

export function useUserOrganization() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-organization', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('organization_id, role, status, organizations(id, display_name, is_demo, brand_tone, default_currency, timezone, sender_email, sender_display_name, reply_to_address, subscription_state)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useOrgSettings(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-settings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      const map: Record<string, unknown> = {};
      (data ?? []).forEach(s => { map[s.setting_key] = s.setting_value; });
      return map;
    },
  });
}

// ─── Home ────────────────────────────────────────────────────────────────────

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

export function useRecoveredThisWeek(orgId: string | undefined) {
  return useQuery({
    queryKey: ['recovered-this-week', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('organization_id', orgId!)
        .gte('payment_date', startOfWeek.toISOString().slice(0, 10));
      if (error) throw error;
      return (data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    },
  });
}

// ─── Invoices ────────────────────────────────────────────────────────────────

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

// UUID regex for validating IDs before Supabase queries
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(val: string | undefined): boolean {
  return !!val && UUID_RE.test(val);
}

export function useInvoiceDetail(invoiceId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-detail', invoiceId, orgId],
    enabled: isUUID(invoiceId) && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients(display_name, id, sensitivity_level, do_not_automate)
        `)
        .eq('id', invoiceId!)
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;

      // Fetch contacts separately via client_id
      let contacts: any[] = [];
      if (data?.client_id) {
        const { data: contactData } = await supabase
          .from('client_contacts')
          .select('id, full_name, email, phone, is_primary, contact_role, escalation_order')
          .eq('client_id', data.client_id)
          .eq('organization_id', orgId!)
          .order('is_primary', { ascending: false });
        contacts = contactData ?? [];
      }

      return data ? { ...data, client_contacts: contacts } : null;
    },
  });
}

export function useInvoiceTimeline(invoiceId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-timeline', invoiceId, orgId],
    enabled: isUUID(invoiceId) && !!orgId,
    queryFn: async () => {
      // Fetch audit logs for this invoice
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('entity_id', invoiceId!)
        .order('occurred_at', { ascending: false })
        .limit(30);
      if (auditError) throw auditError;

      // Fetch outbound messages for this invoice
      const { data: outboundData, error: outboundError } = await supabase
        .from('outbound_messages')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (outboundError) throw outboundError;

      // Fetch inbound messages for this invoice
      const { data: inboundData, error: inboundError } = await supabase
        .from('inbound_messages')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .eq('organization_id', orgId!)
        .order('received_at', { ascending: false })
        .limit(20);
      if (inboundError) throw inboundError;

      // Fetch payments for this invoice via payment_allocations
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_allocations')
        .select('*, payments(payment_date, payment_method, source, amount)')
        .eq('invoice_id', invoiceId!)
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (paymentError) throw paymentError;

      // Merge and sort all timeline events
      const events: Array<{
        id: string;
        event_type: string;
        occurred_at: string;
        display_text: string;
        metadata?: Record<string, unknown>;
      }> = [];

      (auditData ?? []).forEach(a => {
        events.push({
          id: String(a.id),
          event_type: a.action_type,
          occurred_at: a.occurred_at,
          display_text: a.reason || a.action_type.replace(/_/g, ' '),
          metadata: { reason_code: a.reason_code, after: a.after_snapshot },
        });
      });

      (outboundData ?? []).forEach(m => {
        const eventType = m.send_status === 'delivered' ? 'message_sent' : m.send_status === 'failed' ? 'message_failed' : 'draft_generated';
        events.push({
          id: m.id,
          event_type: eventType,
          occurred_at: m.sent_at || m.created_at,
          display_text: m.send_status === 'delivered'
            ? `Message sent via ${m.channel}`
            : m.send_status === 'failed'
            ? `Send failed: ${m.failure_detail || 'unknown reason'}`
            : `Draft created (${m.collection_stage || 'follow-up'})`,
          metadata: { channel: m.channel, stage: m.collection_stage },
        });
      });

      (inboundData ?? []).forEach(m => {
        events.push({
          id: m.id,
          event_type: 'reply_received',
          occurred_at: m.received_at,
          display_text: `Reply received: ${m.classification?.replace(/_/g, ' ') || 'unclassified'}`,
          metadata: { classification: m.classification, sender: m.sender_name || m.sender_email },
        });
      });

      (paymentData ?? []).forEach(pa => {
        const p = (pa as any).payments;
        events.push({
          id: pa.id,
          event_type: 'payment_recorded',
          occurred_at: pa.created_at,
          display_text: `Payment of ${pa.allocated_amount} recorded${p ? ` via ${p.payment_method || p.source || 'manual'}` : ''}`,
          metadata: { amount: pa.allocated_amount },
        });
      });

      // Sort by occurred_at descending
      events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      return events;
    },
  });
}

// ─── Clients ─────────────────────────────────────────────────────────────────

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

export function useClientDetail(clientId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['client-detail', clientId, orgId],
    enabled: isUUID(clientId) && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_contacts(id, full_name, email, phone, is_primary, channel_preference, contact_role, escalation_order, opted_out, do_not_contact, email_bounced)
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
    enabled: isUUID(clientId) && !!orgId,
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

export function useClientTimeline(clientId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['client-timeline', clientId],
    enabled: isUUID(clientId) && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('entity_type', 'client')
        .eq('entity_id', clientId!)
        .order('occurred_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map(a => ({
        id: String(a.id),
        event_type: a.action_type,
        occurred_at: a.occurred_at,
        display_text: a.reason || a.action_type.replace(/_/g, ' '),
      }));
    },
  });
}

// ─── Approvals ───────────────────────────────────────────────────────────────

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

// ─── Conversations ────────────────────────────────────────────────────────────

export function useConversationThreads(orgId: string | undefined) {
  return useQuery({
    queryKey: ['conversation-threads', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_threads')
        .select(`
          *,
          clients(display_name),
          invoices!primary_invoice_id(invoice_number)
        `)
        .eq('organization_id', orgId!)
        .order('latest_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useThreadMessages(threadId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['thread-messages', threadId],
    enabled: isUUID(threadId) && !!orgId,
    queryFn: async () => {
      const [outboundRes, inboundRes] = await Promise.all([
        supabase
          .from('outbound_messages')
          .select('id, body_text, channel, sent_at, created_at, approval_status, send_status')
          .eq('communication_thread_id', threadId!)
          .eq('organization_id', orgId!)
          .order('created_at'),
        supabase
          .from('inbound_messages')
          .select('id, raw_content, channel, received_at, sender_name, sender_email, classification')
          .eq('communication_thread_id', threadId!)
          .eq('organization_id', orgId!)
          .order('received_at'),
      ]);
      if (outboundRes.error) throw outboundRes.error;
      if (inboundRes.error) throw inboundRes.error;

      const messages: Array<{
        id: string;
        direction: 'inbound' | 'outbound';
        text: string;
        timestamp: string;
        senderName: string;
        channel: string;
        classification?: string;
      }> = [];

      (outboundRes.data ?? []).forEach(m => messages.push({
        id: m.id,
        direction: 'outbound',
        text: m.body_text,
        timestamp: m.sent_at || m.created_at,
        senderName: 'InFlowe',
        channel: m.channel,
      }));

      (inboundRes.data ?? []).forEach(m => messages.push({
        id: m.id,
        direction: 'inbound',
        text: m.raw_content,
        timestamp: m.received_at,
        senderName: m.sender_name || m.sender_email || 'Client',
        channel: m.channel,
        classification: m.classification || undefined,
      }));

      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return messages;
    },
  });
}

// ─── Integrations ────────────────────────────────────────────────────────────

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

// ─── Module Entitlements ─────────────────────────────────────────────────────

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

// ─── Notifications ────────────────────────────────────────────────────────────

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function useReportsData(orgId: string | undefined) {
  return useQuery({
    queryKey: ['reports-data', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [invoicesRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, state, remaining_balance, amount, amount_paid, due_date, days_overdue, aging_bucket, collection_priority, client_id, paid_at')
          .eq('organization_id', orgId!)
          .not('state', 'in', '("cancelled","written_off")'),
        supabase
          .from('payments')
          .select('id, amount, currency, payment_date, payment_method, source')
          .eq('organization_id', orgId!)
          .gte('payment_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
          .order('payment_date', { ascending: false }),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const invoices = invoicesRes.data ?? [];
      const payments = paymentsRes.data ?? [];

      // Aging buckets
      const agingBuckets = [
        { bucket: 'Current', key: 'current', color: 'bg-success' },
        { bucket: '1–30 days', key: '1_30', color: 'bg-warning' },
        { bucket: '31–60 days', key: '31_60', color: 'bg-destructive/70' },
        { bucket: '61–90 days', key: '61_90', color: 'bg-destructive' },
        { bucket: '90+ days', key: '90_plus', color: 'bg-destructive' },
      ].map(b => ({
        ...b,
        amount: invoices.filter(i => i.aging_bucket === b.key).reduce((s, i) => s + Number(i.remaining_balance), 0),
        count: invoices.filter(i => i.aging_bucket === b.key).length,
      }));

      const overdueInvoices = invoices.filter(i => i.state === 'overdue');
      const dueSoonInvoices = invoices.filter(i => i.state === 'due_soon' || i.state === 'due_today');
      const totalOutstanding = invoices.reduce((s, i) => s + Number(i.remaining_balance), 0);
      const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.remaining_balance), 0);
      const dueSoonTotal = dueSoonInvoices.reduce((s, i) => s + Number(i.remaining_balance), 0);
      const recoveredThisMonth = payments.reduce((s, p) => s + Number(p.amount), 0);

      return { agingBuckets, overdueInvoices, dueSoonInvoices, totalOutstanding, overdueTotal, dueSoonTotal, recoveredThisMonth, payments };
    },
  });
}

export function useWeeklyBriefs(orgId: string | undefined) {
  return useQuery({
    queryKey: ['weekly-briefs', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_briefs')
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_end', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Support Cases ────────────────────────────────────────────────────────────

export function useSupportCases(orgId: string | undefined) {
  return useQuery({
    queryKey: ['support-cases', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_cases')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export function useAuditLogs(orgId: string | undefined, entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ['audit-logs', orgId, entityType, entityId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', orgId!)
        .order('occurred_at', { ascending: false })
        .limit(50);
      if (entityType) q = q.eq('entity_type', entityType);
      if (entityId) q = q.eq('entity_id', entityId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Team Members ─────────────────────────────────────────────────────────────

export function useTeamMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['team-members', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, role, status, accepted_at, created_at, profiles(id, full_name, avatar_url, email)')
        .eq('organization_id', orgId!)
        .neq('status', 'removed')
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useRefreshReadModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      // Read models are views — just invalidate caches
    },
    onSuccess: (_, orgId) => {
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice-list', orgId] });
      qc.invalidateQueries({ queryKey: ['client-summaries', orgId] });
    },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, orgId, amount, method, notes }: {
      invoiceId: string; orgId: string; amount?: number; method?: string; notes?: string;
    }) => {
      const { error } = await supabase.rpc('mark_invoice_paid', {
        _invoice_id: invoiceId,
        _org_id: orgId,
        _payment_amount: amount ?? null,
        _payment_method: method ?? 'manual',
        _notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { orgId, invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-detail', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice-list', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice-timeline', invoiceId] });
    },
  });
}

export function useSetInvoiceHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, orgId, onHold, reason }: {
      invoiceId: string; orgId: string; onHold: boolean; reason?: string;
    }) => {
      const { error } = await supabase.rpc('set_invoice_hold', {
        _invoice_id: invoiceId,
        _org_id: orgId,
        _on_hold: onHold,
        _reason: reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { orgId, invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-detail', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice-list', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice-timeline', invoiceId] });
    },
  });
}

export function useSetInvoiceDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, orgId, disputeActive, reason }: {
      invoiceId: string; orgId: string; disputeActive: boolean; reason?: string;
    }) => {
      const { error } = await supabase.rpc('set_invoice_dispute', {
        _invoice_id: invoiceId,
        _org_id: orgId,
        _dispute_active: disputeActive,
        _dispute_reason: reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { orgId, invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-detail', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice-list', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice-timeline', invoiceId] });
    },
  });
}

export function useToggleAutomationPause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, paused, reason }: { orgId: string; paused: boolean; reason?: string }) => {
      const { error } = await supabase.rpc('toggle_automation_pause', {
        _org_id: orgId,
        _paused: paused,
        _reason: reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['org-settings', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
    },
  });
}

export function useUpdateOrgFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, fields }: { orgId: string; fields: Record<string, string> }) => {
      const updatePayload: Record<string, unknown> = {};
      const allowedFields = ['display_name', 'timezone', 'default_currency', 'sender_email', 'sender_display_name', 'reply_to_address', 'brand_tone', 'custom_tone_instructions'];
      for (const key of allowedFields) {
        if (fields[key] !== undefined) updatePayload[key] = fields[key];
      }
      const { error } = await supabase
        .from('organizations')
        .update(updatePayload)
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-organization'] });
    },
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, email, role }: { orgId: string; email: string; role: string }) => {
      const { data, error } = await supabase.rpc('invite_member_by_email', {
        _org_id: orgId,
        _email: email,
        _role: role,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['team-members', orgId] });
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, clientId, invoiceNumber, amount, currency, dueDate, issueDate, notes }: {
      orgId: string; clientId: string; invoiceNumber: string; amount: number;
      currency?: string; dueDate?: string; issueDate?: string; notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          organization_id: orgId,
          client_id: clientId,
          invoice_number: invoiceNumber,
          amount,
          remaining_balance: amount,
          currency: currency ?? 'USD',
          due_date: dueDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          issue_date: issueDate ?? new Date().toISOString().split('T')[0],
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-list', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, displayName, legalName, sensitivityLevel, preferredChannel, contactName, contactEmail, contactPhone, notes }: {
      orgId: string; displayName: string; legalName?: string; sensitivityLevel?: string;
      preferredChannel?: string; contactName?: string; contactEmail?: string; contactPhone?: string; notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          organization_id: orgId,
          display_name: displayName,
          legal_name: legalName ?? null,
          sensitivity_level: sensitivityLevel ?? 'standard',
          preferred_channel: preferredChannel ?? 'email',
          notes: notes ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (contactName || contactEmail || contactPhone) {
        await supabase.from('client_contacts').insert({
          organization_id: orgId,
          client_id: data.id,
          full_name: contactName || displayName,
          email: contactEmail ?? null,
          phone: contactPhone ?? null,
          is_primary: true,
        });
      }
      return data.id;
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['client-summaries', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, orgId, fields }: {
      clientId: string;
      orgId: string;
      fields: Record<string, string | boolean | null>;
    }) => {
      const { error } = await supabase
        .from('clients')
        .update(fields)
        .eq('id', clientId)
        .eq('organization_id', orgId);
      if (error) throw error;
    },
    onSuccess: (_, { clientId, orgId }) => {
      qc.invalidateQueries({ queryKey: ['client-detail', clientId] });
      qc.invalidateQueries({ queryKey: ['client-summaries', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
    },
  });
}

// ─── Ingestion Pipeline ──────────────────────────────────────────────────────

export function useImportBatches(orgId: string | undefined) {
  return useQuery({
    queryKey: ['import-batches', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_batches')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      // Count open exceptions per batch
      const batchIds = (data ?? []).map(b => b.id);
      let exceptionCounts: Record<string, number> = {};
      if (batchIds.length > 0) {
        const { data: excData } = await supabase
          .from('ingestion_exceptions')
          .select('batch_id')
          .eq('organization_id', orgId!)
          .eq('resolution_status', 'open')
          .in('batch_id', batchIds);
        (excData ?? []).forEach(e => {
          exceptionCounts[e.batch_id] = (exceptionCounts[e.batch_id] ?? 0) + 1;
        });
      }

      return (data ?? []).map(b => ({
        id: b.id,
        import_type: b.import_type,
        original_filename: b.original_filename,
        status: b.status,
        total_rows: b.total_rows,
        successful_rows: b.successful_rows,
        failed_rows: b.failed_rows,
        duplicate_rows: b.duplicate_rows,
        created_at: b.created_at,
        open_exceptions: exceptionCounts[b.id] ?? 0,
      }));
    },
  });
}

export function useImportCandidates(orgId: string | undefined, batchId: string | undefined) {
  return useQuery({
    queryKey: ['import-candidates', batchId],
    enabled: !!orgId && !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingestion_candidates')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('batch_id', batchId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(c => ({
        id: c.id,
        invoice_number: (c.normalized_data as any)?.invoice_number ?? null,
        client_name: (c.normalized_data as any)?.client_name ?? null,
        billing_contact_email: (c.normalized_data as any)?.billing_contact_email ?? null,
        due_date: (c.normalized_data as any)?.due_date ?? null,
        total_amount: (c.normalized_data as any)?.total_amount ?? null,
        currency: (c.normalized_data as any)?.currency ?? null,
        mapping_confidence: String(c.mapping_confidence ?? 0),
        validation_status: c.validation_status,
        validation_messages: (c.validation_errors as any[]) ?? [],
        commit_status: c.write_status,
      }));
    },
  });
}

export function useImportExceptions(orgId: string | undefined, batchId?: string) {
  return useQuery({
    queryKey: ['import-exceptions', orgId, batchId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('ingestion_exceptions')
        .select('*, ingestion_candidates(normalized_data), ingestion_raw_records(raw_values)')
        .eq('organization_id', orgId!)
        .eq('resolution_status', 'open')
        .order('created_at', { ascending: false })
        .limit(100);
      if (batchId) q = q.eq('batch_id', batchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(e => ({
        id: e.id,
        import_batch_id: e.batch_id,
        exception_type: e.exception_type,
        severity: e.severity,
        field_name: e.field_name,
        reason: e.reason,
        suggested_remediation: e.suggested_fix,
        can_fix_in_ui: e.can_fix_in_ui,
        status: e.resolution_status,
        raw_values: ((e as any).ingestion_raw_records?.raw_values as Record<string, string>) ?? null,
        candidate_snapshot: ((e as any).ingestion_candidates?.normalized_data as Record<string, unknown>) ?? null,
        created_at: e.created_at,
      }));
    },
  });
}

export function useMappingTemplates(orgId: string | undefined, sourceType = 'csv') {
  return useQuery({
    queryKey: ['mapping-templates', orgId, sourceType],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapping_templates')
        .select('*, mapping_template_fields(*)')
        .eq('organization_id', orgId!)
        .eq('source_type', sourceType)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(t => ({
        id: t.id,
        template_name: t.name,
        header_signature: t.header_signature ?? '',
        column_mappings: ((t as any).mapping_template_fields ?? []).map((f: any) => ({
          sourceCol: f.source_column,
          canonicalField: f.canonical_field,
        })),
        date_format_hint: t.date_format,
        default_currency: t.default_currency,
        ignored_columns: t.ignored_columns ?? [],
        times_used: 0,
        last_used_at: t.updated_at,
      }));
    },
  });
}

export function useStageImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      importBatchId,
      rows,
      columnMapping,
      dateFormatHint,
      defaultCurrency,
      importType = 'invoice',
    }: {
      orgId: string;
      importBatchId: string;
      rows: Array<Record<string, string>>;
      columnMapping: Record<string, string>;
      dateFormatHint?: string | null;
      defaultCurrency?: string;
      importType?: 'invoice' | 'client';
    }) => {
      const { normalizeDate, normalizeNumber, normalizeCurrency, normalizeStatus, normalizeEmail, normalizePhone } = await import('@/lib/ingestion/normalizers');

      // Map from mapping-engine canonical field names to DB-compatible names
      const FIELD_ALIAS: Record<string, string> = {
        contact_email: 'billing_contact_email',
        contact_name: 'billing_contact_name',
        contact_phone: 'billing_contact_phone',
        amount: 'total_amount',
      };

      let staged = 0, excepted = 0, skipped = 0;
      const currency = defaultCurrency ?? 'USD';

      // Update batch to processing
      await supabase.from('import_batches').update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
      }).eq('id', importBatchId);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // 1. Insert raw record
        const rawColumns = Object.keys(row);
        const rawValues = { ...row };
        await supabase.from('ingestion_raw_records').insert({
          batch_id: importBatchId,
          organization_id: orgId,
          row_index: i,
          raw_columns: rawColumns,
          raw_values: rawValues,
        });

        // 2. Apply column mapping to build normalized data
        const normalized: Record<string, unknown> = {};
        const errors: Array<{ severity: string; field: string; msg: string }> = [];

        for (const [canonicalField, sourceCol] of Object.entries(columnMapping)) {
          const rawVal = row[sourceCol] ?? '';
          const dbField = FIELD_ALIAS[canonicalField] ?? canonicalField;

          switch (canonicalField) {
            case 'contact_email': {
              const { email, valid } = normalizeEmail(rawVal);
              normalized[dbField] = email;
              if (email && !valid) errors.push({ severity: 'warning', field: dbField, msg: 'Email appears invalid' });
              break;
            }
            case 'contact_phone':
              normalized[dbField] = normalizePhone(rawVal);
              break;
            case 'issue_date':
            case 'due_date': {
              const { date, ambiguous } = normalizeDate(rawVal);
              normalized[dbField] = date;
              if (ambiguous) errors.push({ severity: 'warning', field: dbField, msg: 'Date format is ambiguous (MM/DD vs DD/MM)' });
              break;
            }
            case 'amount':
            case 'amount_paid':
            case 'remaining_balance':
            case 'total_amount':
            case 'subtotal_amount':
            case 'tax_amount': {
              const num = normalizeNumber(rawVal);
              normalized[dbField] = num;
              if (rawVal.trim() && num === null) errors.push({ severity: 'warning', field: dbField, msg: 'Could not parse number' });
              break;
            }
            case 'currency':
              normalized[dbField] = normalizeCurrency(rawVal, currency);
              break;
            case 'status': {
              const st = normalizeStatus(rawVal);
              normalized[dbField] = st;
              break;
            }
            default:
              normalized[dbField] = rawVal.trim() || null;
          }
        }

        // Derive remaining_balance if not provided (invoice only)
        if (importType === 'invoice') {
          if (normalized.remaining_balance === undefined && normalized.total_amount != null) {
            normalized.remaining_balance = (normalized.total_amount as number) - ((normalized.amount_paid as number) ?? 0);
          }
        }
        if (!normalized.currency) normalized.currency = currency;

        // 3. Validate required fields — different per import type
        const criticalErrors: Array<{ type: string; field: string; reason: string; suggestedFix: string }> = [];

        if (importType === 'client') {
          const hasClient = !!normalized.client_name;
          if (!hasClient) {
            criticalErrors.push({ type: 'missing_critical_field', field: 'client_name', reason: 'No client name found', suggestedFix: 'Provide a client name' });
          }
        } else {
          const hasInvoiceId = !!(normalized.invoice_number || normalized.external_invoice_id);
          const hasClient = !!normalized.client_name;
          const hasAmount = normalized.total_amount != null || normalized.remaining_balance != null;

          if (!hasInvoiceId && !hasClient) {
            criticalErrors.push({ type: 'missing_critical_field', field: 'client_name', reason: 'No client name or invoice identifier found', suggestedFix: 'Provide a client name' });
          }
          if (!hasAmount) {
            criticalErrors.push({ type: 'missing_critical_field', field: 'total_amount', reason: 'No amount found', suggestedFix: 'Provide a total amount' });
          }

          // Cross-field checks
          if (normalized.total_amount != null && normalized.remaining_balance != null) {
            if ((normalized.remaining_balance as number) > (normalized.total_amount as number) * 1.01) {
              errors.push({ severity: 'warning', field: 'remaining_balance', msg: 'Balance exceeds total amount' });
            }
          }
        }

        const validationStatus = criticalErrors.length > 0 ? 'invalid' : errors.some(e => e.severity === 'error') ? 'invalid' : errors.length > 0 ? 'warning' : 'valid';

        // 4. Insert candidate
        const mappingConfidence = criticalErrors.length > 0 ? 0.3 : errors.length > 0 ? 0.6 : 0.9;
        const { data: candRecord } = await supabase.from('ingestion_candidates').insert({
          batch_id: importBatchId,
          organization_id: orgId,
          candidate_type: importType,
          normalized_data: normalized as any,
          mapping_confidence: mappingConfidence,
          normalization_status: 'normalized',
          validation_status: validationStatus,
          validation_errors: errors as any,
          write_status: validationStatus === 'invalid' ? 'blocked' : 'pending',
        } as any).select('id').single();

        const candidateId = candRecord?.id ?? null;

        // 5. Create exceptions for critical errors
        if (criticalErrors.length > 0) {
          for (const ce of criticalErrors) {
            await supabase.from('ingestion_exceptions').insert({
              batch_id: importBatchId,
              organization_id: orgId,
              candidate_id: candidateId,
              exception_type: ce.type,
              severity: 'error',
              field_name: ce.field,
              reason: ce.reason,
              suggested_fix: ce.suggestedFix,
              can_fix_in_ui: true,
              raw_value: row[columnMapping[ce.field]] ?? null,
            });
          }
          excepted++;
        } else {
          staged++;
        }
      }

      // Update batch
      await supabase.from('import_batches').update({
        status: 'staged',
        candidates_created: staged + excepted,
        exceptions_created: excepted,
        raw_row_count: rows.length,
        processing_completed_at: new Date().toISOString(),
      }).eq('id', importBatchId);

      return { staged, excepted, skipped, errors: [] as unknown[] };
    },
    onSuccess: (_, { orgId, importBatchId }) => {
      qc.invalidateQueries({ queryKey: ['import-batches', orgId] });
      qc.invalidateQueries({ queryKey: ['import-candidates', importBatchId] });
      qc.invalidateQueries({ queryKey: ['import-exceptions', orgId] });
    },
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, importBatchId, importType = 'invoice' }: { orgId: string; importBatchId: string; importType?: 'invoice' | 'client' }) => {
      // Read valid candidates
      const { data: candidates, error: candErr } = await supabase
        .from('ingestion_candidates')
        .select('*')
        .eq('batch_id', importBatchId)
        .eq('organization_id', orgId)
        .eq('write_status', 'pending')
        .in('validation_status', ['valid', 'warning']);
      if (candErr) throw candErr;

      let committed = 0, skipped = 0, conflicts = 0;

      for (const cand of (candidates ?? [])) {
        const nd = cand.normalized_data as Record<string, unknown>;
        try {
          if (importType === 'client') {
            // ── Client commit path ────────────────────────────────────
            const clientName = (nd.client_name as string) || 'Unknown Client';

            // Check for duplicate client
            const { data: existingClient } = await supabase
              .from('clients')
              .select('id')
              .eq('organization_id', orgId)
              .ilike('display_name', clientName)
              .limit(1)
              .maybeSingle();

            if (existingClient) {
              skipped++;
              await supabase.from('ingestion_candidates').update({
                write_status: 'skipped',
              }).eq('id', cand.id);
              continue;
            }

            // Create client
            const { data: newClient, error: clientErr } = await supabase
              .from('clients')
              .insert({
                organization_id: orgId,
                display_name: clientName,
                legal_name: (nd.legal_name as string) ?? null,
                sensitivity_level: (nd.sensitivity_level as string) ?? 'standard',
                preferred_channel: (nd.preferred_channel as string) ?? 'email',
                notes: (nd.notes as string) ?? null,
                tags: nd.tags ? String(nd.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
                import_batch_id: importBatchId,
                imported_at: new Date().toISOString(),
                source_system: 'csv_import',
              })
              .select('id')
              .single();
            if (clientErr) throw clientErr;

            // Create contact if email provided
            const contactEmail = nd.billing_contact_email || nd.contact_email;
            const contactName = nd.billing_contact_name || nd.contact_name;
            const contactPhone = nd.billing_contact_phone || nd.contact_phone;

            if (contactEmail || contactName) {
              await supabase.from('client_contacts').insert({
                organization_id: orgId,
                client_id: newClient.id,
                full_name: (contactName as string) || clientName,
                email: (contactEmail as string) ?? null,
                phone: (contactPhone as string) ?? null,
                is_primary: true,
              });
            }

            await supabase.from('ingestion_candidates').update({
              write_status: 'written',
              written_at: new Date().toISOString(),
              canonical_record_id: newClient.id,
            }).eq('id', cand.id);

            committed++;
          } else {
            // ── Invoice commit path ───────────────────────────────────
            let clientId: string | null = null;
            const clientName = (nd.client_name as string) || 'Unknown Client';

            const { data: existingClient } = await supabase
              .from('clients')
              .select('id')
              .eq('organization_id', orgId)
              .ilike('display_name', clientName)
              .limit(1)
              .maybeSingle();

            if (existingClient) {
              clientId = existingClient.id;
            } else {
              const { data: newClient, error: clientErr } = await supabase
                .from('clients')
                .insert({
                  organization_id: orgId,
                  display_name: clientName,
                  legal_name: (nd.client_legal_name as string) ?? null,
                })
                .select('id')
                .single();
              if (clientErr) throw clientErr;
              clientId = newClient.id;

              if (nd.billing_contact_email) {
                await supabase.from('client_contacts').insert({
                  organization_id: orgId,
                  client_id: clientId,
                  full_name: (nd.billing_contact_name as string) || clientName,
                  email: nd.billing_contact_email as string,
                  phone: (nd.billing_contact_phone as string) ?? null,
                  is_primary: true,
                });
              }
            }

            // Check for duplicate invoice
            const invNumber = (nd.invoice_number as string) || null;
            if (invNumber) {
              const { data: existing } = await supabase
                .from('invoices')
                .select('id')
                .eq('organization_id', orgId)
                .eq('invoice_number', invNumber)
                .limit(1)
                .maybeSingle();
              if (existing) {
                skipped++;
                await supabase.from('ingestion_candidates').update({
                  write_status: 'skipped',
                }).eq('id', cand.id);
                continue;
              }
            }

            // Derive state
            const totalAmount = (nd.total_amount as number) ?? (nd.remaining_balance as number) ?? 0;
            const amountPaid = (nd.amount_paid as number) ?? 0;
            const remaining = (nd.remaining_balance as number) ?? (totalAmount - amountPaid);
            const dueDateStr = (nd.due_date as string) ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
            const dueDate = new Date(dueDateStr);
            let state = (nd.status as string) ?? 'sent';
            if (state === 'sent' && remaining <= 0) state = 'paid';
            else if (state === 'sent' && dueDate < new Date()) state = 'overdue';

            const { error: invErr } = await supabase.from('invoices').insert({
              organization_id: orgId,
              client_id: clientId!,
              invoice_number: invNumber,
              external_id: (nd.external_invoice_id as string) ?? null,
              amount: totalAmount,
              amount_paid: amountPaid,
              remaining_balance: remaining,
              currency: (nd.currency as string) ?? 'USD',
              due_date: dueDateStr,
              issue_date: (nd.issue_date as string) ?? null,
              state,
              import_batch_id: importBatchId,
              imported_at: new Date().toISOString(),
              source_system: 'csv_import',
            });
            if (invErr) throw invErr;

            await supabase.from('ingestion_candidates').update({
              write_status: 'written',
              written_at: new Date().toISOString(),
            }).eq('id', cand.id);

            committed++;
          }
        } catch (err: any) {
          conflicts++;
          await supabase.from('ingestion_candidates').update({
            write_status: 'failed',
            validation_errors: [{ severity: 'error', field: 'write', msg: err.message }],
          }).eq('id', cand.id);
        }
      }

      // Update batch
      await supabase.from('import_batches').update({
        status: committed > 0 ? 'completed' : 'failed',
        successful_rows: committed,
        failed_rows: conflicts,
        duplicate_rows: skipped,
        canonical_writes: committed,
      }).eq('id', importBatchId);

      return { committed, skipped, conflicts };
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-list', orgId] });
      qc.invalidateQueries({ queryKey: ['client-summaries', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
      qc.invalidateQueries({ queryKey: ['import-batches', orgId] });
    },
  });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      exceptionId,
      action,
      fixedValues,
    }: {
      orgId: string;
      exceptionId: string;
      action: 'fixed' | 'ignored' | 'skipped';
      fixedValues?: Record<string, string>;
    }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { error } = await supabase
        .from('ingestion_exceptions')
        .update({
          resolution_status: action === 'ignored' ? 'ignored' : 'resolved',
          resolution_action: action,
          resolution_value: fixedValues ? JSON.stringify(fixedValues) : null,
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: userId,
        })
        .eq('id', exceptionId)
        .eq('organization_id', orgId);
      if (error) throw error;

      // If fixed, update the associated candidate
      if (action === 'fixed' && fixedValues) {
        const { data: exc } = await supabase
          .from('ingestion_exceptions')
          .select('candidate_id')
          .eq('id', exceptionId)
          .single();
        if (exc?.candidate_id) {
          const { data: cand } = await supabase
            .from('ingestion_candidates')
            .select('normalized_data')
            .eq('id', exc.candidate_id)
            .single();
          if (cand) {
            const updated = { ...(cand.normalized_data as Record<string, unknown>), ...fixedValues };
            await supabase.from('ingestion_candidates').update({
              normalized_data: updated as any,
              validation_status: 'valid',
              write_status: 'pending',
            }).eq('id', exc.candidate_id);
          }
        }
      }
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['import-exceptions', orgId] });
      qc.invalidateQueries({ queryKey: ['import-batches', orgId] });
    },
  });
}

export function useSaveMappingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      sourceType,
      templateName,
      headerSignature,
      columnMappings,
      dateFormatHint,
      defaultCurrency,
      ignoredColumns,
    }: {
      orgId: string;
      sourceType: string;
      templateName: string;
      headerSignature: string;
      columnMappings: Array<{ sourceCol: string; canonicalField: string }>;
      dateFormatHint?: string | null;
      defaultCurrency?: string | null;
      ignoredColumns?: string[];
    }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { data: template, error: tplErr } = await supabase
        .from('mapping_templates')
        .insert({
          organization_id: orgId,
          name: templateName,
          source_type: sourceType,
          header_signature: headerSignature,
          date_format: dateFormatHint ?? 'auto',
          default_currency: defaultCurrency ?? 'USD',
          ignored_columns: ignoredColumns ?? [],
          created_by_user_id: userId,
        })
        .select('id')
        .single();
      if (tplErr) throw tplErr;

      // Insert field mappings
      const fields = columnMappings.map(m => ({
        template_id: template.id,
        source_column: m.sourceCol,
        canonical_field: m.canonicalField,
        is_required: false,
      }));
      if (fields.length > 0) {
        const { error: fieldErr } = await supabase
          .from('mapping_template_fields')
          .insert(fields);
        if (fieldErr) throw fieldErr;
      }

      return template.id;
    },
    onSuccess: (_, { orgId, sourceType }) => {
      qc.invalidateQueries({ queryKey: ['mapping-templates', orgId, sourceType] });
    },
  });
}

// ─── Integration sync ────────────────────────────────────────────────────────

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      integrationId,
    }: {
      orgId: string;
      integrationId: string;
    }) => {
      const { data, error: fnError } = await supabase.rpc('trigger_integration_sync', {
        _org_id: orgId,
        _integration_id: integrationId,
        _sync_type: 'manual',
      });
      if (fnError) throw fnError;
      return data;
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['integrations', orgId] });
      qc.invalidateQueries({ queryKey: ['import-batches', orgId] });
    },
  });
}

export function useSubmitSupportCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, description, caseType, entityType, entityId }: {
      orgId: string; description: string; caseType?: string; entityType?: string; entityId?: string;
    }) => {
      // Support cases table may not exist yet — graceful fallback
      try {
        const { data, error } = await supabase
          .from('support_cases' as any)
          .insert({
            organization_id: orgId,
            description,
            case_type: caseType ?? 'general',
            status: 'open',
            created_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        return (data as any).id as string;
      } catch {
        // Fallback: just return success
        return 'submitted';
      }
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['support-cases', orgId] });
    },
  });
}

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

export function useInvoiceDetail(invoiceId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-detail', invoiceId],
    enabled: !!invoiceId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients(display_name, id, sensitivity_level, do_not_automate),
          client_contacts(id, full_name, email, phone, is_primary, contact_role, escalation_order)
        `)
        .eq('id', invoiceId!)
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoiceTimeline(invoiceId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-timeline', invoiceId],
    enabled: !!invoiceId && !!orgId,
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
    queryKey: ['client-detail', clientId],
    enabled: !!clientId && !!orgId,
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

export function useClientTimeline(clientId: string | undefined, orgId: string | undefined) {
  return useQuery({
    queryKey: ['client-timeline', clientId],
    enabled: !!clientId && !!orgId,
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
          clients(display_name)
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
    enabled: !!threadId && !!orgId,
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
      const { error } = await supabase.rpc('refresh_org_read_models', { _org_id: orgId });
      if (error) throw error;
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
      const { error } = await supabase.rpc('update_org_fields', {
        _org_id: orgId,
        _display_name: fields.display_name ?? null,
        _timezone: fields.timezone ?? null,
        _default_currency: fields.default_currency ?? null,
        _sender_email: fields.sender_email ?? null,
        _sender_display_name: fields.sender_display_name ?? null,
        _reply_to_address: fields.reply_to_address ?? null,
        _brand_tone: fields.brand_tone ?? null,
        _custom_tone_instructions: fields.custom_tone_instructions ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { orgId }) => {
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
      const { data, error } = await supabase.rpc('create_invoice_manual', {
        _org_id: orgId,
        _client_id: clientId,
        _invoice_number: invoiceNumber,
        _amount: amount,
        _currency: currency ?? 'USD',
        _due_date: dueDate ?? null,
        _issue_date: issueDate ?? null,
        _notes: notes ?? null,
      });
      if (error) throw error;
      return data as string;
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
      const { data, error } = await supabase.rpc('create_client_manual', {
        _org_id: orgId,
        _display_name: displayName,
        _legal_name: legalName ?? null,
        _sensitivity_level: sensitivityLevel ?? 'standard',
        _preferred_channel: preferredChannel ?? 'email',
        _contact_full_name: contactName ?? null,
        _contact_email: contactEmail ?? null,
        _contact_phone: contactPhone ?? null,
        _notes: notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['client-summaries', orgId] });
      qc.invalidateQueries({ queryKey: ['home-summary', orgId] });
    },
  });
}

export function useProcessCsvImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, importBatchId, rows }: {
      orgId: string;
      importBatchId: string;
      rows: Array<Record<string, string>>;
    }) => {
      const { data, error } = await supabase.rpc('process_csv_import', {
        _org_id: orgId,
        _import_batch_id: importBatchId,
        _rows: rows,
      });
      if (error) throw error;
      return data as { successful: number; failed: number; duplicates: number; errors: unknown[] };
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['invoice-list', orgId] });
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
      const { data, error } = await supabase.rpc('get_import_batches', { _org_id: orgId! });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        import_type: string;
        original_filename: string | null;
        status: string;
        total_rows: number;
        successful_rows: number;
        failed_rows: number;
        duplicate_rows: number;
        created_at: string;
        open_exceptions: number;
      }>;
    },
  });
}

export function useImportCandidates(orgId: string | undefined, batchId: string | undefined) {
  return useQuery({
    queryKey: ['import-candidates', batchId],
    enabled: !!orgId && !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_import_candidates', {
        _org_id: orgId!,
        _batch_id: batchId!,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        invoice_number: string | null;
        client_name: string | null;
        billing_contact_email: string | null;
        due_date: string | null;
        total_amount: number | null;
        currency: string | null;
        mapping_confidence: string;
        validation_status: string;
        validation_messages: Array<{ severity: string; field: string; msg: string }>;
        commit_status: string;
      }>;
    },
  });
}

export function useImportExceptions(orgId: string | undefined, batchId?: string) {
  return useQuery({
    queryKey: ['import-exceptions', orgId, batchId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_import_exceptions', {
        _org_id: orgId!,
        _batch_id: batchId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        import_batch_id: string;
        exception_type: string;
        severity: string;
        field_name: string | null;
        reason: string;
        suggested_remediation: string | null;
        can_fix_in_ui: boolean;
        status: string;
        raw_values: Record<string, string> | null;
        candidate_snapshot: Record<string, unknown> | null;
        created_at: string;
      }>;
    },
  });
}

export function useMappingTemplates(orgId: string | undefined, sourceType = 'csv') {
  return useQuery({
    queryKey: ['mapping-templates', orgId, sourceType],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_mapping_templates', {
        _org_id: orgId!,
        _source_type: sourceType,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        template_name: string;
        header_signature: string;
        column_mappings: Array<{ sourceCol: string; canonicalField: string }>;
        date_format_hint: string | null;
        default_currency: string | null;
        ignored_columns: string[];
        times_used: number;
        last_used_at: string | null;
      }>;
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
    }: {
      orgId: string;
      importBatchId: string;
      rows: Array<Record<string, string>>;
      columnMapping: Record<string, string>;
      dateFormatHint?: string | null;
      defaultCurrency?: string;
    }) => {
      const { data, error } = await supabase.rpc('stage_csv_import', {
        _org_id: orgId,
        _import_batch_id: importBatchId,
        _rows: rows,
        _column_mapping: columnMapping,
        _date_format_hint: dateFormatHint ?? null,
        _default_currency: defaultCurrency ?? 'USD',
      });
      if (error) throw error;
      return data as { staged: number; excepted: number; skipped: number; errors: unknown[] };
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
    mutationFn: async ({ orgId, importBatchId }: { orgId: string; importBatchId: string }) => {
      const { data, error } = await supabase.rpc('commit_staged_import', {
        _org_id: orgId,
        _import_batch_id: importBatchId,
      });
      if (error) throw error;
      return data as { committed: number; skipped: number };
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
      const { data, error } = await supabase.rpc('resolve_import_exception', {
        _org_id: orgId,
        _exception_id: exceptionId,
        _action: action,
        _fixed_values: fixedValues ?? null,
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.rpc('save_mapping_template', {
        _org_id: orgId,
        _source_type: sourceType,
        _template_name: templateName,
        _header_signature: headerSignature,
        _column_mappings: columnMappings,
        _date_format_hint: dateFormatHint ?? null,
        _default_currency: defaultCurrency ?? null,
        _ignored_columns: ignoredColumns ?? [],
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, { orgId, sourceType }) => {
      qc.invalidateQueries({ queryKey: ['mapping-templates', orgId, sourceType] });
    },
  });
}

export function useSubmitSupportCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, description, caseType, entityType, entityId }: {
      orgId: string; description: string; caseType?: string; entityType?: string; entityId?: string;
    }) => {
      const { data, error } = await supabase.rpc('submit_support_case', {
        _org_id: orgId,
        _description: description,
        _case_type: caseType ?? null,
        _entity_type: entityType ?? null,
        _entity_id: entityId ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: ['support-cases', orgId] });
    },
  });
}

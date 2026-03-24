// Demo data matching the InFlowe spec
// Dates are calculated relative to today so the demo always looks current.

// ─── Date helpers ─────────────────────────────────────────────────────────────
const _today = new Date();
export const _d = (daysOffset: number): string => {
  const d = new Date(_today);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};
const _ts = (daysOffset: number, hours = 10): string => {
  const d = new Date(_today);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  displayName: string;
  sensitivityLevel: 'standard' | 'sensitive' | 'vip' | 'high_value';
  status: 'active' | 'archived';
  preferredChannel: 'email' | 'whatsapp';
  contactName: string;
  contactEmail: string;
  overdueTotal: number;
  outstandingTotal: number;
  invoiceCount: number;
  riskScore: number;
  lastActivity: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  remainingBalance: number;
  currency: string;
  dueDate: string;
  state: 'sent' | 'due_soon' | 'due_today' | 'overdue' | 'partially_paid' | 'paid' | 'disputed' | 'on_hold';
  daysOverdue: number;
  agingBucket: 'current' | '1_30' | '31_60' | '61_90' | '90_plus';
  collectionPriority: 'low' | 'medium' | 'high' | 'critical';
  lastActionAt: string | null;
  nextActionAt: string | null;
  contactName: string;
  contactEmail: string;
  riskScore: number;
}

export interface Approval {
  id: string;
  invoiceId: string;
  clientName: string;
  invoiceNumber: string;
  approvalType: 'message_send' | 'workflow_publish' | 'payment_plan';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  rationale: string;
  messagePreview: string;
  stage: string;
  amount: number;
  daysOverdue: number;
  expiresAt: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'approval_pending' | 'critical_failure' | 'sensitive_reply' | 'integration_disconnected' | 'weekly_brief';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export const demoClients: Client[] = [
  {
    id: 'c1', displayName: 'Meridian Creative Co.', sensitivityLevel: 'standard', status: 'active',
    preferredChannel: 'email', contactName: 'Sarah Chen', contactEmail: 'sarah@meridiancreative.co',
    overdueTotal: 12500, outstandingTotal: 12500, invoiceCount: 2, riskScore: 0.72, lastActivity: '2 hours ago',
  },
  {
    id: 'c2', displayName: 'Bright Pixel Studios', sensitivityLevel: 'vip', status: 'active',
    preferredChannel: 'email', contactName: 'Marcus Webb', contactEmail: 'marcus@brightpixel.io',
    overdueTotal: 0, outstandingTotal: 15000, invoiceCount: 2, riskScore: 0.15, lastActivity: '1 day ago',
  },
  {
    id: 'c3', displayName: 'Volta Brand Agency', sensitivityLevel: 'sensitive', status: 'active',
    preferredChannel: 'email', contactName: 'Priya Patel', contactEmail: 'priya@voltabrand.com',
    overdueTotal: 8750, outstandingTotal: 13250, invoiceCount: 2, riskScore: 0.85, lastActivity: '5 days ago',
  },
  {
    id: 'c4', displayName: 'Northstar Digital', sensitivityLevel: 'standard', status: 'active',
    preferredChannel: 'email', contactName: 'Jake Morrison', contactEmail: 'jake@northstardigital.com',
    overdueTotal: 3200, outstandingTotal: 6400, invoiceCount: 2, riskScore: 0.45, lastActivity: '3 days ago',
  },
  {
    id: 'c5', displayName: 'Harbor & Co.', sensitivityLevel: 'high_value', status: 'active',
    preferredChannel: 'email', contactName: 'Lisa Nakamura', contactEmail: 'lisa@harborandco.com',
    overdueTotal: 0, outstandingTotal: 42000, invoiceCount: 2, riskScore: 0.08, lastActivity: '6 hours ago',
  },
  {
    id: 'c6', displayName: 'Fern & Bloom Marketing', sensitivityLevel: 'standard', status: 'active',
    preferredChannel: 'whatsapp', contactName: 'Amir Khan', contactEmail: 'amir@fernbloom.com',
    overdueTotal: 5600, outstandingTotal: 5600, invoiceCount: 1, riskScore: 0.62, lastActivity: '1 week ago',
  },
  {
    id: 'c7', displayName: 'Redline Productions', sensitivityLevel: 'standard', status: 'active',
    preferredChannel: 'email', contactName: 'Tanya Brooks', contactEmail: 'tanya@redlineproductions.com',
    overdueTotal: 0, outstandingTotal: 7200, invoiceCount: 1, riskScore: 0.22, lastActivity: '4 days ago',
  },
  {
    id: 'c8', displayName: 'Summit Group', sensitivityLevel: 'standard', status: 'archived',
    preferredChannel: 'email', contactName: 'David Park', contactEmail: 'david@summitgroup.co',
    overdueTotal: 0, outstandingTotal: 0, invoiceCount: 0, riskScore: 0.0, lastActivity: '2 months ago',
  },
  {
    id: 'c9', displayName: 'Apex Tech Solutions', sensitivityLevel: 'high_value', status: 'active',
    preferredChannel: 'email', contactName: 'Rachel Torres', contactEmail: 'rachel@apextech.io',
    overdueTotal: 0, outstandingTotal: 18500, invoiceCount: 1, riskScore: 0.10, lastActivity: '1 day ago',
  },
  {
    id: 'c10', displayName: 'Cascade Creative Partners', sensitivityLevel: 'sensitive', status: 'active',
    preferredChannel: 'email', contactName: 'Daniel Osei', contactEmail: 'daniel@cascadecreative.co',
    overdueTotal: 6200, outstandingTotal: 6200, invoiceCount: 1, riskScore: 0.68, lastActivity: '6 days ago',
  },
  {
    id: 'c11', displayName: 'Ironstone Consulting', sensitivityLevel: 'standard', status: 'active',
    preferredChannel: 'email', contactName: 'Mei Lin', contactEmail: 'mei@ironstoneconsulting.com',
    overdueTotal: 0, outstandingTotal: 9800, invoiceCount: 1, riskScore: 0.18, lastActivity: '2 days ago',
  },
];

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const demoInvoices: Invoice[] = [
  {
    id: 'i1', invoiceNumber: 'INV-2026-042', clientId: 'c1', clientName: 'Meridian Creative Co.',
    amount: 8500, remainingBalance: 8500, currency: 'USD',
    dueDate: _d(-34), state: 'overdue', daysOverdue: 34, agingBucket: '31_60',
    collectionPriority: 'high',
    lastActionAt: _d(-14), nextActionAt: _d(-2),
    contactName: 'Sarah Chen', contactEmail: 'sarah@meridiancreative.co', riskScore: 0.72,
  },
  {
    id: 'i2', invoiceNumber: 'INV-2026-045', clientId: 'c1', clientName: 'Meridian Creative Co.',
    amount: 4000, remainingBalance: 4000, currency: 'USD',
    dueDate: _d(-20), state: 'overdue', daysOverdue: 20, agingBucket: '1_30',
    collectionPriority: 'medium',
    lastActionAt: _d(-9), nextActionAt: _d(1),
    contactName: 'Sarah Chen', contactEmail: 'sarah@meridiancreative.co', riskScore: 0.72,
  },
  {
    id: 'i3', invoiceNumber: 'INV-2026-048', clientId: 'c3', clientName: 'Volta Brand Agency',
    amount: 8750, remainingBalance: 8750, currency: 'USD',
    dueDate: _d(-29), state: 'overdue', daysOverdue: 29, agingBucket: '1_30',
    collectionPriority: 'critical',
    lastActionAt: null, nextActionAt: null,
    contactName: 'Priya Patel', contactEmail: 'priya@voltabrand.com', riskScore: 0.85,
  },
  {
    id: 'i4', invoiceNumber: 'INV-2026-051', clientId: 'c4', clientName: 'Northstar Digital',
    amount: 3200, remainingBalance: 3200, currency: 'USD',
    dueDate: _d(-16), state: 'overdue', daysOverdue: 16, agingBucket: '1_30',
    collectionPriority: 'medium',
    lastActionAt: _d(-6), nextActionAt: _d(2),
    contactName: 'Jake Morrison', contactEmail: 'jake@northstardigital.com', riskScore: 0.45,
  },
  {
    id: 'i5', invoiceNumber: 'INV-2026-055', clientId: 'c2', clientName: 'Bright Pixel Studios',
    amount: 15000, remainingBalance: 15000, currency: 'USD',
    dueDate: _d(4), state: 'due_soon', daysOverdue: 0, agingBucket: 'current',
    collectionPriority: 'low',
    lastActionAt: null, nextActionAt: _d(1),
    contactName: 'Marcus Webb', contactEmail: 'marcus@brightpixel.io', riskScore: 0.15,
  },
  {
    id: 'i6', invoiceNumber: 'INV-2026-056', clientId: 'c5', clientName: 'Harbor & Co.',
    amount: 22000, remainingBalance: 22000, currency: 'USD',
    dueDate: _d(6), state: 'due_soon', daysOverdue: 0, agingBucket: 'current',
    collectionPriority: 'low',
    lastActionAt: null, nextActionAt: _d(3),
    contactName: 'Lisa Nakamura', contactEmail: 'lisa@harborandco.com', riskScore: 0.08,
  },
  {
    id: 'i7', invoiceNumber: 'INV-2026-057', clientId: 'c5', clientName: 'Harbor & Co.',
    amount: 20000, remainingBalance: 20000, currency: 'USD',
    dueDate: _d(22), state: 'sent', daysOverdue: 0, agingBucket: 'current',
    collectionPriority: 'low',
    lastActionAt: null, nextActionAt: null,
    contactName: 'Lisa Nakamura', contactEmail: 'lisa@harborandco.com', riskScore: 0.08,
  },
  {
    id: 'i8', invoiceNumber: 'INV-2026-038', clientId: 'c6', clientName: 'Fern & Bloom Marketing',
    amount: 5600, remainingBalance: 5600, currency: 'USD',
    dueDate: _d(-39), state: 'overdue', daysOverdue: 39, agingBucket: '31_60',
    collectionPriority: 'high',
    lastActionAt: _d(-7), nextActionAt: null,
    contactName: 'Amir Khan', contactEmail: 'amir@fernbloom.com', riskScore: 0.62,
  },
  {
    id: 'i9', invoiceNumber: 'INV-2026-060', clientId: 'c7', clientName: 'Redline Productions',
    amount: 7200, remainingBalance: 7200, currency: 'USD',
    dueDate: _d(9), state: 'sent', daysOverdue: 0, agingBucket: 'current',
    collectionPriority: 'low',
    lastActionAt: null, nextActionAt: null,
    contactName: 'Tanya Brooks', contactEmail: 'tanya@redlineproductions.com', riskScore: 0.22,
  },
  {
    id: 'i10', invoiceNumber: 'INV-2026-030', clientId: 'c4', clientName: 'Northstar Digital',
    amount: 6400, remainingBalance: 3200, currency: 'USD',
    dueDate: _d(-60), state: 'partially_paid', daysOverdue: 60, agingBucket: '61_90',
    collectionPriority: 'medium',
    lastActionAt: _d(-12), nextActionAt: _d(4),
    contactName: 'Jake Morrison', contactEmail: 'jake@northstardigital.com', riskScore: 0.45,
  },
  {
    id: 'i11', invoiceNumber: 'INV-2026-025', clientId: 'c2', clientName: 'Bright Pixel Studios',
    amount: 12000, remainingBalance: 0, currency: 'USD',
    dueDate: _d(-69), state: 'paid', daysOverdue: 0, agingBucket: 'current',
    collectionPriority: 'low',
    lastActionAt: _d(-70), nextActionAt: null,
    contactName: 'Marcus Webb', contactEmail: 'marcus@brightpixel.io', riskScore: 0.15,
  },
  {
    id: 'i12', invoiceNumber: 'INV-2026-035', clientId: 'c3', clientName: 'Volta Brand Agency',
    amount: 4500, remainingBalance: 4500, currency: 'USD',
    dueDate: _d(-21), state: 'disputed', daysOverdue: 21, agingBucket: '1_30',
    collectionPriority: 'critical',
    lastActionAt: _d(-19), nextActionAt: null,
    contactName: 'Priya Patel', contactEmail: 'priya@voltabrand.com', riskScore: 0.85,
  },
  {
    id: 'i13', invoiceNumber: 'INV-2026-062', clientId: 'c9', clientName: 'Apex Tech Solutions',
    amount: 18500, remainingBalance: 18500, currency: 'USD',
    dueDate: _d(30), state: 'sent', daysOverdue: 0, agingBucket: 'current',
    collectionPriority: 'low',
    lastActionAt: null, nextActionAt: null,
    contactName: 'Rachel Torres', contactEmail: 'rachel@apextech.io', riskScore: 0.10,
  },
  {
    id: 'i14', invoiceNumber: 'INV-2026-040', clientId: 'c10', clientName: 'Cascade Creative Partners',
    amount: 6200, remainingBalance: 6200, currency: 'USD',
    dueDate: _d(-45), state: 'overdue', daysOverdue: 45, agingBucket: '31_60',
    collectionPriority: 'high',
    lastActionAt: _d(-10), nextActionAt: _d(3),
    contactName: 'Daniel Osei', contactEmail: 'daniel@cascadecreative.co', riskScore: 0.68,
  },
  {
    id: 'i15', invoiceNumber: 'INV-2026-063', clientId: 'c11', clientName: 'Ironstone Consulting',
    amount: 9800, remainingBalance: 9800, currency: 'USD',
    dueDate: _d(15), state: 'due_soon', daysOverdue: 0, agingBucket: 'current',
    collectionPriority: 'low',
    lastActionAt: null, nextActionAt: _d(8),
    contactName: 'Mei Lin', contactEmail: 'mei@ironstoneconsulting.com', riskScore: 0.18,
  },
];

// ─── Approvals ────────────────────────────────────────────────────────────────

export const demoApprovals: Approval[] = [
  {
    id: 'a1', invoiceId: 'i1', clientName: 'Meridian Creative Co.', invoiceNumber: 'INV-2026-042',
    approvalType: 'message_send', status: 'pending',
    rationale: 'Invoice is 34 days overdue with no reply to the first reminder sent 14 days ago. This is the second follow-up.',
    messagePreview: `Hi Sarah,\n\nI wanted to follow up on invoice INV-2026-042 for $8,500, which was due ${34} days ago. I know things can get busy — is there anything we can help with to get this resolved?\n\nWe're happy to discuss a payment plan if that would be easier.\n\nBest,\nYour Company`,
    stage: 'Second follow-up', amount: 8500, daysOverdue: 34,
    expiresAt: _ts(3), createdAt: _ts(-2, 10),
  },
  {
    id: 'a2', invoiceId: 'i4', clientName: 'Northstar Digital', invoiceNumber: 'INV-2026-051',
    approvalType: 'message_send', status: 'pending',
    rationale: 'First automated reminder — invoice became overdue 16 days ago. No prior contact about this invoice.',
    messagePreview: `Hi Jake,\n\nJust a friendly reminder that invoice INV-2026-051 for $3,200 was due 16 days ago. Could you let me know when we can expect payment?\n\nThanks,\nYour Company`,
    stage: 'First reminder', amount: 3200, daysOverdue: 16,
    expiresAt: _ts(4), createdAt: _ts(-1, 9),
  },
  {
    id: 'a3', invoiceId: 'i8', clientName: 'Fern & Bloom Marketing', invoiceNumber: 'INV-2026-038',
    approvalType: 'message_send', status: 'pending',
    rationale: 'Invoice is 39 days overdue. Two prior reminders sent with no response. Escalating tone to firm.',
    messagePreview: `Hi Amir,\n\nWe need to bring your attention to invoice INV-2026-038 for $5,600, now 39 days past due. We've reached out twice previously without a response.\n\nPlease let us know your plans for payment at your earliest convenience.\n\nRegards,\nYour Company`,
    stage: 'Firm follow-up', amount: 5600, daysOverdue: 39,
    expiresAt: _ts(2), createdAt: _ts(-3, 14),
  },
];

// ─── Notifications ────────────────────────────────────────────────────────────

export const demoNotifications: Notification[] = [
  {
    id: 'n1', title: 'Approval needed',
    body: 'Follow-up message for Meridian Creative Co. is ready for review',
    type: 'approval_pending', read: false, createdAt: '10 min ago', actionUrl: '/approvals',
  },
  {
    id: 'n2', title: 'Reply received',
    body: 'Priya Patel from Volta Brand Agency replied about a disputed invoice',
    type: 'sensitive_reply', read: false, createdAt: '2 hours ago', actionUrl: '/invoices',
  },
  {
    id: 'n3', title: 'Weekly brief ready',
    body: 'Your weekly cash summary is ready to view',
    type: 'weekly_brief', read: true, createdAt: '3 days ago', actionUrl: '/reports',
  },
];

// ─── Home summary ─────────────────────────────────────────────────────────────

export const homeSummary = {
  overdueTotal: 36250,
  overdueCount: 6,
  dueSoonTotal: 46800,
  dueSoonCount: 3,
  approvalsPending: 3,
  repliesNeedingAttention: 1,
  recoveredThisWeek: 12000,
  totalOutstanding: 136450,
};

// ─── AI recommendations ───────────────────────────────────────────────────────

export const aiRecommendations = [
  {
    id: 'r1',
    text: "Reach out personally to Volta Brand Agency — automated messages aren't getting responses and the risk score is high.",
    action: 'View client', icon: 'phone' as const,
  },
  {
    id: 'r2',
    text: 'Offer a payment plan to Northstar Digital — they have a partially paid invoice and seem willing to pay.',
    action: 'Create plan', icon: 'calendar' as const,
  },
  {
    id: 'r3',
    text: "Good news — Harbor & Co. typically pays within 3 days of the due date. Their $22K invoice is due this week.",
    action: 'View invoice', icon: 'trending-up' as const,
  },
];

// ─── Demo thread messages ─────────────────────────────────────────────────────

export interface DemoMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  text: string;
  timestamp: string;
  senderName: string;
  channel: string;
  classification?: string;
}

export const demoThreadMessages: Record<string, DemoMessage[]> = {
  t1: [
    {
      id: 'm1a', direction: 'outbound',
      text: `Hi Priya,\n\nThis is a reminder that invoice INV-2026-048 for $8,750 was due on ${new Date(_today.getTime() - 29 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. We haven't received payment yet — could you let us know when we can expect it?\n\nThank you,\nYour Company`,
      timestamp: _ts(-29, 9), senderName: 'InFlowe', channel: 'email',
    },
    {
      id: 'm1b', direction: 'inbound',
      text: "Hi, we have some concerns about the charges listed on this invoice. The retainer hours don't match what was agreed in our contract. Could we get a breakdown before we process payment?",
      timestamp: _ts(-2, 11), senderName: 'Priya Patel', channel: 'email',
      classification: 'dispute_related',
    },
  ],
  t2: [
    {
      id: 'm2a', direction: 'outbound',
      text: `Hi Sarah,\n\nJust a friendly reminder that invoice INV-2026-042 for $8,500 was due on ${new Date(_today.getTime() - 34 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Please let us know if you have any questions.\n\nBest,\nYour Company`,
      timestamp: _ts(-14, 9), senderName: 'InFlowe', channel: 'email',
    },
    {
      id: 'm2b', direction: 'inbound',
      text: "Hi, I'll be out of office until next week. Will process this as soon as I'm back. Sorry for the delay!",
      timestamp: _ts(-1, 14), senderName: 'Sarah Chen', channel: 'email',
      classification: 'out_of_office',
    },
  ],
  t3: [
    {
      id: 'm3a', direction: 'outbound',
      text: `Hi Jake,\n\nA quick follow-up on invoice INV-2026-051 for $3,200, which is now 16 days past due. We've tried to reach you previously — please confirm your payment timeline.\n\nRegards,\nYour Company`,
      timestamp: _ts(-5, 9), senderName: 'InFlowe', channel: 'email',
    },
    {
      id: 'm3b', direction: 'inbound',
      text: 'Hi, sorry for the delay! Payment has been initiated from our end — should arrive in 2–3 business days. Please confirm receipt when it lands.',
      timestamp: _ts(-3, 16), senderName: 'Jake Morrison', channel: 'email',
      classification: 'promise_to_pay',
    },
  ],
  t4: [
    {
      id: 'm4a', direction: 'outbound',
      text: `Hi Amir,\n\nA reminder that invoice INV-2026-038 for $5,600 was due on ${new Date(_today.getTime() - 39 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Please get in touch if you have any questions.\n\nThanks,\nYour Company`,
      timestamp: _ts(-16, 9), senderName: 'InFlowe', channel: 'email',
    },
    {
      id: 'm4b', direction: 'outbound',
      text: `Hi Amir,\n\nWe haven't heard back regarding invoice INV-2026-038 for $5,600. This is now 32 days past due. Could you please confirm your payment plans?\n\nRegards,\nYour Company`,
      timestamp: _ts(-7, 10), senderName: 'InFlowe', channel: 'email',
    },
  ],
  t5: [
    {
      id: 'm5a', direction: 'outbound',
      text: `Hi Marcus,\n\nThis is a friendly heads-up that invoice INV-2026-055 for $15,000 is due in 4 days on ${new Date(_today.getTime() + 4 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. No action needed — just keeping you informed!\n\nBest,\nYour Company`,
      timestamp: _ts(-2, 9), senderName: 'InFlowe', channel: 'email',
    },
  ],
};

// ─── Demo invoice timelines ───────────────────────────────────────────────────

export interface DemoTimelineEvent {
  id: string;
  event_type: string;
  occurred_at: string;
  display_text: string;
}

export const demoInvoiceTimelines: Record<string, DemoTimelineEvent[]> = {
  i1: [
    { id: 'e1a', event_type: 'draft_generated', occurred_at: _ts(-2, 10), display_text: 'Second follow-up draft created — awaiting your approval' },
    { id: 'e1b', event_type: 'reply_received', occurred_at: _ts(-1, 14), display_text: 'Reply received: out of office (will pay on return)' },
    { id: 'e1c', event_type: 'message_sent', occurred_at: _ts(-14, 9), display_text: 'First reminder sent via email' },
    { id: 'e1d', event_type: 'invoice_state_changed', occurred_at: _ts(-34, 1), display_text: 'Invoice became overdue' },
    { id: 'e1e', event_type: 'invoice_imported', occurred_at: _ts(-50, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i2: [
    { id: 'e2a', event_type: 'draft_generated', occurred_at: _ts(-1, 11), display_text: 'First reminder draft created — awaiting your approval' },
    { id: 'e2b', event_type: 'message_sent', occurred_at: _ts(-9, 9), display_text: 'Gentle reminder sent via email' },
    { id: 'e2c', event_type: 'invoice_state_changed', occurred_at: _ts(-20, 1), display_text: 'Invoice became overdue' },
    { id: 'e2d', event_type: 'invoice_imported', occurred_at: _ts(-40, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i3: [
    { id: 'e3a', event_type: 'reply_received', occurred_at: _ts(-2, 11), display_text: 'Reply received: dispute related — automation paused' },
    { id: 'e3b', event_type: 'message_sent', occurred_at: _ts(-29, 9), display_text: 'First reminder sent via email' },
    { id: 'e3c', event_type: 'invoice_state_changed', occurred_at: _ts(-29, 1), display_text: 'Invoice became overdue' },
    { id: 'e3d', event_type: 'invoice_imported', occurred_at: _ts(-45, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i4: [
    { id: 'e4a', event_type: 'draft_generated', occurred_at: _ts(-2, 10), display_text: 'First reminder draft created — awaiting your approval' },
    { id: 'e4b', event_type: 'message_sent', occurred_at: _ts(-6, 9), display_text: 'Gentle reminder sent via email' },
    { id: 'e4c', event_type: 'invoice_state_changed', occurred_at: _ts(-16, 1), display_text: 'Invoice became overdue' },
    { id: 'e4d', event_type: 'invoice_imported', occurred_at: _ts(-35, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i5: [
    { id: 'e5a', event_type: 'draft_generated', occurred_at: _ts(-1, 9), display_text: 'Upcoming due date reminder drafted' },
    { id: 'e5b', event_type: 'invoice_imported', occurred_at: _ts(-20, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i6: [
    { id: 'e6a', event_type: 'invoice_imported', occurred_at: _ts(-18, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i7: [
    { id: 'e7a', event_type: 'invoice_imported', occurred_at: _ts(-15, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i8: [
    { id: 'e8a', event_type: 'draft_generated', occurred_at: _ts(-1, 10), display_text: 'Firm follow-up draft created — awaiting your approval' },
    { id: 'e8b', event_type: 'message_sent', occurred_at: _ts(-7, 9), display_text: 'Second reminder sent via email' },
    { id: 'e8c', event_type: 'message_sent', occurred_at: _ts(-16, 9), display_text: 'First reminder sent via email' },
    { id: 'e8d', event_type: 'invoice_state_changed', occurred_at: _ts(-39, 1), display_text: 'Invoice became overdue' },
    { id: 'e8e', event_type: 'invoice_imported', occurred_at: _ts(-55, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i9: [
    { id: 'e9a', event_type: 'invoice_imported', occurred_at: _ts(-20, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i10: [
    { id: 'e10a', event_type: 'payment_recorded', occurred_at: _ts(-12, 11), display_text: 'Payment of $3,200 recorded via bank transfer' },
    { id: 'e10b', event_type: 'message_sent', occurred_at: _ts(-40, 9), display_text: 'Payment reminder sent via email' },
    { id: 'e10c', event_type: 'invoice_state_changed', occurred_at: _ts(-60, 1), display_text: 'Invoice became overdue' },
    { id: 'e10d', event_type: 'invoice_imported', occurred_at: _ts(-80, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i11: [
    { id: 'e11a', event_type: 'invoice_paid', occurred_at: _ts(-69, 10), display_text: 'Invoice paid in full — $12,000 received' },
    { id: 'e11b', event_type: 'payment_recorded', occurred_at: _ts(-69, 10), display_text: 'Payment of $12,000 recorded via bank transfer' },
    { id: 'e11c', event_type: 'invoice_imported', occurred_at: _ts(-95, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i12: [
    { id: 'e12a', event_type: 'invoice_disputed', occurred_at: _ts(-19, 9), display_text: 'Invoice flagged as disputed — automation paused' },
    { id: 'e12b', event_type: 'reply_received', occurred_at: _ts(-20, 15), display_text: 'Reply received: dispute related' },
    { id: 'e12c', event_type: 'message_sent', occurred_at: _ts(-21, 9), display_text: 'First reminder sent via email' },
    { id: 'e12d', event_type: 'invoice_state_changed', occurred_at: _ts(-21, 1), display_text: 'Invoice became overdue' },
    { id: 'e12e', event_type: 'invoice_imported', occurred_at: _ts(-40, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i13: [
    { id: 'e13a', event_type: 'invoice_imported', occurred_at: _ts(-5, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i14: [
    { id: 'e14a', event_type: 'draft_generated', occurred_at: _ts(-3, 10), display_text: 'Follow-up draft created — awaiting your approval' },
    { id: 'e14b', event_type: 'message_sent', occurred_at: _ts(-10, 9), display_text: 'Second reminder sent via email' },
    { id: 'e14c', event_type: 'message_sent', occurred_at: _ts(-24, 9), display_text: 'First reminder sent via email' },
    { id: 'e14d', event_type: 'invoice_state_changed', occurred_at: _ts(-45, 1), display_text: 'Invoice became overdue' },
    { id: 'e14e', event_type: 'invoice_imported', occurred_at: _ts(-65, 14), display_text: 'Invoice imported via CSV upload' },
  ],
  i15: [
    { id: 'e15a', event_type: 'invoice_imported', occurred_at: _ts(-10, 14), display_text: 'Invoice imported via CSV upload' },
  ],
};

// ─── Demo reports data ────────────────────────────────────────────────────────

export const demoReportsData = {
  agingBuckets: [
    { bucket: 'Current', key: 'current', color: 'bg-success', amount: 55500, count: 5 },
    { bucket: '1–30 days', key: '1_30', color: 'bg-warning', amount: 24450, count: 4 },
    { bucket: '31–60 days', key: '31_60', color: 'bg-destructive/70', amount: 26500, count: 4 },
    { bucket: '61–90 days', key: '61_90', color: 'bg-destructive', amount: 3200, count: 1 },
    { bucket: '90+ days', key: '90_plus', color: 'bg-destructive', amount: 0, count: 0 },
  ],
  totalOutstanding: 129850,
  overdueTotal: 36250,
  dueSoonTotal: 46800,
  recoveredThisMonth: 19200,
  overdueInvoices: [
    { invoice_number: 'INV-2026-042', client_id: 'c1', remaining_balance: 8500, days_overdue: 34, collection_priority: 'high', due_date: _d(-34) },
    { invoice_number: 'INV-2026-048', client_id: 'c3', remaining_balance: 8750, days_overdue: 29, collection_priority: 'critical', due_date: _d(-29) },
    { invoice_number: 'INV-2026-038', client_id: 'c6', remaining_balance: 5600, days_overdue: 39, collection_priority: 'high', due_date: _d(-39) },
    { invoice_number: 'INV-2026-045', client_id: 'c1', remaining_balance: 4000, days_overdue: 20, collection_priority: 'medium', due_date: _d(-20) },
    { invoice_number: 'INV-2026-051', client_id: 'c4', remaining_balance: 3200, days_overdue: 16, collection_priority: 'medium', due_date: _d(-16) },
    { invoice_number: 'INV-2026-040', client_id: 'c10', remaining_balance: 6200, days_overdue: 45, collection_priority: 'high', due_date: _d(-45) },
  ],
  dueSoonInvoices: [
    { invoice_number: 'INV-2026-055', client_id: 'c2', remaining_balance: 15000, due_date: _d(4) },
    { invoice_number: 'INV-2026-056', client_id: 'c5', remaining_balance: 22000, due_date: _d(6) },
    { invoice_number: 'INV-2026-063', client_id: 'c11', remaining_balance: 9800, due_date: _d(15) },
  ],
  payments: [
    { payment_date: _d(-12), amount: 3200, payment_method: 'bank_transfer', source: 'manual' },
    { payment_date: _d(-25), amount: 5000, payment_method: 'card', source: 'stripe' },
    { payment_date: _d(-28), amount: 11000, payment_method: 'bank_transfer', source: 'manual' },
  ],
};

// ─── Utility functions ────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    sent: 'Sent', due_soon: 'Due Soon', due_today: 'Due Today',
    overdue: 'Overdue', partially_paid: 'Partial', paid: 'Paid',
    disputed: 'Disputed', on_hold: 'On Hold', pending: 'Pending',
  };
  return labels[state] || state;
}

export function getStateClass(state: string): string {
  const classes: Record<string, string> = {
    overdue: 'status-overdue', due_soon: 'status-due-soon', due_today: 'status-due-soon',
    paid: 'status-paid', partially_paid: 'status-due-soon',
    sent: 'status-pending', disputed: 'status-overdue', on_hold: 'status-pending',
    pending: 'status-pending',
  };
  return classes[state] || '';
}

export function getPriorityClass(priority: string): string {
  const classes: Record<string, string> = {
    critical: 'status-overdue', high: 'status-overdue',
    medium: 'status-due-soon', low: 'status-paid',
  };
  return classes[priority] || '';
}

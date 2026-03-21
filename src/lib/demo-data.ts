// Demo data matching the InFlowe spec (Part 25)
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

export const demoClients: Client[] = [
  { id: 'c1', displayName: 'Meridian Creative Co.', sensitivityLevel: 'standard', status: 'active', preferredChannel: 'email', contactName: 'Sarah Chen', contactEmail: 'sarah@meridiancreative.co', overdueTotal: 12500, outstandingTotal: 28400, invoiceCount: 5, riskScore: 0.72, lastActivity: '2 hours ago' },
  { id: 'c2', displayName: 'Bright Pixel Studios', sensitivityLevel: 'vip', status: 'active', preferredChannel: 'email', contactName: 'Marcus Webb', contactEmail: 'marcus@brightpixel.io', overdueTotal: 0, outstandingTotal: 15000, invoiceCount: 2, riskScore: 0.15, lastActivity: '1 day ago' },
  { id: 'c3', displayName: 'Volta Brand Agency', sensitivityLevel: 'sensitive', status: 'active', preferredChannel: 'email', contactName: 'Priya Patel', contactEmail: 'priya@voltabrand.com', overdueTotal: 8750, outstandingTotal: 8750, invoiceCount: 1, riskScore: 0.85, lastActivity: '5 days ago' },
  { id: 'c4', displayName: 'Northstar Digital', sensitivityLevel: 'standard', status: 'active', preferredChannel: 'email', contactName: 'Jake Morrison', contactEmail: 'jake@northstardigital.com', overdueTotal: 3200, outstandingTotal: 9600, invoiceCount: 3, riskScore: 0.45, lastActivity: '3 days ago' },
  { id: 'c5', displayName: 'Harbor & Co.', sensitivityLevel: 'high_value', status: 'active', preferredChannel: 'email', contactName: 'Lisa Nakamura', contactEmail: 'lisa@harborandco.com', overdueTotal: 0, outstandingTotal: 42000, invoiceCount: 4, riskScore: 0.08, lastActivity: '6 hours ago' },
  { id: 'c6', displayName: 'Fern & Bloom Marketing', sensitivityLevel: 'standard', status: 'active', preferredChannel: 'whatsapp', contactName: 'Amir Khan', contactEmail: 'amir@fernbloom.com', overdueTotal: 5600, outstandingTotal: 5600, invoiceCount: 1, riskScore: 0.62, lastActivity: '1 week ago' },
  { id: 'c7', displayName: 'Redline Productions', sensitivityLevel: 'standard', status: 'active', preferredChannel: 'email', contactName: 'Tanya Brooks', contactEmail: 'tanya@redlineproductions.com', overdueTotal: 0, outstandingTotal: 7200, invoiceCount: 2, riskScore: 0.22, lastActivity: '4 days ago' },
  { id: 'c8', displayName: 'Summit Group', sensitivityLevel: 'standard', status: 'archived', preferredChannel: 'email', contactName: 'David Park', contactEmail: 'david@summitgroup.co', overdueTotal: 0, outstandingTotal: 0, invoiceCount: 0, riskScore: 0.0, lastActivity: '2 months ago' },
];

export const demoInvoices: Invoice[] = [
  { id: 'i1', invoiceNumber: 'INV-2024-042', clientId: 'c1', clientName: 'Meridian Creative Co.', amount: 8500, remainingBalance: 8500, currency: 'USD', dueDate: '2024-02-15', state: 'overdue', daysOverdue: 34, agingBucket: '31_60', collectionPriority: 'high', lastActionAt: '2024-03-10', nextActionAt: '2024-03-22', contactName: 'Sarah Chen', contactEmail: 'sarah@meridiancreative.co', riskScore: 0.72 },
  { id: 'i2', invoiceNumber: 'INV-2024-045', clientId: 'c1', clientName: 'Meridian Creative Co.', amount: 4000, remainingBalance: 4000, currency: 'USD', dueDate: '2024-03-01', state: 'overdue', daysOverdue: 20, agingBucket: '1_30', collectionPriority: 'medium', lastActionAt: '2024-03-15', nextActionAt: '2024-03-25', contactName: 'Sarah Chen', contactEmail: 'sarah@meridiancreative.co', riskScore: 0.72 },
  { id: 'i3', invoiceNumber: 'INV-2024-048', clientId: 'c3', clientName: 'Volta Brand Agency', amount: 8750, remainingBalance: 8750, currency: 'USD', dueDate: '2024-02-20', state: 'overdue', daysOverdue: 29, agingBucket: '1_30', collectionPriority: 'critical', lastActionAt: null, nextActionAt: null, contactName: 'Priya Patel', contactEmail: 'priya@voltabrand.com', riskScore: 0.85 },
  { id: 'i4', invoiceNumber: 'INV-2024-051', clientId: 'c4', clientName: 'Northstar Digital', amount: 3200, remainingBalance: 3200, currency: 'USD', dueDate: '2024-03-05', state: 'overdue', daysOverdue: 16, agingBucket: '1_30', collectionPriority: 'medium', lastActionAt: '2024-03-18', nextActionAt: '2024-03-26', contactName: 'Jake Morrison', contactEmail: 'jake@northstardigital.com', riskScore: 0.45 },
  { id: 'i5', invoiceNumber: 'INV-2024-055', clientId: 'c2', clientName: 'Bright Pixel Studios', amount: 15000, remainingBalance: 15000, currency: 'USD', dueDate: '2024-03-28', state: 'due_soon', daysOverdue: 0, agingBucket: 'current', collectionPriority: 'low', lastActionAt: null, nextActionAt: '2024-03-25', contactName: 'Marcus Webb', contactEmail: 'marcus@brightpixel.io', riskScore: 0.15 },
  { id: 'i6', invoiceNumber: 'INV-2024-056', clientId: 'c5', clientName: 'Harbor & Co.', amount: 22000, remainingBalance: 22000, currency: 'USD', dueDate: '2024-03-30', state: 'due_soon', daysOverdue: 0, agingBucket: 'current', collectionPriority: 'low', lastActionAt: null, nextActionAt: '2024-03-27', contactName: 'Lisa Nakamura', contactEmail: 'lisa@harborandco.com', riskScore: 0.08 },
  { id: 'i7', invoiceNumber: 'INV-2024-057', clientId: 'c5', clientName: 'Harbor & Co.', amount: 20000, remainingBalance: 20000, currency: 'USD', dueDate: '2024-04-15', state: 'sent', daysOverdue: 0, agingBucket: 'current', collectionPriority: 'low', lastActionAt: null, nextActionAt: null, contactName: 'Lisa Nakamura', contactEmail: 'lisa@harborandco.com', riskScore: 0.08 },
  { id: 'i8', invoiceNumber: 'INV-2024-038', clientId: 'c6', clientName: 'Fern & Bloom Marketing', amount: 5600, remainingBalance: 5600, currency: 'USD', dueDate: '2024-02-10', state: 'overdue', daysOverdue: 39, agingBucket: '31_60', collectionPriority: 'high', lastActionAt: '2024-03-08', nextActionAt: null, contactName: 'Amir Khan', contactEmail: 'amir@fernbloom.com', riskScore: 0.62 },
  { id: 'i9', invoiceNumber: 'INV-2024-060', clientId: 'c7', clientName: 'Redline Productions', amount: 7200, remainingBalance: 7200, currency: 'USD', dueDate: '2024-04-02', state: 'sent', daysOverdue: 0, agingBucket: 'current', collectionPriority: 'low', lastActionAt: null, nextActionAt: null, contactName: 'Tanya Brooks', contactEmail: 'tanya@redlineproductions.com', riskScore: 0.22 },
  { id: 'i10', invoiceNumber: 'INV-2024-030', clientId: 'c4', clientName: 'Northstar Digital', amount: 6400, remainingBalance: 3200, currency: 'USD', dueDate: '2024-01-20', state: 'partially_paid', daysOverdue: 60, agingBucket: '31_60', collectionPriority: 'medium', lastActionAt: '2024-03-12', nextActionAt: '2024-03-28', contactName: 'Jake Morrison', contactEmail: 'jake@northstardigital.com', riskScore: 0.45 },
  { id: 'i11', invoiceNumber: 'INV-2024-025', clientId: 'c2', clientName: 'Bright Pixel Studios', amount: 12000, remainingBalance: 0, currency: 'USD', dueDate: '2024-01-15', state: 'paid', daysOverdue: 0, agingBucket: 'current', collectionPriority: 'low', lastActionAt: '2024-01-14', nextActionAt: null, contactName: 'Marcus Webb', contactEmail: 'marcus@brightpixel.io', riskScore: 0.15 },
  { id: 'i12', invoiceNumber: 'INV-2024-035', clientId: 'c3', clientName: 'Volta Brand Agency', amount: 4500, remainingBalance: 4500, currency: 'USD', dueDate: '2024-02-28', state: 'disputed', daysOverdue: 21, agingBucket: '1_30', collectionPriority: 'critical', lastActionAt: '2024-03-05', nextActionAt: null, contactName: 'Priya Patel', contactEmail: 'priya@voltabrand.com', riskScore: 0.85 },
];

export const demoApprovals: Approval[] = [
  {
    id: 'a1', invoiceId: 'i1', clientName: 'Meridian Creative Co.', invoiceNumber: 'INV-2024-042',
    approvalType: 'message_send', status: 'pending',
    rationale: 'Invoice is 34 days overdue with no reply to the first reminder sent on March 10th. This is the second follow-up.',
    messagePreview: 'Hi Sarah,\n\nI wanted to follow up on invoice INV-2024-042 for $8,500, which was due on February 15th. I know things can get busy — is there anything we can help with to get this resolved?\n\nWe\'re happy to discuss a payment plan if that would be easier.\n\nBest,\nYour Company',
    stage: 'Second follow-up', amount: 8500, daysOverdue: 34, expiresAt: '2024-03-24T00:00:00Z', createdAt: '2024-03-21T10:00:00Z'
  },
  {
    id: 'a2', invoiceId: 'i4', clientName: 'Northstar Digital', invoiceNumber: 'INV-2024-051',
    approvalType: 'message_send', status: 'pending',
    rationale: 'First automated reminder — invoice became overdue 16 days ago. No prior contact about this invoice.',
    messagePreview: 'Hi Jake,\n\nJust a friendly reminder that invoice INV-2024-051 for $3,200 was due on March 5th. Could you let me know when we can expect payment?\n\nThanks,\nYour Company',
    stage: 'First reminder', amount: 3200, daysOverdue: 16, expiresAt: '2024-03-25T00:00:00Z', createdAt: '2024-03-21T09:00:00Z'
  },
  {
    id: 'a3', invoiceId: 'i8', clientName: 'Fern & Bloom Marketing', invoiceNumber: 'INV-2024-038',
    approvalType: 'message_send', status: 'pending',
    rationale: 'Invoice is 39 days overdue. Two prior reminders sent with no response. Escalating tone to firm.',
    messagePreview: 'Hi Amir,\n\nWe need to bring your attention to invoice INV-2024-038 for $5,600, now 39 days past due. We\'ve reached out twice previously without a response.\n\nPlease let us know your plans for payment at your earliest convenience.\n\nRegards,\nYour Company',
    stage: 'Firm follow-up', amount: 5600, daysOverdue: 39, expiresAt: '2024-03-23T00:00:00Z', createdAt: '2024-03-20T14:00:00Z'
  },
];

export const demoNotifications: Notification[] = [
  { id: 'n1', title: 'Approval needed', body: 'Follow-up message for Meridian Creative Co. is ready for review', type: 'approval_pending', read: false, createdAt: '10 min ago', actionUrl: '/approvals' },
  { id: 'n2', title: 'Reply received', body: 'Priya Patel from Volta Brand Agency replied about a disputed invoice', type: 'sensitive_reply', read: false, createdAt: '2 hours ago', actionUrl: '/invoices' },
  { id: 'n3', title: 'Weekly brief ready', body: 'Your weekly cash summary for March 11–17 is ready to view', type: 'weekly_brief', read: true, createdAt: '3 days ago', actionUrl: '/reports' },
];

export const homeSummary = {
  overdueTotal: 30050,
  overdueCount: 5,
  dueSoonTotal: 37000,
  dueSoonCount: 2,
  approvalsPending: 3,
  repliesNeedingAttention: 1,
  recoveredThisWeek: 12000,
  totalOutstanding: 116850,
};

export const aiRecommendations = [
  { id: 'r1', text: 'Reach out personally to Volta Brand Agency — automated messages aren\'t getting responses and the risk score is high.', action: 'View client', icon: 'phone' as const },
  { id: 'r2', text: 'Offer a payment plan to Northstar Digital — they have a partially paid invoice and seem willing to pay.', action: 'Create plan', icon: 'calendar' as const },
  { id: 'r3', text: 'Good news — Harbor & Co. typically pays within 3 days of the due date. Their $22K invoice is due next week.', action: 'View invoice', icon: 'trending-up' as const },
];

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
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

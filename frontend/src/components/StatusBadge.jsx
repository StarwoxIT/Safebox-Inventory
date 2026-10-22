const MAPS = {
  projectStatus: {
    prospect: { label: 'Not Started', tone: 'neutral' },
    not_started: { label: 'Not Started', tone: 'neutral' },
    quote_accepted: { label: 'In Progress', tone: 'info' },
    on_going: { label: 'In Progress', tone: 'warning' },
    active_eaas: { label: 'In Progress', tone: 'info' },
    in_progress: { label: 'In Progress', tone: 'info' },
    on_hold: { label: 'On Hold', tone: 'warning' },
    completed: { label: 'Completed', tone: 'success' },
    cancelled: { label: 'Cancelled', tone: 'danger' },
    rejected: { label: 'Cancelled', tone: 'danger' },
  },
  businessModel: {
    outright_purchase: { label: 'Outright Purchase', tone: 'neutral' },
    eaas: { label: 'EaaS', tone: 'info' },
    repair_service: { label: 'Repair Service', tone: 'neutral' },
    maintenance_service: { label: 'Maintenance Service', tone: 'neutral' },
    upgrade: { label: 'Upgrade', tone: 'neutral' },
    direct_purchase: { label: 'Direct Purchase', tone: 'neutral' },
    greenband_eaas: { label: 'Greenband (EaaS)', tone: 'info' },
    upgrade_expansion: { label: 'Upgrade / System Expansion', tone: 'neutral' },
    installation_only: { label: 'Installation Only', tone: 'neutral' },
    maintenance_repair: { label: 'Maintenance / Repair Service', tone: 'neutral' },
    other: { label: 'Other', tone: 'neutral' },
  },
  paymentCategory: {
    full_payment: { label: 'Full Payment', tone: 'success' },
    installments: { label: 'Installments', tone: 'warning' },
    pay_as_you_go: { label: 'Pay as you Go', tone: 'info' },
    one_time_payment: { label: 'One-time Payment', tone: 'success' },
    instalment_payments: { label: 'Instalment Payments', tone: 'warning' },
    other: { label: 'Other', tone: 'neutral' },
  },
  approvalStatus: {
    Pending: { label: 'Pending', tone: 'warning' },
    Approved: { label: 'Approved', tone: 'success' },
    Rejected: { label: 'Rejected', tone: 'danger' },
  },
  paymentStatus: {
    pending: { label: 'Pending', tone: 'warning' },
    paid: { label: 'Paid', tone: 'success' },
    unpaid: { label: 'Unpaid', tone: 'neutral' },
    active: { label: 'Active', tone: 'info' },
    completed: { label: 'Completed', tone: 'success' },
    cancelled: { label: 'Cancelled', tone: 'danger' },
  },
  quoteStatus: {
    draft: { label: 'Draft', tone: 'warning' },
    final: { label: 'Final', tone: 'success' },
  },
  role: {
    admin: { label: 'Admin', tone: 'neutral' },
    super_admin: { label: 'Super Admin', tone: 'success' },
  },
  userStatus: {
    Active: { label: 'Active', tone: 'success' },
    Inactive: { label: 'Inactive', tone: 'danger' },
  },
};

export default function StatusBadge({ type, value, department }) {
  if (!value) return null;
  const entry = MAPS[type]?.[value] || { label: value, tone: 'neutral' };
  const label = type === 'role' && value === 'admin' && department
    ? `${entry.label} — ${department === 'engineering' ? 'Engineering' : 'Finance'}`
    : entry.label;
  return <span className={`status-badge tone-${entry.tone}`}>{label}</span>;
}

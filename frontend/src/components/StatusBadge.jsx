const MAPS = {
  projectStatus: {
    prospect: { label: 'Prospect', tone: 'neutral' },
    quote_accepted: { label: 'Quote Accepted', tone: 'info' },
    on_going: { label: 'On-going', tone: 'warning' },
    active_eaas: { label: 'Active (EaaS)', tone: 'info' },
    completed: { label: 'Completed', tone: 'success' },
    rejected: { label: 'Rejected', tone: 'danger' },
  },
  businessModel: {
    outright_purchase: { label: 'Outright Purchase', tone: 'neutral' },
    eaas: { label: 'EaaS', tone: 'info' },
    repair_service: { label: 'Repair Service', tone: 'neutral' },
    maintenance_service: { label: 'Maintenance Service', tone: 'neutral' },
    upgrade: { label: 'Upgrade', tone: 'neutral' },
  },
  paymentCategory: {
    full_payment: { label: 'Full Payment', tone: 'success' },
    installments: { label: 'Installments', tone: 'warning' },
    pay_as_you_go: { label: 'Pay as you Go', tone: 'info' },
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

export default function StatusBadge({ type, value }) {
  if (!value) return null;
  const entry = MAPS[type]?.[value] || { label: value, tone: 'neutral' };
  return <span className={`status-badge tone-${entry.tone}`}>{entry.label}</span>;
}

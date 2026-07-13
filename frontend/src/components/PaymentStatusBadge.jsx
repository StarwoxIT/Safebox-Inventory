// Payment Tracker statuses carry a dynamically computed label (e.g. "3 weeks left",
// "Overdue by 5 days"), so — unlike StatusBadge — this maps a statusType to a tone only.
const TONE_BY_STATUS_TYPE = {
  running: 'info',
  ongoing: 'warning',
  countdown: 'warning',
  overdue: 'danger',
  paid: 'success',
  completed: 'success',
  cancelled: 'neutral',
};

export default function PaymentStatusBadge({ statusType, statusLabel }) {
  if (!statusLabel) return null;
  const tone = TONE_BY_STATUS_TYPE[statusType] || 'neutral';
  return <span className={`status-badge tone-${tone}`}>{statusLabel}</span>;
}

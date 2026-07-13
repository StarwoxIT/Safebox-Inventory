import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { IconEdit } from '@tabler/icons-react';
import { getPaymentPlan } from '../api/payments';
import StatusBadge from '../components/StatusBadge';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import BackButton from '../components/BackButton';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function PaymentTrackerDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getPaymentPlan(planId)
      .then(setPlan)
      .catch(() => setError('Failed to load payment plan.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [planId]);

  if (loading) return <div className="page-loading">Loading payment plan...</div>;
  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!plan) return null;

  const isEaas = plan.category === 'pay_as_you_go';

  return (
    <div>
      <BackButton alwaysTo="/payment-tracker" label="Back to Payment Tracker" />

      <div className="ph">
        <div className="ph-heading">
          <div>
            <h1 className="ph-title">{plan.projectName}</h1>
            <p className="ph-subtitle">
              <Link to={`/projects/${plan.project_id}`}>View project</Link>
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/payment-tracker/${planId}/update`)}>
          <IconEdit size={16} /> Update Payment
        </button>
      </div>

      <div className="quote-option-flags" style={{ marginBottom: 16 }}>
        <StatusBadge type="paymentCategory" value={plan.category} />
        <PaymentStatusBadge statusType={plan.statusType} statusLabel={plan.statusLabel} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div><div className="stat-value">{currency.format(plan.total_amount)}</div><div className="stat-label">Total Amount</div></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-value">{currency.format(plan.amountPaid)}</div><div className="stat-label">Amount Paid</div></div>
        </div>
        {!isEaas && (
          <div className="stat-card">
            <div>
              <div className="stat-value" style={{ color: plan.amountRemaining > 0 ? 'var(--danger)' : undefined }}>
                {currency.format(plan.amountRemaining)}
              </div>
              <div className="stat-label">Amount Remaining</div>
            </div>
          </div>
        )}
        <div className="stat-card">
          <div>
            <div className="stat-value">
              {plan.nextDue ? currency.format(plan.nextDue.amount) : isEaas ? '—' : 'None'}
            </div>
            <div className="stat-label">
              {plan.nextDue ? `Next Due — ${plan.nextDue.label}${plan.nextDue.dueDate ? ` (${plan.nextDue.dueDate})` : ''}` : 'Next Due'}
            </div>
          </div>
        </div>
      </div>

      {plan.milestones?.length > 0 && (
        <div className="panel">
          <h2>{isEaas ? 'Deposit' : 'Payment Schedule'}</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Label</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {plan.milestones.map((m) => (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    <td>{m.due_date || 'On completion'}</td>
                    <td>{currency.format(m.amount)}</td>
                    <td><StatusBadge type="paymentStatus" value={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isEaas && plan.usage_periods?.length > 0 && (
        <div className="panel">
          <h2>Usage Billing History</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Period</th><th>Units</th><th>Rate</th><th>Amount Due</th><th>Status</th></tr></thead>
              <tbody>
                {plan.usage_periods.map((p) => (
                  <tr key={p.id}>
                    <td>{p.period_start} → {p.period_end}</td>
                    <td>{p.units_consumed}</td>
                    <td>{currency.format(p.rate_per_unit)}</td>
                    <td>{currency.format(p.amount_due)}</td>
                    <td><StatusBadge type="paymentStatus" value={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconCash } from '@tabler/icons-react';
import { getPaymentPlan, payMilestone, logUsagePeriod, payUsagePeriod } from '../api/payments';
import StatusBadge from '../components/StatusBadge';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import BackButton from '../components/BackButton';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const emptyUsageForm = { period_start: '', period_end: '', units_consumed: '', rate_per_unit: '' };

export default function PaymentUpdate() {
  const { planId } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [usageForm, setUsageForm] = useState(emptyUsageForm);

  const load = () => {
    setLoading(true);
    getPaymentPlan(planId)
      .then(setPlan)
      .catch(() => setError('Failed to load payment plan.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [planId]);

  const runAction = async (id, fn) => {
    setError('');
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleLogUsage = (e) => {
    e.preventDefault();
    runAction('usage-form', () =>
      logUsagePeriod(planId, {
        ...usageForm,
        units_consumed: Number(usageForm.units_consumed),
        rate_per_unit: Number(usageForm.rate_per_unit),
      })
    ).then(() => setUsageForm(emptyUsageForm));
  };

  if (loading) return <div className="page-loading">Loading payment plan...</div>;
  if (!plan) return <div className="alert alert-error" role="alert">{error || 'Payment plan not found.'}</div>;

  const isEaas = plan.category === 'pay_as_you_go';

  return (
    <div>
      <BackButton alwaysTo={`/payment-tracker/${planId}`} label="Back to Payment Details" />

      <div className="ph">
        <div className="ph-heading">
          <div>
            <h1 className="ph-title">Update Payment — {plan.projectName}</h1>
            <p className="ph-subtitle">{currency.format(plan.total_amount)} total</p>
          </div>
        </div>
      </div>

      <div className="quote-option-flags" style={{ marginBottom: 16 }}>
        <StatusBadge type="paymentCategory" value={plan.category} />
        <PaymentStatusBadge statusType={plan.statusType} statusLabel={plan.statusLabel} />
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {plan.milestones?.length > 0 && (
        <div className="panel">
          <h2>{isEaas ? 'Deposit' : 'Payment Schedule'}</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Label</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {plan.milestones.map((m) => (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    <td>{m.due_date || 'On completion'}</td>
                    <td>{currency.format(m.amount)}</td>
                    <td><StatusBadge type="paymentStatus" value={m.status} /></td>
                    <td>
                      {m.status === 'pending' && (
                        <button className="btn btn-secondary btn-sm" disabled={busyId === m.id} onClick={() => runAction(m.id, () => payMilestone(m.id))}>
                          <IconCash size={14} /> Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isEaas && (
        <div className="panel">
          <h2>Usage Billing</h2>
          <form className="form-grid" onSubmit={handleLogUsage}>
            <label>Period Start<input type="date" required value={usageForm.period_start} onChange={(e) => setUsageForm({ ...usageForm, period_start: e.target.value })} /></label>
            <label>Period End<input type="date" required value={usageForm.period_end} onChange={(e) => setUsageForm({ ...usageForm, period_end: e.target.value })} /></label>
            <label>Units Consumed<input type="number" min="0" step="0.01" required value={usageForm.units_consumed} onChange={(e) => setUsageForm({ ...usageForm, units_consumed: e.target.value })} /></label>
            <label>Rate per Unit<input type="number" min="0" step="0.01" required value={usageForm.rate_per_unit} onChange={(e) => setUsageForm({ ...usageForm, rate_per_unit: e.target.value })} /></label>
            <div className="span-2"><button type="submit" className="btn btn-secondary" disabled={busyId === 'usage-form'}>Log Usage Period</button></div>
          </form>

          {plan.usage_periods?.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Period</th><th>Units</th><th>Rate</th><th>Amount Due</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {plan.usage_periods.map((p) => (
                    <tr key={p.id}>
                      <td>{p.period_start} → {p.period_end}</td>
                      <td>{p.units_consumed}</td>
                      <td>{currency.format(p.rate_per_unit)}</td>
                      <td>{currency.format(p.amount_due)}</td>
                      <td><StatusBadge type="paymentStatus" value={p.status} /></td>
                      <td>
                        {p.status === 'pending' && (
                          <button className="btn btn-secondary btn-sm" disabled={busyId === p.id} onClick={() => runAction(p.id, () => payUsagePeriod(p.id))}>
                            <IconCash size={14} /> Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

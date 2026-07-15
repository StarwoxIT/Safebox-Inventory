import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCashBanknote, IconX } from '@tabler/icons-react';
import { listPaymentTracker } from '../api/payments';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import { MONTHS, yearsFrom, filterByDate } from '../utils/dateFilters';
import BackButton from '../components/BackButton';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const CATEGORY_OPTIONS = [
  { value: 'full_payment', label: 'Full Payment' },
  { value: 'installments', label: 'Installments' },
  { value: 'pay_as_you_go', label: 'Pay as you Go' },
];

const STATUS_OPTIONS = [
  { value: 'running', label: 'Running' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'countdown', label: 'Due (countdown)' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PaymentTracker() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  const load = () => {
    setLoading(true);
    listPaymentTracker()
      .then(setPlans)
      .catch(() => setError('Failed to load payment tracker.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const years = yearsFrom(plans, 'created_at');

  const filtered = filterByDate(plans, 'created_at', { dateFrom, dateTo, month: monthFilter, year: yearFilter })
    .filter((p) => !categoryFilter || p.category === categoryFilter)
    .filter((p) => !statusFilter || p.statusType === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'date_desc') return (b.created_at || '').localeCompare(a.created_at || '');
      if (sortBy === 'date_asc') return (a.created_at || '').localeCompare(b.created_at || '');
      if (sortBy === 'amount_desc') return b.total_amount - a.total_amount;
      if (sortBy === 'due_soonest') {
        const aDue = a.nextDue?.dueDate || '9999-99-99';
        const bDue = b.nextDue?.dueDate || '9999-99-99';
        return aDue.localeCompare(bDue);
      }
      return 0;
    });

  const { page, setPage, totalPages, paginated } = usePagination(filtered, 10);
  const hasFilters = categoryFilter || statusFilter || dateFrom || dateTo || monthFilter || yearFilter;

  const clearFilters = () => {
    setCategoryFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setMonthFilter('');
    setYearFilter('');
  };

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader icon={IconCashBanknote} title="Payment Tracker" subtitle="Every payment plan across all projects, with what's paid, what's left, and what's due." />
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {!loading && plans.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All months</option>
            {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Created from" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Created to" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Highest amount</option>
            <option value="due_soonest">Due soonest</option>
          </select>
          {hasFilters && <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}><IconX size={14} /> Clear</button>}
          <span className="page-subtitle">{filtered.length} plan{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {loading ? (
        <div className="panel"><SkeletonRows rows={5} columns={6} /></div>
      ) : plans.length === 0 ? (
        <EmptyState icon={IconCashBanknote} title="No payment plans yet" description="Payment plans appear here once a project's quotation is accepted and a plan is created." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconCashBanknote} title="No payment plans match your filters" />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th><th>Category</th><th>Status</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Next Due</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/payment-tracker/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td>{p.projectName}</td>
                  <td><StatusBadge type="paymentCategory" value={p.category} /></td>
                  <td><PaymentStatusBadge statusType={p.statusType} statusLabel={p.statusLabel} /></td>
                  <td>{currency.format(p.total_amount)}</td>
                  <td>{currency.format(p.amountPaid)}</td>
                  <td>{p.amountRemaining === null ? '—' : currency.format(p.amountRemaining)}</td>
                  <td>{p.nextDue ? `${currency.format(p.nextDue.amount)} ${p.nextDue.dueDate ? `(${p.nextDue.dueDate})` : ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

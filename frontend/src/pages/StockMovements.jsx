import { useEffect, useState } from 'react';
import { IconPlus, IconCheck, IconX, IconArrowsExchange } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { listStockMovements, createStockMovement, approveStockMovement } from '../api/stockMovements';
import { listProducts } from '../api/products';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import { MONTHS, yearsFrom, filterByDate } from '../utils/dateFilters';
import BackButton from '../components/BackButton';

const MOVEMENT_TYPES = [
  'Purchase (IN)',
  'Return (IN)',
  'Transfer IN',
  'Client Return to Stock',
  'Project Return to Stock',
  'Used in Project (OUT)',
  'Sale (OUT)',
  'Transfer OUT',
  'Damaged/Written Off',
  'Adjustment',
];
const IN_TYPES = ['Purchase (IN)', 'Return (IN)', 'Transfer IN', 'Client Return to Stock', 'Project Return to Stock'];

const emptyForm = { product_id: '', movement_type: MOVEMENT_TYPES[0], quantity: '', condition: 'New', source: '' };

export default function StockMovements() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  const load = () => {
    setLoading(true);
    Promise.all([listStockMovements(), listProducts()])
      .then(([m, p]) => { setMovements(m); setProducts(p); })
      .catch(() => setError('Failed to load stock movements.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createStockMovement({ ...form, quantity: Number(form.quantity) });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log movement.');
    }
  };

  const handleApprove = async (id, decision) => {
    setError('');
    try {
      await approveStockMovement(id, decision);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update approval.');
    }
  };

  const years = yearsFrom(movements, 'date');

  const filtered = filterByDate(movements, 'date', { dateFrom, dateTo, month: monthFilter, year: yearFilter })
    .filter((m) => !typeFilter || m.movement_type === typeFilter)
    .filter(
      (m) =>
        !search ||
        (m.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.source || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '');
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '');
      if (sortBy === 'qty_desc') return b.quantity - a.quantity;
      return 0;
    });

  const { page, setPage, totalPages, paginated } = usePagination(filtered, 10);
  const hasFilters = typeFilter || search || dateFrom || dateTo || monthFilter || yearFilter;

  const clearFilters = () => {
    setTypeFilter('');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setMonthFilter('');
    setYearFilter('');
  };

  return (
    <div>
      <BackButton alwaysTo="/" label="Back to Dashboard" />
      <PageHeader icon={IconArrowsExchange} title="Stock Movements" subtitle="Record stock coming in, going out, or moving between projects." />
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <label>
          Product
          <select name="product_id" value={form.product_id} onChange={handleChange} required>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.model}</option>)}
          </select>
        </label>
        <label>
          Movement Type
          <select name="movement_type" value={form.movement_type} onChange={handleChange}>
            {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Quantity<input type="number" name="quantity" min="0" step="0.01" value={form.quantity} onChange={handleChange} required /></label>
        <label>Condition<input name="condition" value={form.condition} onChange={handleChange} /></label>
        <label className="span-2">Source / Notes<input name="source" value={form.source} onChange={handleChange} /></label>
        <div className="span-2">
          <button type="submit" className="btn btn-primary"><IconPlus size={16} /> Log Movement</button>
          {!isSuperAdmin && <span className="page-subtitle" style={{ marginLeft: 12 }}>Movements go to Pending until a super admin approves them.</span>}
        </div>
      </form>

      {!loading && movements.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or source…" style={{ width: 200 }} />
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All months</option>
            {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Date from" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Date to" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="qty_desc">Highest quantity</option>
          </select>
          {hasFilters && <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}><IconX size={14} /> Clear</button>}
          <span className="page-subtitle">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {loading ? (
        <div className="panel"><SkeletonRows rows={5} columns={5} /></div>
      ) : movements.length === 0 ? (
        <EmptyState icon={IconArrowsExchange} title="No stock movements yet" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconArrowsExchange} title="No movements match your filters" />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Status</th>{isSuperAdmin && <th />}</tr></thead>
            <tbody>
              {paginated.map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td>{m.product_name}</td>
                  <td>{m.movement_type}</td>
                  <td style={{ color: IN_TYPES.includes(m.movement_type) ? 'var(--success)' : 'var(--danger)' }}>
                    {IN_TYPES.includes(m.movement_type) ? '+' : '-'}{m.quantity}
                  </td>
                  <td><StatusBadge type="approvalStatus" value={m.status} /></td>
                  {isSuperAdmin && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {m.status === 'Pending' && (
                        <>
                          <button className="icon-btn" title="Approve" aria-label="Approve" onClick={() => handleApprove(m.id, 'Approved')}><IconCheck size={18} /></button>
                          <button className="icon-btn" title="Reject" aria-label="Reject" onClick={() => handleApprove(m.id, 'Rejected')}><IconX size={18} /></button>
                        </>
                      )}
                    </td>
                  )}
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

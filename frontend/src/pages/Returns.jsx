import { useEffect, useState } from 'react';
import { IconPlus, IconRotateClockwise2, IconEdit, IconX } from '@tabler/icons-react';
import { listReturns, createReturn, updateReturn } from '../api/returns';
import { listProducts } from '../api/products';
import { listProjects } from '../api/projects';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import { MONTHS, yearsFrom, filterByDate } from '../utils/dateFilters';
import BackButton from '../components/BackButton';

const emptyForm = { return_type: 'Client Return', project_id: '', product_id: '', quantity: '', reason: '', oem: '' };

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [editingReturn, setEditingReturn] = useState(null);
  const [editForm, setEditForm] = useState({ oem: '', sent_to_oem_date: '', oem_response: '', reconciled: false });

  const load = () => {
    setLoading(true);
    Promise.all([listReturns(), listProducts(), listProjects()])
      .then(([r, p, pr]) => { setReturns(r); setProducts(p); setProjects(pr); })
      .catch(() => setError('Failed to load returns.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const openAddModal = () => {
    setForm(emptyForm);
    setError('');
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createReturn({ ...form, quantity: Number(form.quantity), project_id: form.project_id || null });
      setForm(emptyForm);
      setShowAddModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log return.');
    }
  };

  const openEdit = (r) => {
    setEditingReturn(r);
    setEditForm({ oem: r.oem || '', sent_to_oem_date: r.sent_to_oem_date || '', oem_response: r.oem_response || '', reconciled: Boolean(r.reconciled) });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateReturn(editingReturn.id, editForm);
      setEditingReturn(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update return.');
    }
  };

  const years = yearsFrom(returns, 'date');

  const filtered = filterByDate(returns, 'date', { dateFrom, dateTo, month: monthFilter, year: yearFilter })
    .filter((r) => !typeFilter || r.return_type === typeFilter)
    .filter(
      (r) =>
        !search ||
        (r.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.reason || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.oem || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '');
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '');
      if (sortBy === 'qty_desc') return b.quantity - a.quantity;
      return 0;
    });

  const openOemReturns = returns.filter((r) => r.oem && !r.reconciled);
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
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader
          icon={IconRotateClockwise2}
          title="Returns"
          subtitle="Client and project returns, with OEM reconciliation tracking."
          actions={
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <IconPlus size={16} /> Log Return
            </button>
          }
        />
      </div>
      {error && !showAddModal && <div className="alert alert-error" role="alert">{error}</div>}
      {openOemReturns.length > 0 && (
        <div className="alert alert-error" role="status">
          {openOemReturns.length} open OEM return{openOemReturns.length > 1 ? 's' : ''} — awaiting response or replacement from manufacturer.
        </div>
      )}

      {!loading && returns.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="Client Return">Client Return</option>
            <option value="Project Return">Project Return</option>
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, reason, or OEM…" style={{ width: 200 }} />
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
        <div className="panel"><SkeletonRows rows={4} columns={4} /></div>
      ) : returns.length === 0 ? (
        <EmptyState icon={IconRotateClockwise2} title="No returns logged yet" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconRotateClockwise2} title="No returns match your filters" />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Project</th><th>Qty</th><th>Reason</th><th>OEM</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {paginated.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.return_type}</td>
                  <td>{r.product_name}</td>
                  <td>{r.project_name || '-'}</td>
                  <td>{r.quantity}</td>
                  <td>{r.reason}</td>
                  <td>{r.oem || '-'}</td>
                  <td>{r.reconciled ? <StatusBadge type="paymentStatus" value="paid" /> : r.oem ? <StatusBadge type="paymentStatus" value="pending" /> : '-'}</td>
                  <td>
                    <button className="icon-btn" title="Update reconciliation" aria-label="Update reconciliation" onClick={() => openEdit(r)}>
                      <IconEdit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {showAddModal && (
        <div className="dialog-overlay">
          <div className="dialog-card wide" role="dialog" aria-modal="true" aria-labelledby="log-return-title">
            <div className="dialog-header-row">
              <h2 className="dialog-title" id="log-return-title">Log Return</h2>
              <button type="button" className="icon-btn" onClick={() => setShowAddModal(false)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Return Type
                <select name="return_type" value={form.return_type} onChange={handleChange}>
                  <option value="Client Return">Client Return</option>
                  <option value="Project Return">Project Return</option>
                </select>
              </label>
              <label>
                Project (optional)
                <select name="project_id" value={form.project_id} onChange={handleChange}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label>
                Product
                <select name="product_id" value={form.product_id} onChange={handleChange} required>
                  <option value="">Select product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.model}</option>)}
                </select>
              </label>
              <label>Quantity<input type="number" name="quantity" min="0" step="0.01" value={form.quantity} onChange={handleChange} required /></label>
              <label>OEM / Manufacturer (optional)<input name="oem" value={form.oem} onChange={handleChange} placeholder="Leave blank if not OEM" /></label>
              <label className="span-2">Reason<input name="reason" value={form.reason} onChange={handleChange} required /></label>
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingReturn && (
        <div className="dialog-overlay" onClick={() => setEditingReturn(null)}>
          <div className="dialog-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">Update return / reconciliation</h2>
            <form className="form-grid" onSubmit={handleEditSubmit}>
              <label>OEM<input value={editForm.oem} onChange={(e) => setEditForm({ ...editForm, oem: e.target.value })} /></label>
              <label>Date Sent to OEM<input type="date" value={editForm.sent_to_oem_date} onChange={(e) => setEditForm({ ...editForm, sent_to_oem_date: e.target.value })} /></label>
              <label className="span-2">OEM Response<input value={editForm.oem_response} onChange={(e) => setEditForm({ ...editForm, oem_response: e.target.value })} /></label>
              <label className="span-2" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={editForm.reconciled} onChange={(e) => setEditForm({ ...editForm, reconciled: e.target.checked })} style={{ width: 'auto' }} />
                Mark as reconciled — closes this return
              </label>
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingReturn(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

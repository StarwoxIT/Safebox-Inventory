import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconTrash, IconBoxSeam, IconCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { listProducts, listProductStock, createProduct, approveProduct, deleteProduct } from '../api/products';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import { MONTHS, yearsFrom, filterByDate } from '../utils/dateFilters';
import BackButton from '../components/BackButton';

const emptyForm = { category: '', subcategory: '', brand: '', model: '', unit: 'Unit', min_threshold: 0, max_threshold: 100, unit_cost: 0 };

export default function Products() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  const [products, setProducts] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([listProducts(), listProductStock()])
      .then(([p, s]) => { setProducts(p); setStock(s); })
      .catch(() => setError('Failed to load products.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stockMap = Object.fromEntries(stock.map((s) => [s.id, s.current_stock]));
  const categories = [...new Set(products.map((p) => p.category))].sort();
  const years = yearsFrom(products, 'created_at');

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
      await createProduct({ ...form, min_threshold: Number(form.min_threshold), max_threshold: Number(form.max_threshold), unit_cost: Number(form.unit_cost) });
      setShowAddModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create product.');
    }
  };

  const handleApprove = async (id, decision) => {
    setError('');
    try {
      await approveProduct(id, decision);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update approval.');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setError('');
    try {
      await deleteProduct(pendingDelete.id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete product.');
    } finally {
      setPendingDelete(null);
    }
  };

  const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN' });

  const filtered = filterByDate(products, 'created_at', { dateFrom, dateTo, month: monthFilter, year: yearFilter })
    .filter((p) => !categoryFilter || p.category === categoryFilter)
    .filter((p) => !search || p.model.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.model.localeCompare(b.model);
      if (sortBy === 'stock_desc') return (stockMap[b.id] || 0) - (stockMap[a.id] || 0);
      if (sortBy === 'cost_desc') return b.unit_cost - a.unit_cost;
      return 0;
    });

  const { page, setPage, totalPages, paginated } = usePagination(filtered, 10);
  const hasFilters = categoryFilter || search || dateFrom || dateTo || monthFilter || yearFilter;

  const clearFilters = () => {
    setCategoryFilter('');
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
          icon={IconBoxSeam}
          title="Products"
          subtitle="The inventory catalog used for stock and quotations."
          actions={
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <IconPlus size={16} /> Add Product
            </button>
          }
        />
      </div>
      {error && !showAddModal && <div className="alert alert-error" role="alert">{error}</div>}

      {!loading && products.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search model or brand…" style={{ width: 200 }} />
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All months</option>
            {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Date added from" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Date added to" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Sort by name</option>
            <option value="stock_desc">Highest stock</option>
            <option value="cost_desc">Highest cost</option>
          </select>
          {hasFilters && <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}><IconX size={14} /> Clear</button>}
          <span className="page-subtitle">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {loading ? (
        <div className="panel"><SkeletonRows rows={5} columns={5} /></div>
      ) : products.length === 0 ? (
        <EmptyState icon={IconBoxSeam} title="No products yet" description="Click Add Product to create your first one." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconBoxSeam} title="No products match your filters" />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th><th>Category</th><th>Stock</th><th>Unit Cost</th><th>Status</th>{isSuperAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => {
                const currentStock = stockMap[p.id];
                const belowThreshold = currentStock !== undefined && currentStock <= p.min_threshold;
                const lowStock = currentStock !== undefined && !belowThreshold && currentStock <= p.min_threshold * 1.2;
                return (
                  <tr key={p.id} onClick={() => navigate(`/products/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td>{p.model}{p.brand ? ` (${p.brand})` : ''}</td>
                    <td>{p.category}{p.subcategory ? ` / ${p.subcategory}` : ''}</td>
                    <td style={{ color: belowThreshold ? 'var(--danger)' : lowStock ? '#a15c00' : undefined }}>
                      {currentStock !== undefined ? currentStock : '—'}
                    </td>
                    <td>{currency.format(p.unit_cost)}</td>
                    <td><StatusBadge type="approvalStatus" value={p.status} /></td>
                    {isSuperAdmin && (
                      <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        {p.status === 'Pending' && (
                          <>
                            <button className="icon-btn" title="Approve" aria-label="Approve" onClick={() => handleApprove(p.id, 'Approved')}>
                              <IconCheck size={18} />
                            </button>
                            <button className="icon-btn" title="Reject" aria-label="Reject" onClick={() => handleApprove(p.id, 'Rejected')}>
                              <IconX size={18} />
                            </button>
                          </>
                        )}
                        <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => setPendingDelete(p)}>
                          <IconTrash size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {showAddModal && (
        <div className="dialog-overlay">
          <div className="dialog-card wide" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
            <div className="dialog-header-row">
              <h2 className="dialog-title" id="add-product-title">Add Product</h2>
              <button type="button" className="icon-btn" onClick={() => setShowAddModal(false)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>Category<input name="category" value={form.category} onChange={handleChange} required /></label>
              <label>Subcategory<input name="subcategory" value={form.subcategory} onChange={handleChange} /></label>
              <label>Brand<input name="brand" value={form.brand} onChange={handleChange} /></label>
              <label>Model<input name="model" value={form.model} onChange={handleChange} required /></label>
              <label>Unit<input name="unit" value={form.unit} onChange={handleChange} /></label>
              <label>Unit Cost<input type="number" name="unit_cost" value={form.unit_cost} onChange={handleChange} /></label>
              <label>Min Threshold<input type="number" name="min_threshold" value={form.min_threshold} onChange={handleChange} /></label>
              <label>Max Threshold<input type="number" name="max_threshold" value={form.max_threshold} onChange={handleChange} /></label>
              {!isSuperAdmin && (
                <p className="span-2 page-subtitle" style={{ margin: 0 }}>
                  New products go to Pending until a super admin approves them.
                </p>
              )}
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete product?"
        body={`This will permanently remove "${pendingDelete?.model}" from the catalog.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

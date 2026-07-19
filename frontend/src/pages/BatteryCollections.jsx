import { useEffect, useState } from 'react';
import { IconPlus, IconBattery, IconEdit, IconX } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { listBatteryCollections, createBatteryCollection, updateBatteryCollection } from '../api/batteryCollections';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import { MONTHS, yearsFrom, filterByDate } from '../utils/dateFilters';
import BackButton from '../components/BackButton';

const BATTERY_TYPES = ['Tubular', 'Lithium (LiFePO4)', 'AGM', 'Gel', 'Lead Acid', 'Other'];
const emptyForm = { date: new Date().toISOString().slice(0, 10), battery_type: 'Tubular', quantity: 1, collected_from: '', notes: '' };

export default function BatteryCollections() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    listBatteryCollections()
      .then(setCollections)
      .catch(() => setError('Failed to load battery collections.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openAddModal = () => {
    setForm(emptyForm);
    setError('');
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createBatteryCollection({ ...form, quantity: Number(form.quantity) });
      setForm(emptyForm);
      setShowAddModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log collection.');
    }
  };

  const openEdit = (c) => {
    setEditingCollection(c);
    setEditForm({ date: c.date || '', battery_type: c.battery_type, quantity: c.quantity, collected_from: c.collected_from || '', notes: c.notes || '' });
    setError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateBatteryCollection(editingCollection.id, { ...editForm, quantity: Number(editForm.quantity) });
      setEditingCollection(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update collection.');
    }
  };

  const years = yearsFrom(collections, 'date');

  const filtered = filterByDate(collections, 'date', { dateFrom, dateTo, month: monthFilter, year: yearFilter })
    .filter((c) => !typeFilter || c.battery_type === typeFilter)
    .filter((c) => !search || (c.collected_from || '').toLowerCase().includes(search.toLowerCase()) || (c.notes || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '');
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '');
      if (sortBy === 'qty_desc') return b.quantity - a.quantity;
      return 0;
    });

  const totalBatteries = filtered.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  const byType = BATTERY_TYPES.map((t) => ({
    type: t,
    qty: filtered.filter((c) => c.battery_type === t).reduce((sum, c) => sum + Number(c.quantity || 0), 0),
    count: filtered.filter((c) => c.battery_type === t).length,
  })).filter((x) => x.count > 0);
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
          icon={IconBattery}
          title="Battery Collections"
          subtitle="Track the tubular battery swap and upgrade programme."
          actions={
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <IconPlus size={16} /> Log Collection
            </button>
          }
        />
      </div>
      {error && !showAddModal && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card"><div><div className="stat-value">{filtered.length}</div><div className="stat-label">Total records</div></div></div>
        <div className="stat-card"><div><div className="stat-value">{totalBatteries}</div><div className="stat-label">Total batteries</div></div></div>
        {byType.map((x) => (
          <div className="stat-card" key={x.type}>
            <div><div className="stat-value">{x.qty}</div><div className="stat-label">{x.type} ({x.count})</div></div>
          </div>
        ))}
      </div>

      {!loading && collections.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All battery types</option>
            {BATTERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search collected from or notes…" style={{ width: 200 }} />
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
      ) : collections.length === 0 ? (
        <EmptyState icon={IconBattery} title="No battery collections recorded" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconBattery} title="No collections match your filters" />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Collected From</th><th>Notes</th>{isSuperAdmin && <th />}</tr></thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id}>
                  <td>{c.date}</td>
                  <td>{c.battery_type}</td>
                  <td>{c.quantity}</td>
                  <td>{c.collected_from}</td>
                  <td>{c.notes || '-'}</td>
                  {isSuperAdmin && (
                    <td>
                      <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => openEdit(c)}>
                        <IconEdit size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {showAddModal && (
        <div className="dialog-overlay">
          <div className="dialog-card wide" role="dialog" aria-modal="true" aria-labelledby="log-collection-title">
            <div className="dialog-header-row">
              <h2 className="dialog-title" id="log-collection-title">Log Collection</h2>
              <button type="button" className="icon-btn" onClick={() => setShowAddModal(false)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label>Quantity<input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
              <label>
                Battery Type
                <select value={form.battery_type} onChange={(e) => setForm({ ...form, battery_type: e.target.value })}>
                  {BATTERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Collected From<input value={form.collected_from} onChange={(e) => setForm({ ...form, collected_from: e.target.value })} required /></label>
              <label className="span-2">Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCollection && (
        <div className="dialog-overlay">
          <div className="dialog-card wide" role="dialog" aria-modal="true" aria-labelledby="edit-collection-title">
            <div className="dialog-header-row">
              <h2 className="dialog-title" id="edit-collection-title">Edit Collection</h2>
              <button type="button" className="icon-btn" onClick={() => setEditingCollection(null)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <form className="form-grid" onSubmit={handleEditSubmit}>
              <label>Date<input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></label>
              <label>Quantity<input type="number" min="1" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} /></label>
              <label>
                Battery Type
                <select value={editForm.battery_type} onChange={(e) => setEditForm({ ...editForm, battery_type: e.target.value })}>
                  {BATTERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Collected From<input value={editForm.collected_from} onChange={(e) => setEditForm({ ...editForm, collected_from: e.target.value })} required /></label>
              <label className="span-2">Notes<input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></label>
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingCollection(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

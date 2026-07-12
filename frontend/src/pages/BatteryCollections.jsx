import { useEffect, useState } from 'react';
import { IconPlus, IconBattery } from '@tabler/icons-react';
import { listBatteryCollections, createBatteryCollection } from '../api/batteryCollections';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import BackButton from '../components/BackButton';

const BATTERY_TYPES = ['Tubular', 'Lithium (LiFePO4)', 'AGM', 'Gel', 'Lead Acid', 'Other'];

export default function BatteryCollections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), battery_type: 'Tubular', quantity: 1, collected_from: '', notes: '' });
  const [typeFilter, setTypeFilter] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    listBatteryCollections()
      .then(setCollections)
      .catch(() => setError('Failed to load battery collections.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createBatteryCollection({ ...form, quantity: Number(form.quantity) });
      setForm({ date: new Date().toISOString().slice(0, 10), battery_type: 'Tubular', quantity: 1, collected_from: '', notes: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log collection.');
    }
  };

  const filtered = collections.filter((c) => !typeFilter || c.battery_type === typeFilter);
  const totalBatteries = filtered.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  const byType = BATTERY_TYPES.map((t) => ({
    type: t,
    qty: filtered.filter((c) => c.battery_type === t).reduce((sum, c) => sum + Number(c.quantity || 0), 0),
    count: filtered.filter((c) => c.battery_type === t).length,
  })).filter((x) => x.count > 0);
  const { page, setPage, totalPages, paginated } = usePagination(filtered, 10);

  return (
    <div>
      <BackButton alwaysTo="/" label="Back to Dashboard" />
      <PageHeader icon={IconBattery} title="Battery Collections" subtitle="Track the tubular battery swap and upgrade programme." />
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card"><div><div className="stat-value">{filtered.length}</div><div className="stat-label">Total records</div></div></div>
        <div className="stat-card"><div><div className="stat-value">{totalBatteries}</div><div className="stat-label">Total batteries</div></div></div>
        {byType.map((x) => (
          <div className="stat-card" key={x.type}>
            <div><div className="stat-value">{x.qty}</div><div className="stat-label">{x.type} ({x.count})</div></div>
          </div>
        ))}
      </div>

      <form className="panel form-grid" onSubmit={handleSubmit}>
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
        <div className="span-2"><button type="submit" className="btn btn-primary"><IconPlus size={16} /> Log Collection</button></div>
      </form>

      <div style={{ marginBottom: 12 }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All battery types</option>
          {BATTERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="panel"><SkeletonRows rows={4} columns={4} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconBattery} title="No battery collections recorded" />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Collected From</th><th>Notes</th></tr></thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id}>
                  <td>{c.date}</td>
                  <td>{c.battery_type}</td>
                  <td>{c.quantity}</td>
                  <td>{c.collected_from}</td>
                  <td>{c.notes || '-'}</td>
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

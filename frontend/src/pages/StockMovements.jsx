import { useEffect, useState } from 'react';
import { IconPlus, IconCheck, IconX, IconArrowsExchange } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { listStockMovements, createStockMovement, approveStockMovement } from '../api/stockMovements';
import { listProducts } from '../api/products';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { SkeletonRows } from '../components/Skeleton';

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

  return (
    <div>
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
        <div style={{ marginBottom: 12 }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="panel"><SkeletonRows rows={5} columns={5} /></div>
      ) : movements.length === 0 ? (
        <EmptyState icon={IconArrowsExchange} title="No stock movements yet" />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Status</th>{isSuperAdmin && <th />}</tr></thead>
            <tbody>
              {movements.filter((m) => !typeFilter || m.movement_type === typeFilter).map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td>{m.product_name}</td>
                  <td>{m.movement_type}</td>
                  <td>{m.quantity}</td>
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
        </div>
      )}
    </div>
  );
}

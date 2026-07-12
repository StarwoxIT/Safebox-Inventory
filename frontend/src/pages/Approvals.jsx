import { useEffect, useState } from 'react';
import { IconCheck, IconX, IconShieldCheck } from '@tabler/icons-react';
import { listProducts, approveProduct } from '../api/products';
import { listStockMovements, approveStockMovement } from '../api/stockMovements';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import BackButton from '../components/BackButton';

export default function Approvals() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([listProducts(), listStockMovements()])
      .then(([p, m]) => {
        setProducts(p.filter((x) => x.status === 'Pending'));
        setMovements(m.filter((x) => x.status === 'Pending'));
      })
      .catch(() => setError('Failed to load pending approvals.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const decide = async (type, id, decision) => {
    setError('');
    try {
      if (type === 'product') await approveProduct(id, decision);
      else await approveStockMovement(id, decision);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record decision.');
    }
  };

  const productsPagination = usePagination(products, 10);
  const movementsPagination = usePagination(movements, 10);

  if (loading) return <div className="page-loading">Loading approvals...</div>;

  return (
    <div>
      <BackButton alwaysTo="/" label="Back to Dashboard" />
      <PageHeader icon={IconShieldCheck} title="Approvals" subtitle="Review and approve pending products and stock movements." />
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="panel">
        <h2>Pending products ({products.length})</h2>
        {products.length === 0 ? (
          <EmptyState title="No pending products" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Model</th><th>Category</th><th>Unit cost</th><th></th></tr></thead>
              <tbody>
                {productsPagination.paginated.map((p) => (
                  <tr key={p.id}>
                    <td>{p.model}</td>
                    <td>{p.category}</td>
                    <td>{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN' }).format(p.unit_cost)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => decide('product', p.id, 'Approved')}><IconCheck size={14} /> Approve</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => decide('product', p.id, 'Rejected')}><IconX size={14} /> Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={productsPagination.page} totalPages={productsPagination.totalPages} onPageChange={productsPagination.setPage} />
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Pending stock movements ({movements.length})</h2>
        {movements.length === 0 ? (
          <EmptyState title="No pending movements" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Logged by</th><th></th></tr></thead>
              <tbody>
                {movementsPagination.paginated.map((m) => (
                  <tr key={m.id}>
                    <td>{m.date}</td>
                    <td>{m.product_name}</td>
                    <td>{m.movement_type}</td>
                    <td>{m.quantity}</td>
                    <td>{m.recorded_by_name || '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => decide('movement', m.id, 'Approved')}><IconCheck size={14} /> Approve</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => decide('movement', m.id, 'Rejected')}><IconX size={14} /> Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={movementsPagination.page} totalPages={movementsPagination.totalPages} onPageChange={movementsPagination.setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

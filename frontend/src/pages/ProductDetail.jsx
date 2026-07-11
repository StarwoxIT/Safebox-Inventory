import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconBoxSeam } from '@tabler/icons-react';
import { listProducts, listProductStock } from '../api/products';
import { listStockMovements } from '../api/stockMovements';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import BackButton from '../components/BackButton';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN' });
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export default function ProductDetail() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([listProducts(), listProductStock(), listStockMovements()])
      .then(([products, stock, allMovements]) => {
        setProduct(products.find((p) => p.id === productId) || null);
        setStockInfo(stock.find((s) => s.id === productId) || null);
        setMovements(allMovements.filter((m) => m.product_id === productId));
      })
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <div className="page-loading">Loading product...</div>;
  if (!product) {
    return (
      <div>
        <BackButton fallback="/products" label="Back to Products" />
        <div className="alert alert-error">Product not found.</div>
      </div>
    );
  }

  const currentStock = stockInfo?.current_stock ?? 0;
  const filteredMovements = movements.filter(
    (m) =>
      !search ||
      m.movement_type.toLowerCase().includes(search.toLowerCase()) ||
      (m.source || '').toLowerCase().includes(search.toLowerCase())
  );
  const IN_TYPES = ['Purchase (IN)', 'Return (IN)', 'Transfer IN', 'Client Return to Stock', 'Project Return to Stock'];

  return (
    <div>
      <BackButton fallback="/products" label="Back to Products" />

      <div className="ph">
        <div className="ph-heading">
          <span className="ph-icon"><IconBoxSeam size={20} /></span>
          <div>
            <h1 className="ph-title">{product.brand ? `${product.brand} ` : ''}{product.model}</h1>
            <p className="ph-subtitle">{product.id} · {product.category}{product.subcategory ? ` / ${product.subcategory}` : ''}</p>
          </div>
        </div>
        <StatusBadge type="approvalStatus" value={product.status} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div>
            <div className="stat-value" style={{ color: currentStock <= product.min_threshold ? 'var(--danger)' : currentStock <= product.min_threshold * 1.2 ? '#a15c00' : undefined }}>
              {number.format(currentStock)}
            </div>
            <div className="stat-label">Available quantity ({product.unit})</div>
          </div>
        </div>
        <div className="stat-card">
          <div><div className="stat-value">{currency.format(product.unit_cost)}</div><div className="stat-label">Unit cost</div></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-value">{currency.format(currentStock * product.unit_cost)}</div><div className="stat-label">Total value</div></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-value">{number.format(product.min_threshold)}–{number.format(product.max_threshold)}</div><div className="stat-label">Threshold range</div></div>
        </div>
      </div>

      <div className="panel">
        <h2>Movement log history</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search type or source…"
          style={{ marginBottom: 12, width: 240 }}
        />
        {filteredMovements.length === 0 ? (
          <EmptyState title="No movement history for this product" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Condition</th><th>Qty</th><th>Status</th><th>Source</th><th>By</th></tr></thead>
              <tbody>
                {filteredMovements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.date}</td>
                    <td>{m.movement_type}</td>
                    <td>{m.condition}</td>
                    <td style={{ color: IN_TYPES.includes(m.movement_type) ? 'var(--success)' : 'var(--danger)' }}>
                      {IN_TYPES.includes(m.movement_type) ? '+' : '-'}{number.format(m.quantity)}
                    </td>
                    <td><StatusBadge type="approvalStatus" value={m.status} /></td>
                    <td>{m.source || '-'}</td>
                    <td>{m.recorded_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

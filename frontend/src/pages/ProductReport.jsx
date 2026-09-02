import { useEffect, useRef, useState } from 'react';
import { IconBoxSeam, IconFileSpreadsheet, IconFileTypePdf } from '@tabler/icons-react';
import { getProductReport, exportProductReport } from '../api/reports';
import { listCategories } from '../api/categories';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import BackButton from '../components/BackButton';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function ProductReport() {
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listCategories().then(setCategoryOptions).catch(() => {});
  }, []);

  const requestIdRef = useRef(0);
  const load = (params) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    getProductReport(params)
      .then((data) => {
        if (requestIdRef.current !== requestId) return; // a newer request (e.g. a later filter change) already landed
        setReport(data);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setError('Failed to load product report.');
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  };

  useEffect(() => load({}), []);

  const subcategoriesFor = (categoryName) =>
    categoryOptions.find((c) => c.name === categoryName)?.subcategories || [];

  const applyFilters = () => load({ category, subcategory, from, to });

  const handleExport = async (format) => {
    setExporting(true);
    setError('');
    try {
      await exportProductReport({ category, subcategory, from, to }, format);
    } catch (err) {
      setError('Failed to export report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/reports" label="Back to Reports" />
        <PageHeader icon={IconBoxSeam} title="Product Report" subtitle="Products filterable by category and sub-category, with current stock and cost." />
      </div>

      <div className="panel">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}>
            <option value="">All categories</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category}>
            <option value="">All sub-categories</option>
            {subcategoriesFor(category).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Added from" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Added to" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={applyFilters}>Apply</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleExport('xlsx')} disabled={exporting}>
              <IconFileSpreadsheet size={14} /> Excel
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')} disabled={exporting}>
              <IconFileTypePdf size={14} /> PDF
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {loading ? (
          <SkeletonRows rows={5} columns={7} />
        ) : !report || report.items.length === 0 ? (
          <EmptyState title="No products match this filter" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Category</th><th>Model</th><th>Unit Cost</th><th>Stock</th><th>Status</th><th>Added</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{[p.category, p.subcategory].filter(Boolean).join(' / ')}</td>
                    <td>{[p.brand, p.model].filter(Boolean).join(' ')}</td>
                    <td>{currency.format(p.unitCost)}</td>
                    <td>{p.currentStock}</td>
                    <td>{p.status}</td>
                    <td>{(p.createdAt || '').slice(0, 10)}</td>
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

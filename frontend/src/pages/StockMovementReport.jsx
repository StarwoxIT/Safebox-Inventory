import { useEffect, useRef, useState } from 'react';
import { IconArrowsExchange, IconFileSpreadsheet, IconFileTypePdf } from '@tabler/icons-react';
import { getStockMovementReport, exportStockMovementReport } from '../api/reports';
import { listCategories } from '../api/categories';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import BackButton from '../components/BackButton';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function rangeFor(period) {
  const to = todayStr();
  const d = new Date();
  if (period === 'week') d.setDate(d.getDate() - 7);
  else if (period === 'month') d.setMonth(d.getMonth() - 1);
  else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
  else return { from: '', to: '' };
  return { from: d.toISOString().slice(0, 10), to };
}

export default function StockMovementReport() {
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
    getStockMovementReport(params)
      .then((data) => {
        if (requestIdRef.current !== requestId) return; // a newer request (e.g. a later filter change) already landed
        setReport(data);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setError('Failed to load stock movement report.');
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  };

  useEffect(() => load({}), []);

  const subcategoriesFor = (categoryName) =>
    categoryOptions.find((c) => c.name === categoryName)?.subcategories || [];

  const applyPeriod = (period) => {
    const r = rangeFor(period);
    setFrom(r.from);
    setTo(r.to);
    load({ ...r, category, subcategory });
  };

  const applyFilters = () => load({ from, to, category, subcategory });

  const handleExport = async (format) => {
    setExporting(true);
    setError('');
    try {
      await exportStockMovementReport({ from, to, category, subcategory }, format);
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
        <PageHeader icon={IconArrowsExchange} title="Stock Movement Report" subtitle="Stock moved in and out over a period, filterable by category and sub-category." />
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPeriod('week')}>This Week</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPeriod('month')}>This Month</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPeriod('year')}>This Year</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPeriod('all')}>All Time</button>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
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
          <EmptyState title="No stock movements match this filter" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Product</th><th>Category</th><th>Type</th><th>In</th><th>Out</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.date}</td>
                    <td>{i.productId} — {i.productName}</td>
                    <td>{[i.category, i.subcategory].filter(Boolean).join(' / ')}</td>
                    <td>{i.movementType}</td>
                    <td>{i.inQty || ''}</td>
                    <td>{i.outQty || ''}</td>
                    <td>{i.status}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={4}>Totals</td>
                  <td>{report.totals.totalIn}</td>
                  <td>{report.totals.totalOut}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

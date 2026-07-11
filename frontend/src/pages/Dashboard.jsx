import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { IconBriefcase, IconFileText, IconClock, IconReceipt2, IconAlertTriangle, IconBolt, IconBoxSeam } from '@tabler/icons-react';
import { getDashboardStats } from '../api/dashboard';
import { getSettings } from '../api/settings';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { SkeletonRows } from '../components/Skeleton';

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const PIE_COLORS = ['#0F6E56', '#185FA5', '#BA7517', '#A32D2D', '#534AB7', '#117a65', '#b7950b'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getDashboardStats(), getSettings()])
      .then(([s, cfg]) => {
        setStats(s);
        setSettings(cfg);
      })
      .catch(() => setError('Failed to load dashboard stats.'));
  }, []);

  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!stats) return <div className="panel"><SkeletonRows rows={4} columns={4} /></div>;

  const lowStockAlertsEnabled = settings.low_stock_alert !== 'false';

  const cards = [
    { label: 'Total Projects', value: stats.totalProjects, icon: IconBriefcase },
    { label: 'Total Quotes', value: stats.totalQuotes, icon: IconFileText },
    { label: 'Outstanding Balance', value: currency.format(stats.outstandingBalance), icon: IconClock },
    { label: 'Confirmed Income (Markup)', value: currency.format(stats.confirmedIncome), icon: IconReceipt2 },
    { label: 'Inventory Value', value: currency.format(stats.totalStockValue), icon: IconBoxSeam },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: IconAlertTriangle },
    { label: 'Active EaaS Projects', value: stats.activeEaasProjects, icon: IconBolt },
  ];

  const catData = Object.entries(stats.categorySummary || {}).map(([name, v]) => ({
    name,
    stock: Math.round(v.totalStock),
    value: v.totalValue,
  }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Portal overview across projects, quotes, inventory and payments." />

      <div className="stat-grid">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <Icon size={26} className="stat-icon" />
            <div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {lowStockAlertsEnabled && stats.belowThreshold > 0 && (
        <div className="alert alert-error" role="status">
          {stats.belowThreshold} product{stats.belowThreshold > 1 ? 's' : ''} below reorder threshold — reorder required.
        </div>
      )}
      {lowStockAlertsEnabled && stats.lowStock > 0 && (
        <div className="alert alert-error" role="status" style={{ background: 'var(--status-warning-bg, #fff4e0)' }}>
          {stats.lowStock} product{stats.lowStock > 1 ? 's' : ''} approaching minimum threshold.
        </div>
      )}
      {stats.openOemReturns > 0 && (
        <div className="alert alert-error" role="status">
          {stats.openOemReturns} open OEM return{stats.openOemReturns > 1 ? 's' : ''} awaiting reconciliation.
        </div>
      )}

      <div className="panel">
        <h2>Projects by Status</h2>
        <div className="quote-option-flags">
          {Object.entries(stats.projectsByStatus).map(([status, count]) => (
            <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusBadge type="projectStatus" value={status} /> <strong>{count}</strong>
            </span>
          ))}
          {Object.keys(stats.projectsByStatus).length === 0 && <span className="page-subtitle">No projects yet.</span>}
        </div>
      </div>

      {catData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="panel">
            <h2>Stock by Category</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={catData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip formatter={(v) => [v, 'Units']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="stock" fill="#0F6E56" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel">
            <h2>Category Value Split</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="45%" cy="50%" outerRadius={70} labelLine={false}>
                  {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [currency.format(v), 'Value']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Revenue by Month</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.revenueByMonth} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
            <YAxis
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)' }}
              width={72}
              tickFormatter={(value) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)}
            />
            <Tooltip formatter={(value) => currency.format(value)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
            <Bar dataKey="total" fill="#7a9a1f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2>Recent Activity</h2>
        <ul className="activity-list">
          {stats.recentActivity.map((activity) => (
            <li key={activity.id}>
              <span className={`badge badge-${activity.change_type}`}>{activity.change_type}</span>
              <span>
                <Link to={`/projects/${activity.project_id}`}>{activity.project_name}</Link> &ndash; Option{' '}
                {activity.option_number} by {activity.changed_by_name || 'Unknown'}
              </span>
              <span className="activity-time">{new Date(activity.created_at).toLocaleString()}</span>
            </li>
          ))}
          {stats.recentActivity.length === 0 && <li>No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}

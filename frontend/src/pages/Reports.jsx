import { Link } from 'react-router-dom';
import { IconFileAnalytics, IconArrowsExchange, IconBoxSeam, IconChevronRight } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import BackButton from '../components/BackButton';

const REPORT_TYPES = [
  {
    to: '/reports/stock-movements',
    icon: IconArrowsExchange,
    title: 'Stock Movement Report',
    description: 'Stock moved in and out over a period, by category and sub-category. Export to Excel or PDF.',
  },
  {
    to: '/reports/products',
    icon: IconBoxSeam,
    title: 'Product Report',
    description: 'Products by category and sub-category, with current stock and cost. Export to Excel or PDF.',
  },
];

export default function Reports() {
  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader icon={IconFileAnalytics} title="Reports" subtitle="Choose a report type to generate." />
      </div>
      <div className="card-grid">
        {REPORT_TYPES.map(({ to, icon: Icon, title, description }) => (
          <Link to={to} className="job-card" key={to}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon size={22} />
              <h3 style={{ margin: 0 }}>{title}</h3>
            </div>
            <p>{description}</p>
            <div className="job-card-footer">
              <span>Open report</span>
              <IconChevronRight size={16} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

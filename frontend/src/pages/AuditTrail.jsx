import { useEffect, useState } from 'react';
import { getAuditLog } from '../api/audit';
import BackButton from '../components/BackButton';

const PAGE_SIZE = 50;

function describeAction(entry) {
  const labels = {
    'auth.login': 'Logged in',
    'user.create': 'Created user',
    'user.update': 'Updated user',
    'user.delete': 'Removed user',
    'user.change_password': 'Changed password',
    'project.create': 'Created project',
    'project.update': 'Updated project',
    'project.delete': 'Deleted project',
    'project.engineer_assign': 'Assigned engineer',
    'project.engineer_update': 'Updated engineer assignment',
    'project.material_log': 'Logged material use',
    'project.cost_log': 'Logged project cost',
    'quote.create': 'Created quotation option',
    'quote.update': 'Updated quotation option',
    'quote.delete': 'Deleted quotation option',
    'quote.select': 'Marked option as selected by client',
    'quote.unselect': 'Unmarked selected option',
    'product.create': 'Created product',
    'product.update': 'Updated product',
    'product.approved': 'Approved product',
    'product.rejected': 'Rejected product',
    'product.delete': 'Deleted product',
    'stock_movement.create': 'Logged stock movement',
    'stock_movement.approved': 'Approved stock movement',
    'stock_movement.rejected': 'Rejected stock movement',
    'stock_movement.delete': 'Deleted stock movement',
    'category.create': 'Created category',
    'category.update': 'Updated category',
    'category.delete': 'Deleted category',
    'unit.create': 'Created unit',
    'unit.delete': 'Deleted unit',
    'return.create': 'Logged return',
    'return.update': 'Updated return',
    'return.delete': 'Deleted return',
    'battery_collection.create': 'Logged battery collection',
    'battery_collection.delete': 'Deleted battery collection',
    'payment_plan.create': 'Created payment plan',
    'payment_milestone.pay': 'Recorded milestone payment',
    'usage_period.create': 'Logged usage period',
    'usage_period.pay': 'Recorded usage payment',
    'settings.update': 'Updated settings',
    'company_profile.update': 'Updated company profile',
  };
  return labels[entry.action] || entry.action;
}

export default function AuditTrail() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = (newOffset) => {
    setLoading(true);
    getAuditLog(PAGE_SIZE, newOffset)
      .then((data) => {
        setEntries(data.entries);
        setTotal(data.total);
        setOffset(newOffset);
      })
      .catch(() => setError('Failed to load audit trail.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(0), []);

  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <h1 className="page-title">Audit Trail</h1>
        <p className="page-subtitle">A record of every significant action taken across the system.</p>
      </div>

      <div className="panel">
        {loading ? (
          <div className="page-loading">Loading audit trail...</div>
        ) : (
          <>
            <table className="editor-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.created_at).toLocaleString()}</td>
                    <td>{entry.user_name || 'System'}</td>
                    <td>{describeAction(entry)}</td>
                    <td>{entry.details ? JSON.stringify(entry.details) : '-'}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={4}>No audit entries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="pagination-row">
              <button
                className="btn btn-secondary btn-sm"
                disabled={offset === 0}
                onClick={() => load(Math.max(offset - PAGE_SIZE, 0))}
              >
                Previous
              </button>
              <span>
                {Math.min(offset + 1, total)}-{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => load(offset + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

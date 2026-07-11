import { useEffect, useState } from 'react';
import { getAuditLog } from '../api/audit';

const PAGE_SIZE = 50;

function describeAction(entry) {
  const labels = {
    'auth.login': 'Logged in',
    'user.create': 'Created user',
    'user.delete': 'Removed user',
    'job.create': 'Created job',
    'job.update': 'Updated job',
    'job.delete': 'Deleted job',
    'quote.create': 'Created quotation option',
    'quote.update': 'Updated quotation option',
    'quote.delete': 'Deleted quotation option',
    'quote.select': 'Marked option as selected by client',
    'quote.unselect': 'Unmarked selected option',
    'quote.payment_confirm': 'Confirmed payment',
    'item.create': 'Created catalog item',
    'item.update': 'Updated catalog item',
    'item.delete': 'Deleted catalog item',
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
      <h1 className="page-title">Audit Trail</h1>
      <p className="page-subtitle">A record of every significant action taken across the system.</p>

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

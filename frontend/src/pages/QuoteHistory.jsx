import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getQuoteVersions, getQuoteDetail } from '../api/quotes';
import BackButton from '../components/BackButton';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

export default function QuoteHistory() {
  const { quoteId } = useParams();
  const [versions, setVersions] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getQuoteVersions(quoteId), getQuoteDetail(quoteId)])
      .then(([v, q]) => {
        setVersions(v);
        setQuote(q);
      })
      .catch(() => setError('Failed to load version history.'))
      .finally(() => setLoading(false));
  }, [quoteId]);

  const { page, setPage, totalPages, paginated } = usePagination(versions, 10);

  if (loading) return <div className="page-loading">Loading history...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <BackButton fallback={quote ? `/projects/${quote.project_id}` : '/projects'} label="Back to Project" />
      <h1 className="page-title">Version History</h1>
      {quote && (
        <p className="page-subtitle">
          Option {quote.option_number} &mdash; {quote.title}
        </p>
      )}

      <div className="panel">
        <table className="editor-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Change Type</th>
              <th>Changed By</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((v) => (
              <tr key={v.id}>
                <td>v{v.version_number}</td>
                <td>
                  <span className={`badge badge-${v.change_type}`}>{v.change_type}</span>
                </td>
                <td>{v.changed_by_name || 'Unknown'}</td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {versions.length === 0 && (
              <tr>
                <td colSpan={4}>No version history yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

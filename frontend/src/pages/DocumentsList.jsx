import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconPlus, IconDownload, IconTrash, IconFileInvoice, IconReceipt2 } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { listDocuments, deleteDocument, downloadDocumentPdf } from '../api/documents';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import BackButton from '../components/BackButton';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });

export default function DocumentsList({ docType }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';
  const isReceipt = docType === 'receipt';

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = () => {
    setLoading(true);
    listDocuments(docType)
      .then(setDocs)
      .catch(() => setError(`Failed to load ${isReceipt ? 'receipts' : 'invoices'}.`))
      .finally(() => setLoading(false));
  };

  useEffect(load, [docType]);

  const handleDelete = async () => {
    try {
      await deleteDocument(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const { page, setPage, totalPages, paginated } = usePagination(docs, 10);

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader
          icon={isReceipt ? IconReceipt2 : IconFileInvoice}
          title={isReceipt ? 'Receipts' : 'Invoices'}
          subtitle={isReceipt ? 'Proof of payments received from clients.' : 'Bills issued to clients before payment.'}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => navigate(isReceipt ? '/receipts/new' : '/invoices/new')}>
              <IconPlus size={16} /> New {isReceipt ? 'Receipt' : 'Invoice'}
            </button>
          }
        />
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {loading ? (
        <div className="panel"><SkeletonRows rows={5} columns={6} /></div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={isReceipt ? IconReceipt2 : IconFileInvoice}
          title={`No ${isReceipt ? 'receipts' : 'invoices'} yet`}
          description={`Generate one from a project's quotation, or start a blank ${docType}.`}
        />
      ) : (
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Number</th><th>Client</th><th>Project</th><th>Date</th><th>Total</th>
                {!isReceipt && <th>Balance</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((d) => (
                <tr key={d.id}>
                  <td>{d.docNumber}</td>
                  <td>{d.clientName || '—'}</td>
                  <td>{d.projectName ? <Link to={`/projects/${d.projectId}`}>{d.projectName}</Link> : '—'}</td>
                  <td>{d.issueDate}</td>
                  <td>{currency.format(d.grandTotal)}</td>
                  {!isReceipt && <td>{d.balance > 0 ? currency.format(d.balance) : '—'}</td>}
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="icon-btn" title="Download PDF" aria-label="Download PDF" onClick={() => downloadDocumentPdf(d.id, d.docNumber)}>
                      <IconDownload size={18} />
                    </button>
                    {isSuperAdmin && (
                      <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => setPendingDelete(d)}>
                        <IconTrash size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${docType}?`}
        body={`This will permanently remove ${pendingDelete?.docNumber} from the record.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

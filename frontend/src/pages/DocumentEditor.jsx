import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconTrash, IconPlus, IconFileInvoice, IconReceipt2 } from '@tabler/icons-react';
import { listProjects, getProject } from '../api/projects';
import { listQuotesForProject, getQuoteDetail } from '../api/quotes';
import { createDocument } from '../api/documents';
import BackButton from '../components/BackButton';
import PageHeader from '../components/PageHeader';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });

function emptyLine() {
  return { description: '', quantity: 1, unit_cost: 0 };
}

export default function DocumentEditor({ docType }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReceipt = docType === 'receipt';

  const [mode, setMode] = useState('blank');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(searchParams.get('projectId') || '');
  const [quotes, setQuotes] = useState([]);
  const [quotationId, setQuotationId] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([emptyLine()]);
  const [vatPercent, setVatPercent] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get('projectId')) setMode('project');
  }, [searchParams]);

  useEffect(() => {
    if (mode !== 'project' || !projectId) {
      setQuotes([]);
      return;
    }
    getProject(projectId).then((p) => {
      setClientName(p.client_name || '');
      setClientAddress(p.client_address || '');
      setClientContact(p.client_contact || '');
    });
    listQuotesForProject(projectId).then(setQuotes).catch(() => setQuotes([]));
  }, [mode, projectId]);

  const handleQuotationSelect = async (id) => {
    setQuotationId(id);
    if (!id) return;
    const quote = await getQuoteDetail(id);
    setItems(
      quote.items.map((i) => ({
        description: i.name,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      }))
    );
    if (isReceipt) setAmountPaid(quote.grand_total);
  };

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));
  const addItem = () => setItems((prev) => [...prev, emptyLine()]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0),
    [items]
  );
  const vatAmount = useMemo(() => (subtotal * Number(vatPercent || 0)) / 100, [subtotal, vatPercent]);
  const grandTotal = subtotal + vatAmount;
  const balance = Math.max(grandTotal - Number(amountPaid || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setError('Add at least one item with a description and quantity.');
      return;
    }
    setSubmitting(true);
    try {
      const doc = await createDocument({
        type: docType,
        project_id: mode === 'project' ? projectId || null : null,
        quotation_id: mode === 'project' ? quotationId || null : null,
        client_name: clientName,
        client_address: clientAddress,
        client_contact: clientContact,
        issue_date: issueDate,
        items: validItems,
        vat_percent: Number(vatPercent) || 0,
        amount_paid: Number(amountPaid) || 0,
        notes,
      });
      navigate(isReceipt ? '/receipts' : '/invoices', { state: { createdId: doc.id } });
    } catch (err) {
      setError(err.response?.data?.error || `Failed to create ${docType}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo={isReceipt ? '/receipts' : '/invoices'} label={`Back to ${isReceipt ? 'Receipts' : 'Invoices'}`} />
        <PageHeader
          icon={isReceipt ? IconReceipt2 : IconFileInvoice}
          title={`New ${isReceipt ? 'Receipt' : 'Invoice'}`}
          subtitle={isReceipt ? 'Confirm a payment already received.' : 'Bill a client for goods or services.'}
        />
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form className="panel" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="mode" checked={mode === 'blank'} onChange={() => setMode('blank')} /> Blank document
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="mode" checked={mode === 'project'} onChange={() => setMode('project')} /> From a project
          </label>
        </div>

        {mode === 'project' && (
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <label>
              Project
              <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setQuotationId(''); }}>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>
              Quotation (optional — prefills items)
              <select value={quotationId} onChange={(e) => handleQuotationSelect(e.target.value)} disabled={!projectId}>
                <option value="">No quotation — enter items manually</option>
                {quotes.map((q) => <option key={q.id} value={q.id}>{q.title || `Option ${q.option_number}`} — {currency.format(q.grand_total)}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="form-grid" style={{ marginBottom: 16 }}>
          <label>Client Name<input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></label>
          <label>Client Address<input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></label>
          <label>Client Contact<input value={clientContact} onChange={(e) => setClientContact(e.target.value)} /></label>
          <label>Issue Date<input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required /></label>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th><th /></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td><input value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} placeholder="Item / description" /></td>
                  <td><input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} style={{ width: 80 }} /></td>
                  <td><input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(e) => updateItem(index, { unit_cost: e.target.value })} style={{ width: 120 }} /></td>
                  <td>{currency.format(Number(item.quantity || 0) * Number(item.unit_cost || 0))}</td>
                  <td>
                    <button type="button" className="icon-btn" aria-label="Remove item" onClick={() => removeItem(index)} disabled={items.length === 1}>
                      <IconTrash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: 8 }}>
          <IconPlus size={14} /> Add Item
        </button>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <label>VAT %<input type="number" min="0" step="0.01" value={vatPercent} onChange={(e) => setVatPercent(e.target.value)} /></label>
          <label>{isReceipt ? 'Amount Paid' : 'Amount Paid So Far (optional)'}<input type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} /></label>
          <label className="span-2">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></label>
        </div>

        <div style={{ marginLeft: 'auto', width: 280, marginTop: 16, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Subtotal</span><span>{currency.format(subtotal)}</span></div>
          {Number(vatPercent) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>VAT ({vatPercent}%)</span><span>{currency.format(vatAmount)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 700 }}><span>Grand Total</span><span>{currency.format(grandTotal)}</span></div>
          {!isReceipt && balance > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 700, color: 'var(--btn-primary-bg)' }}><span>Balance Remaining</span><span>{currency.format(balance)}</span></div>}
        </div>

        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : `Save ${isReceipt ? 'Receipt' : 'Invoice'}`}
          </button>
        </div>
      </form>
    </div>
  );
}

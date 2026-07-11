import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { getProject } from '../api/projects';
import { getQuoteDetail, createQuote, updateQuote, listQuotesForProject } from '../api/quotes';
import { listProducts } from '../api/products';
import BackButton from '../components/BackButton';

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 2,
});

function emptyLine() {
  return { product_id: '', name: '', quantity: 1, quantity_label: '', unit_cost: 0 };
}

export default function QuoteEditor() {
  const { projectId, quoteId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(quoteId);

  const [project, setProject] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [optionNumber, setOptionNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [powerDescription, setPowerDescription] = useState('');
  const [markupPercent, setMarkupPercent] = useState(0);
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [effectiveProjectId, setEffectiveProjectId] = useState(projectId);

  useEffect(() => {
    setLoading(true);
    listProducts()
      .then(setCatalog)
      .catch(() => {});

    if (isEditing) {
      getQuoteDetail(quoteId)
        .then((quote) => {
          setEffectiveProjectId(quote.project_id);
          setOptionNumber(quote.option_number);
          setTitle(quote.title || '');
          setPowerDescription(quote.power_description || '');
          setMarkupPercent(quote.markup_percent);
          setLines(
            quote.items.map((item) => ({
              product_id: item.product_id || '',
              name: item.name,
              quantity: item.quantity,
              quantity_label: item.quantity_label || '',
              unit_cost: item.unit_cost,
            }))
          );
          return getProject(quote.project_id);
        })
        .then(setProject)
        .catch(() => setError('Failed to load quotation.'))
        .finally(() => setLoading(false));
    } else {
      Promise.all([getProject(projectId), listQuotesForProject(projectId)])
        .then(([projectData, existingQuotes]) => {
          setProject(projectData);
          setOptionNumber(existingQuotes.length + 1);
          setTitle(`Option ${existingQuotes.length + 1}`);
        })
        .catch(() => setError('Failed to load project.'))
        .finally(() => setLoading(false));
    }
  }, [projectId, quoteId, isEditing]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0),
    [lines]
  );
  const grandTotal = useMemo(
    () => subtotal + (subtotal * Number(markupPercent || 0)) / 100,
    [subtotal, markupPercent]
  );

  const updateLine = (index, patch) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const handleCatalogSelect = (index, productId) => {
    const catalogItem = catalog.find((c) => c.id === productId);
    updateLine(index, {
      product_id: productId,
      name: catalogItem ? catalogItem.model : '',
      unit_cost: catalogItem ? catalogItem.unit_cost : 0,
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      project_id: effectiveProjectId,
      option_number: Number(optionNumber),
      title,
      power_description: powerDescription,
      markup_percent: Number(markupPercent),
      items: lines.map((l) => ({
        product_id: l.product_id || null,
        name: l.name,
        quantity: Number(l.quantity || 0),
        quantity_label: l.quantity_label || null,
        unit_cost: Number(l.unit_cost || 0),
      })),
    };

    try {
      if (isEditing) {
        await updateQuote(quoteId, payload);
      } else {
        await createQuote(payload);
      }
      navigate(`/projects/${effectiveProjectId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save quotation.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div>
      <BackButton fallback={`/projects/${effectiveProjectId}`} label="Back to Project" />
      <h1 className="page-title">
        {isEditing ? 'Edit Quotation' : 'New Quotation Option'} {project ? `- ${project.name}` : ''}
      </h1>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel form-grid">
          <label>
            Option Number
            <input type="number" min="1" value={optionNumber} onChange={(e) => setOptionNumber(e.target.value)} required />
          </label>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Solar System Set Up" />
          </label>
          <label>
            Markup (%)
            <input type="number" min="0" step="0.1" value={markupPercent} onChange={(e) => setMarkupPercent(e.target.value)} />
          </label>
          <label className="span-2">
            This option will power (one item per line)
            <textarea
              rows={4}
              value={powerDescription}
              onChange={(e) => setPowerDescription(e.target.value)}
              placeholder={'5 Industrial Fans\n4 Double-Chest Freezers\n1 Borehole'}
            />
          </label>
        </div>

        <div className="panel">
          <div className="page-header-row">
            <h2>Line Items</h2>
            <button type="button" className="btn btn-secondary" onClick={addLine}>
              <IconPlus size={16} /> Add Item
            </button>
          </div>

          <table className="editor-table">
            <thead>
              <tr>
                <th>Catalog Product</th>
                <th>Name</th>
                <th>Quantity</th>
                <th>Display Qty (e.g. "15KVA", "LOTS")</th>
                <th>Unit Cost</th>
                <th>Line Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td>
                    <select value={line.product_id} onChange={(e) => handleCatalogSelect(index, e.target.value)}>
                      <option value="">Custom</option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.model}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={line.name} onChange={(e) => updateLine(index, { name: e.target.value })} required />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={line.quantity_label}
                      onChange={(e) => updateLine(index, { quantity_label: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_cost}
                      onChange={(e) => updateLine(index, { unit_cost: e.target.value })}
                    />
                  </td>
                  <td>{currency.format(Number(line.quantity || 0) * Number(line.unit_cost || 0))}</td>
                  <td>
                    <button type="button" className="icon-btn" onClick={() => removeLine(index)} aria-label="Remove line">
                      <IconTrash size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals-summary">
            <div>
              Subtotal (internal cost): <strong>{currency.format(subtotal)}</strong>
            </div>
            <div>
              Markup: <strong>{markupPercent}%</strong>
            </div>
            <div className="grand-total">
              Grand Total: <strong>{currency.format(grandTotal)}</strong>
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Quotation'}
        </button>
      </form>
    </div>
  );
}

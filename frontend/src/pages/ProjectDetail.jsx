import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  IconPlus,
  IconDownload,
  IconHistory,
  IconFilePlus,
  IconCheck,
  IconLock,
  IconUsers,
  IconBoxSeam,
  IconReceipt2,
  IconCash,
} from '@tabler/icons-react';
import { getProject, downloadProposalPdf, addProjectEngineer, addProjectMaterial, addProjectCost } from '../api/projects';
import { listQuotesForProject, downloadQuotePdf, selectQuote } from '../api/quotes';
import { listProducts } from '../api/products';
import { listPaymentPlansForProject, createPaymentPlan, payMilestone, logUsagePeriod, payUsagePeriod } from '../api/payments';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import BackButton from '../components/BackButton';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const TABS = ['Overview', 'Quotations', 'Payments', 'Materials', 'Engineers', 'Costs'];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [project, setProject] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([getProject(projectId), listQuotesForProject(projectId), listPaymentPlansForProject(projectId), listProducts()])
      .then(([projectData, quotesData, plansData, productsData]) => {
        setProject(projectData);
        setQuotes(quotesData);
        setPlans(plansData);
        setProducts(productsData);
      })
      .catch(() => setError('Failed to load project details.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId]);

  const runAction = async (id, fn) => {
    setError('');
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="page-loading">Loading project...</div>;
  if (error && !project) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!project) return null;

  const canQuote = project.status === 'prospect' || isSuperAdmin;
  const plan = plans[0];

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton fallback="/projects" label="Back to Projects" />
        <PageHeader
          title={project.name}
          subtitle={project.client_name}
          actions={
            <div className="btn-group">
              {quotes.length > 0 && (
                <button className="btn btn-secondary" onClick={() => downloadProposalPdf(project.id)}>
                  <IconDownload size={18} /> Full Proposal PDF
                </button>
              )}
              {canQuote && (
                <Link className="btn btn-primary" to={`/projects/${project.id}/quotes/new`}>
                  <IconPlus size={18} /> New Option
                </Link>
              )}
            </div>
          }
        />
      </div>

      <div className="quote-option-flags" style={{ marginBottom: 16 }}>
        <StatusBadge type="projectStatus" value={project.status} />
        {project.business_model && <StatusBadge type="businessModel" value={project.business_model} />}
        {project.payment_category && <StatusBadge type="paymentCategory" value={project.payment_category} />}
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="tab-row" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="panel">
          <h2>Client Details</h2>
          <dl className="detail-list">
            <dt>Client</dt><dd>{project.client_name || '-'}</dd>
            <dt>Address</dt><dd>{project.client_address || '-'}</dd>
            <dt>Contact</dt><dd>{project.client_contact || '-'}</dd>
            <dt>Manager</dt><dd>{project.manager || '-'}</dd>
            <dt>Sector</dt><dd>{project.sector || '-'}</dd>
            <dt>System Size</dt><dd>{project.system_size_kwp ? `${project.system_size_kwp} kWp` : '-'}</dd>
            <dt>Description</dt><dd>{project.description || '-'}</dd>
            <dt>Materials Cost</dt><dd>{currency.format(project.materials_cost || 0)}</dd>
            <dt>Other Costs</dt><dd>{currency.format(project.other_costs || 0)}</dd>
          </dl>
        </div>
      )}

      {tab === 'Quotations' && (
        <div className="panel">
          <h2>Quotation Options</h2>
          {!canQuote && (
            <div className="alert alert-error" role="status">
              <IconLock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Quoting is locked — this project has moved past prospect. Only a super admin can edit the selected quote now.
            </div>
          )}
          <div className="quote-option-grid">
            {quotes.map((q) => (
              <div className={`quote-option-card ${q.is_selected ? 'selected' : ''}`} key={q.id}>
                <div className="quote-option-header">
                  <span className="option-badge">OPTION {q.option_number}</span>
                  <StatusBadge type="quoteStatus" value={q.status} />
                </div>
                <h3>{q.title}</h3>
                <p className="quote-total">{currency.format(q.grand_total)}</p>
                <p className="quote-markup">Markup: {q.markup_percent}%</p>

                <div className="quote-option-flags">
                  {Boolean(q.is_selected) && <StatusBadge type="paymentStatus" value="active" />}
                  {q.payment_status === 'paid' && <StatusBadge type="paymentStatus" value="paid" />}
                </div>

                {(project.status === 'prospect' || isSuperAdmin) && (
                  <div className="quote-option-admin-actions">
                    {!q.is_selected ? (
                      <button className="btn btn-secondary btn-sm" disabled={busyId === q.id} onClick={() => runAction(q.id, () => selectQuote(q.id, true))}>
                        <IconCheck size={14} /> Mark Selected
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" disabled={busyId === q.id} onClick={() => runAction(q.id, () => selectQuote(q.id, false))}>
                        Unselect
                      </button>
                    )}
                  </div>
                )}

                <div className="quote-option-actions">
                  {(project.status === 'prospect' || isSuperAdmin) && <Link to={`/quotes/${q.id}/edit`}>Edit</Link>}
                  <Link to={`/quotes/${q.id}/history`}><IconHistory size={16} /> History</Link>
                  <button onClick={() => downloadQuotePdf(q.id)}><IconDownload size={16} /> PDF</button>
                </div>
              </div>
            ))}
            {quotes.length === 0 && (
              <EmptyState icon={IconFilePlus} title="No quotation options yet" description="Create the first variation for this project." />
            )}
          </div>
        </div>
      )}

      {tab === 'Payments' && (
        <PaymentsTab
          project={project}
          quotes={quotes}
          plan={plan}
          busyId={busyId}
          onCreatePlan={(payload) => runAction('plan', () => createPaymentPlan(payload))}
          onPayMilestone={(id) => runAction(id, () => payMilestone(id))}
          onLogUsage={(planId, payload) => runAction(planId, () => logUsagePeriod(planId, payload))}
          onPayUsage={(id) => runAction(id, () => payUsagePeriod(id))}
        />
      )}

      {tab === 'Materials' && (
        <MaterialsTab
          project={project}
          products={products}
          onAdd={(payload) => runAction('material', () => addProjectMaterial(project.id, payload))}
        />
      )}

      {tab === 'Engineers' && (
        <EngineersTab
          project={project}
          onAdd={(payload) => runAction('engineer', () => addProjectEngineer(project.id, payload))}
        />
      )}

      {tab === 'Costs' && (
        <CostsTab
          project={project}
          onAdd={(payload) => runAction('cost', () => addProjectCost(project.id, payload))}
        />
      )}
    </div>
  );
}

function PaymentsTab({ project, quotes, plan, busyId, onCreatePlan, onPayMilestone, onLogUsage, onPayUsage }) {
  const selectedQuote = quotes.find((q) => q.is_selected);
  const [depositPercent, setDepositPercent] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [frequency, setFrequency] = useState('month');
  const [usageForm, setUsageForm] = useState({ period_start: '', period_end: '', units_consumed: '', rate_per_unit: '' });

  if (!plan) {
    if (project.status !== 'quote_accepted') {
      return (
        <EmptyState
          icon={IconReceipt2}
          title="No payment plan yet"
          description="A payment plan can be created once a quotation option has been selected."
        />
      );
    }
    return (
      <div className="panel">
        <h2>Create Payment Plan</h2>
        <p className="page-subtitle">Category: <StatusBadge type="paymentCategory" value={project.payment_category} /> — total {currency.format(selectedQuote?.grand_total || 0)}</p>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            onCreatePlan({
              project_id: project.id,
              quotation_id: selectedQuote.id,
              deposit_percent: Number(depositPercent),
              installment_count: Number(installmentCount),
              frequency,
            });
          }}
        >
          <label>
            Deposit %
            <input type="number" min="0" max="100" value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} />
          </label>
          {project.payment_category === 'installments' && (
            <>
              <label>
                Number of Installments
                <input type="number" min="1" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
              </label>
              <label>
                Frequency
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </label>
            </>
          )}
          <div className="span-2">
            <button type="submit" className="btn btn-primary" disabled={busyId === 'plan'}>Create Payment Plan</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Payment Plan — {currency.format(plan.total_amount)}</h2>
      <div className="quote-option-flags" style={{ marginBottom: 12 }}>
        <StatusBadge type="paymentCategory" value={plan.category} />
        <StatusBadge type="paymentStatus" value={plan.status} />
      </div>

      {plan.milestones.length > 0 && (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Label</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {plan.milestones.map((m) => (
                <tr key={m.id}>
                  <td>{m.label}</td>
                  <td>{m.due_date || 'On completion'}</td>
                  <td>{currency.format(m.amount)}</td>
                  <td><StatusBadge type="paymentStatus" value={m.status} /></td>
                  <td>
                    {m.status === 'pending' && (
                      <button className="btn btn-secondary btn-sm" disabled={busyId === m.id} onClick={() => onPayMilestone(m.id)}>
                        <IconCash size={14} /> Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan.category === 'pay_as_you_go' && (
        <>
          <h3 style={{ marginTop: 20 }}>Usage Billing</h3>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              onLogUsage(plan.id, {
                ...usageForm,
                units_consumed: Number(usageForm.units_consumed),
                rate_per_unit: Number(usageForm.rate_per_unit),
              });
              setUsageForm({ period_start: '', period_end: '', units_consumed: '', rate_per_unit: '' });
            }}
          >
            <label>Period Start<input type="date" required value={usageForm.period_start} onChange={(e) => setUsageForm({ ...usageForm, period_start: e.target.value })} /></label>
            <label>Period End<input type="date" required value={usageForm.period_end} onChange={(e) => setUsageForm({ ...usageForm, period_end: e.target.value })} /></label>
            <label>Units Consumed<input type="number" min="0" step="0.01" required value={usageForm.units_consumed} onChange={(e) => setUsageForm({ ...usageForm, units_consumed: e.target.value })} /></label>
            <label>Rate per Unit<input type="number" min="0" step="0.01" required value={usageForm.rate_per_unit} onChange={(e) => setUsageForm({ ...usageForm, rate_per_unit: e.target.value })} /></label>
            <div className="span-2"><button type="submit" className="btn btn-secondary">Log Usage Period</button></div>
          </form>

          {plan.usage_periods.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Period</th><th>Units</th><th>Rate</th><th>Amount Due</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {plan.usage_periods.map((p) => (
                    <tr key={p.id}>
                      <td>{p.period_start} → {p.period_end}</td>
                      <td>{p.units_consumed}</td>
                      <td>{currency.format(p.rate_per_unit)}</td>
                      <td>{currency.format(p.amount_due)}</td>
                      <td><StatusBadge type="paymentStatus" value={p.status} /></td>
                      <td>
                        {p.status === 'pending' && (
                          <button className="btn btn-secondary btn-sm" disabled={busyId === p.id} onClick={() => onPayUsage(p.id)}>
                            <IconCash size={14} /> Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MaterialsTab({ project, products, onAdd }) {
  const [form, setForm] = useState({ product_id: '', quantity: '' });
  const { page, setPage, totalPages, paginated } = usePagination(project.materials || [], 10);
  return (
    <div className="panel">
      <h2>Materials Used</h2>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onAdd({ ...form, quantity: Number(form.quantity) }); setForm({ product_id: '', quantity: '' }); }}>
        <label>
          Product
          <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.model}</option>)}
          </select>
        </label>
        <label>Quantity<input type="number" min="0" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
        <div className="span-2"><button type="submit" className="btn btn-secondary">Log Material</button></div>
      </form>
      {project.materials?.length > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Cost</th></tr></thead>
            <tbody>
              {paginated.map((m) => (
                <tr key={m.id}><td>{m.date}</td><td>{m.product_name}</td><td>{m.quantity} {m.unit}</td><td>{currency.format(m.quantity * m.unit_cost)}</td></tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : (
        <EmptyState icon={IconBoxSeam} title="No materials logged yet" />
      )}
    </div>
  );
}

function EngineersTab({ project, onAdd }) {
  const [form, setForm] = useState({ name: '', role: '' });
  const { page, setPage, totalPages, paginated } = usePagination(project.engineers || [], 10);
  return (
    <div className="panel">
      <h2>Engineers Assigned</h2>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onAdd(form); setForm({ name: '', role: '' }); }}>
        <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Role<input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></label>
        <div className="span-2"><button type="submit" className="btn btn-secondary">Assign Engineer</button></div>
      </form>
      {project.engineers?.length > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Role</th><th>Assigned</th><th>Completed</th></tr></thead>
            <tbody>
              {paginated.map((e) => (
                <tr key={e.id}><td>{e.name}</td><td>{e.role || '-'}</td><td>{e.date_assigned || '-'}</td><td>{e.date_completed || '-'}</td></tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : (
        <EmptyState icon={IconUsers} title="No engineers assigned yet" />
      )}
    </div>
  );
}

function CostsTab({ project, onAdd }) {
  const [form, setForm] = useState({ item_name: '', cost: '', notes: '' });
  const { page, setPage, totalPages, paginated } = usePagination(project.costs || [], 10);
  return (
    <div className="panel">
      <h2>Other Project Costs</h2>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onAdd({ ...form, cost: Number(form.cost) }); setForm({ item_name: '', cost: '', notes: '' }); }}>
        <label>Item Name<input required value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} /></label>
        <label>Cost<input type="number" min="0" step="0.01" required value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label>
        <label className="span-2">Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <div className="span-2"><button type="submit" className="btn btn-secondary">Log Cost</button></div>
      </form>
      {project.costs?.length > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Item</th><th>Cost</th><th>Notes</th></tr></thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id}><td>{c.item_name}</td><td>{currency.format(c.cost)}</td><td>{c.notes || '-'}</td></tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : (
        <EmptyState icon={IconReceipt2} title="No other costs logged yet" />
      )}
    </div>
  );
}

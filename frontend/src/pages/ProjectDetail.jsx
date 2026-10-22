import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
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
  IconFileInvoice,
  IconCash,
  IconEdit,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  getProject,
  updateProject,
  downloadProposalPdf,
  addProjectEngineer,
  addPlannedProjectMaterial,
  updatePlannedProjectMaterial,
  deletePlannedProjectMaterial,
  addProjectCost,
  deleteProject,
  requestDeleteProject,
  cancelDeleteProjectRequest,
  approveDeleteProject,
} from '../api/projects';
import { listQuotesForProject, downloadQuotePdf, selectQuote } from '../api/quotes';
import { listPaymentPlansForProject, createPaymentPlan, payMilestone, logUsagePeriod, payUsagePeriod } from '../api/payments';
import { listProductStock } from '../api/products';
import { formatProductLabel } from '../utils/productLabel';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import BackButton from '../components/BackButton';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const TABS = ['Overview', 'Quotations', 'Payments', 'Materials', 'Engineers', 'Costs'];

const BUSINESS_MODEL_LABELS = {
  outright_purchase: 'Outright Purchase',
  eaas: 'EaaS',
  repair_service: 'Repair Service',
  maintenance_service: 'Maintenance Service',
  upgrade: 'Upgrade',
  direct_purchase: 'Direct Purchase',
  greenband_eaas: 'Greenband (EaaS)',
  upgrade_expansion: 'Upgrade / System Expansion',
  installation_only: 'Installation Only',
  maintenance_repair: 'Maintenance / Repair Service',
  other: 'Other',
};

const PAYMENT_CATEGORY_LABELS = {
  full_payment: 'Full Payment',
  installments: 'Installments',
  pay_as_you_go: 'Pay as you Go',
  one_time_payment: 'One-time Payment',
  instalment_payments: 'Instalment Payments',
  other: 'Other',
};

const SECTORS = [
  'Residential / Home',
  'Commercial / Business',
  'Healthcare',
  'Education',
  'Agriculture',
  'Industrial / Manufacturing',
  'Government',
  'Religious Organisation',
  'Other',
  'Residential',
  'Commercial',
  'Industrial',
  'Agricultural',
  'Telecom',
  'Street Lighting',
];

const EDITABLE_PROJECT_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PROJECT_STATUS_ALIASES = {
  prospect: 'not_started',
  quote_accepted: 'in_progress',
  on_going: 'in_progress',
  active_eaas: 'in_progress',
  rejected: 'cancelled',
};

const emptyEditForm = {
  name: '',
  client_name: '',
  client_address: '',
  client_contact: '',
  description: '',
  manager: '',
  business_model: '',
  payment_category: '',
  sector: '',
  status: 'not_started',
};

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isFinance = isSuperAdmin || user?.department === 'finance';
  const canEditProject = isSuperAdmin || (user?.role === 'admin' && user?.department === 'engineering');
  const [project, setProject] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [stock, setStock] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = (showLoading = true) => {
    if (showLoading) setLoading(true);
    Promise.all([
      getProject(projectId),
      isFinance ? listQuotesForProject(projectId) : Promise.resolve([]),
      isFinance ? listPaymentPlansForProject(projectId) : Promise.resolve([]),
      listProductStock(),
    ])
      .then(([projectData, quotesData, plansData, stockData]) => {
        setProject(projectData);
        setQuotes(quotesData);
        setPlans(plansData);
        setStock(stockData);
      })
      .catch(() => setError('Failed to load project details.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId, isFinance]);

  const handleDelete = async () => {
    setError('');
    try {
      await deleteProject(project.id);
      navigate('/projects');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete project.');
      setShowDeleteConfirm(false);
    }
  };

  const handleRequestDelete = () => runAction(project.id, () => requestDeleteProject(project.id));
  const handleCancelDeleteRequest = () => runAction(project.id, () => cancelDeleteProjectRequest(project.id));
  const handleApproveDelete = async (decision) => {
    setError('');
    try {
      await approveDeleteProject(project.id, decision);
      if (decision === 'Approved') navigate('/projects');
      else load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record decision.');
    }
  };

  const runAction = async (id, fn) => {
    setError('');
    setBusyId(id);
    try {
      await fn();
      load(false);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="page-loading">Loading project...</div>;
  if (error && !project) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!project) return null;

  const canQuote = isSuperAdmin;
  const plan = plans[0];

  const openEditModal = () => {
    setEditForm({
      name: project.name || '',
      client_name: project.client_name || '',
      client_address: project.client_address || '',
      client_contact: project.client_contact || '',
      description: project.description || '',
      manager: project.manager || '',
      business_model: project.business_model || '',
      payment_category: project.payment_category || '',
      sector: project.sector || '',
      status: PROJECT_STATUS_ALIASES[project.status] || project.status,
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => {
      const next = { ...prev, [name]: value };
      return next;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSubmitting(true);
    try {
      await updateProject(project.id, {
        ...editForm,
        business_model: editForm.business_model || null,
        payment_category: editForm.payment_category || null,
        sector: editForm.sector || null,
      });
      setShowEditModal(false);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update project.');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton fallback="/projects" label="Back to Projects" />
        <PageHeader
          title={project.name}
          subtitle={project.client_name}
          actions={
            <div className="btn-group">
              {canEditProject && (
                <button type="button" className="btn btn-secondary" onClick={openEditModal}>
                  <IconEdit size={18} /> Edit Project
                </button>
              )}
              {quotes.length > 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => downloadProposalPdf(project.id)}>
                  <IconDownload size={18} /> Full Proposal PDF
                </button>
              )}
              {canQuote && (
                <Link className="btn btn-primary" to={`/projects/${project.id}/quotes/new`}>
                  <IconPlus size={18} /> New Option
                </Link>
              )}
              {isFinance && (
                <>
                  <Link className="btn btn-secondary" to={`/invoices/new?projectId=${project.id}`}>
                    <IconFileInvoice size={18} /> New Invoice
                  </Link>
                  <Link className="btn btn-secondary" to={`/receipts/new?projectId=${project.id}`}>
                    <IconReceipt2 size={18} /> New Receipt
                  </Link>
                </>
              )}
              {canEditProject && !project.deletion_requested_by && (
                isSuperAdmin ? (
                  <button type="button" className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                    <IconTrash size={18} /> Delete
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary" onClick={handleRequestDelete}>
                    <IconTrash size={18} /> Request Delete
                  </button>
                )
              )}
            </div>
          }
        />
      </div>

      {location.state?.success && <div className="alert alert-success" role="status">{location.state.success}</div>}

      {project.project_ref && <p className="project-reference-detail">Project Reference: <strong>{project.project_ref}</strong></p>}

      <div className="quote-option-flags" style={{ marginBottom: 16 }}>
        <StatusBadge type="projectStatus" value={project.status} />
        {project.business_model && <StatusBadge type="businessModel" value={project.business_model} />}
        {project.payment_category && <StatusBadge type="paymentCategory" value={project.payment_category} />}
      </div>

      {project.deletion_requested_by && (
        <div className="alert alert-warning" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>A deletion request is pending for this project.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEditProject && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancelDeleteRequest}>Cancel Request</button>
            )}
            {isSuperAdmin && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleApproveDelete('Approved')}><IconCheck size={14} /> Approve Delete</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleApproveDelete('Rejected')}><IconX size={14} /> Reject</button>
              </>
            )}
          </div>
        </div>
      )}

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="tab-row" role="tablist">
        {TABS.filter((t) => {
          if (isSuperAdmin) return true;
          if (isFinance) return ['Overview', 'Quotations', 'Payments'].includes(t);
          return !['Payments', 'Quotations'].includes(t);
        }).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="panel">
          <h2>Project Information</h2>
          <dl className="detail-list">
            <dt>Client Name</dt><dd>{project.client_name || '-'}</dd>
            <dt>Site Address</dt><dd>{project.client_address || '-'}</dd>
            <dt>Project Contact</dt><dd>{project.client_contact || '-'}</dd>
            <dt>Project Manager</dt><dd>{project.manager || '-'}</dd>
            <dt>Sector</dt><dd>{project.sector || '-'}</dd>
            <dt>Business Model</dt><dd>{project.business_model ? BUSINESS_MODEL_LABELS[project.business_model] || project.business_model : '-'}</dd>
            <dt>Payment Type</dt><dd>{project.payment_category ? PAYMENT_CATEGORY_LABELS[project.payment_category] || project.payment_category : '-'}</dd>
            <dt>Description</dt><dd>{project.description || '-'}</dd>
            <dt>Date Created</dt><dd>{project.created_at ? new Date(project.created_at).toLocaleDateString() : '-'}</dd>
          </dl>
        </div>
      )}

      {tab === 'Quotations' && (
        <div className="panel">
          <h2>Quotation Options</h2>
          {!canQuote && (
            <div className="alert alert-error" role="status">
              <IconLock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {isFinance
                ? 'Finance can review quotation options; quotation changes are managed by Super Admin.'
                : 'Quoting is locked — only a super admin can edit quotation options.'}
            </div>
          )}
          <div className="quote-option-grid">
            {quotes.map((quote) => (
              <div className={`quote-option-card ${quote.is_selected ? 'selected' : ''}`} key={quote.id}>
                <div className="quote-option-header">
                  <span className="option-badge">OPTION {quote.option_number}</span>
                  <StatusBadge type="quoteStatus" value={quote.status} />
                </div>
                <h3>{quote.title}</h3>
                <p className="quote-total">{currency.format(quote.grand_total)}</p>
                <p className="quote-markup">Markup: {quote.markup_percent}%</p>
                <div className="quote-option-flags">
                  {Boolean(quote.is_selected) && <StatusBadge type="paymentStatus" value="active" />}
                  {quote.payment_status === 'paid' && <StatusBadge type="paymentStatus" value="paid" />}
                </div>
                {isSuperAdmin && (
                  <div className="quote-option-admin-actions">
                    {!quote.is_selected ? (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === quote.id} onClick={() => runAction(quote.id, () => selectQuote(quote.id, true))}>
                        <IconCheck size={14} /> Mark Selected
                      </button>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === quote.id} onClick={() => runAction(quote.id, () => selectQuote(quote.id, false))}>
                        Unselect
                      </button>
                    )}
                  </div>
                )}
                <div className="quote-option-actions">
                  {isSuperAdmin && <Link to={`/quotes/${quote.id}/edit`}>Edit</Link>}
                  {isSuperAdmin && <Link to={`/quotes/${quote.id}/history`}><IconHistory size={16} /> History</Link>}
                  <button type="button" onClick={() => downloadQuotePdf(quote.id)}><IconDownload size={16} /> PDF</button>
                </div>
              </div>
            ))}
            {quotes.length === 0 && (
              <EmptyState icon={IconFilePlus} title="No quotation options yet" description={canQuote ? 'Create the first variation for this project.' : 'No quotations have been created for this project.'} />
            )}
          </div>
        </div>
      )}

      {tab === 'Payments' && isFinance && (
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
          stock={stock}
          canEdit={canEditProject}
          onAdd={(payload) => runAction('material-plan', () => addPlannedProjectMaterial(project.id, payload))}
          onUpdate={(materialId, payload) => runAction(materialId, () => updatePlannedProjectMaterial(project.id, materialId, payload))}
          onDelete={(materialId) => runAction(materialId, () => deletePlannedProjectMaterial(project.id, materialId))}
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

      {showEditModal && (
        <div className="dialog-overlay">
          <div className="dialog-card wide" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
            <div className="dialog-header-row">
              <h2 className="dialog-title" id="edit-project-title">Edit Project</h2>
              <button type="button" className="icon-btn" onClick={() => setShowEditModal(false)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            {editError && <div className="alert alert-error" role="alert">{editError}</div>}
            <form className="form-grid" onSubmit={handleEditSubmit}>
              <label>
                Project Name
                <input name="name" value={editForm.name} onChange={handleEditChange} required />
              </label>
              <label>
                Client Name
                <input name="client_name" value={editForm.client_name} onChange={handleEditChange} />
              </label>
              <label>
                Site Address
                <input name="client_address" value={editForm.client_address} onChange={handleEditChange} />
              </label>
              <label>
                Project Contact <span className="field-hint">(optional)</span>
                <input name="client_contact" value={editForm.client_contact} onChange={handleEditChange} />
              </label>
              <label>
                Project Manager
                <input name="manager" value={editForm.manager} onChange={handleEditChange} />
              </label>
              <label>
                Sector
                <select name="sector" value={editForm.sector} onChange={handleEditChange}>
                  <option value="">Select sector</option>
                  {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Project Status
                <select name="status" value={editForm.status} onChange={handleEditChange}>
                  {EDITABLE_PROJECT_STATUSES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                Business Model
                <select name="business_model" value={editForm.business_model} onChange={handleEditChange}>
                  <option value="">Select business model</option>
                  {Object.entries(BUSINESS_MODEL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Payment Type
                <select name="payment_category" value={editForm.payment_category} onChange={handleEditChange}>
                  <option value="">Select payment type</option>
                  {Object.entries(PAYMENT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="span-2">
                Description
                <textarea name="description" value={editForm.description} onChange={handleEditChange} rows={3} />
              </label>
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete project?"
        body={`This will permanently remove "${project.name}" and all of its quotations, materials, and costs.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function PaymentsTab({ project, quotes, plan, busyId, onCreatePlan, onPayMilestone, onLogUsage, onPayUsage }) {
  const selectedQuote = quotes.find((quote) => quote.is_selected);
  const [depositPercent, setDepositPercent] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [frequency, setFrequency] = useState('month');
  const [usageForm, setUsageForm] = useState({ period_start: '', period_end: '', units_consumed: '', rate_per_unit: '' });

  if (!plan) {
    if (!['full_payment', 'one_time_payment', 'installments', 'instalment_payments', 'pay_as_you_go'].includes(project.payment_category)) {
      return (
        <EmptyState
          icon={IconReceipt2}
          title="Custom payment arrangement"
          description="This payment type does not have an automated payment-plan schedule."
        />
      );
    }
    if (project.status !== 'quote_accepted') {
      return (
        <EmptyState
          icon={IconReceipt2}
          title="No payment plan yet"
          description="A payment plan can be created once a quotation option has been selected."
        />
      );
    }
    if (!selectedQuote) {
      return (
        <EmptyState
          icon={IconReceipt2}
          title="No selected quotation"
          description="Select a quotation option before creating a payment plan."
        />
      );
    }
    return (
      <div className="panel">
        <h2>Create Payment Plan</h2>
        <p className="page-subtitle">Category: <StatusBadge type="paymentCategory" value={project.payment_category} /> — total {currency.format(selectedQuote.grand_total || 0)}</p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
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
            <input type="number" min="0" max="100" value={depositPercent} onChange={(event) => setDepositPercent(event.target.value)} />
          </label>
          {project.payment_category === 'installments' && (
            <>
              <label>
                Number of Installments
                <input type="number" min="1" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} />
              </label>
              <label>
                Frequency
                <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
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
      {plan.milestones?.length > 0 && (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Label</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {plan.milestones.map((milestone) => (
                <tr key={milestone.id}>
                  <td>{milestone.label}</td>
                  <td>{milestone.due_date || 'On completion'}</td>
                  <td>{currency.format(milestone.amount)}</td>
                  <td><StatusBadge type="paymentStatus" value={milestone.status} /></td>
                  <td>
                    {milestone.status === 'pending' && (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === milestone.id} onClick={() => onPayMilestone(milestone.id)}>
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
            onSubmit={(event) => {
              event.preventDefault();
              onLogUsage(plan.id, {
                ...usageForm,
                units_consumed: Number(usageForm.units_consumed),
                rate_per_unit: Number(usageForm.rate_per_unit),
              });
              setUsageForm({ period_start: '', period_end: '', units_consumed: '', rate_per_unit: '' });
            }}
          >
            <label>Period Start<input type="date" required value={usageForm.period_start} onChange={(event) => setUsageForm({ ...usageForm, period_start: event.target.value })} /></label>
            <label>Period End<input type="date" required value={usageForm.period_end} onChange={(event) => setUsageForm({ ...usageForm, period_end: event.target.value })} /></label>
            <label>Units Consumed<input type="number" min="0" step="0.01" required value={usageForm.units_consumed} onChange={(event) => setUsageForm({ ...usageForm, units_consumed: event.target.value })} /></label>
            <label>Rate per Unit<input type="number" min="0" step="0.01" required value={usageForm.rate_per_unit} onChange={(event) => setUsageForm({ ...usageForm, rate_per_unit: event.target.value })} /></label>
            <div className="span-2"><button type="submit" className="btn btn-secondary">Log Usage Period</button></div>
          </form>
          {plan.usage_periods?.length > 0 && (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Period</th><th>Units</th><th>Rate</th><th>Amount Due</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {plan.usage_periods.map((period) => (
                    <tr key={period.id}>
                      <td>{period.period_start} → {period.period_end}</td>
                      <td>{period.units_consumed}</td>
                      <td>{currency.format(period.rate_per_unit)}</td>
                      <td>{currency.format(period.amount_due)}</td>
                      <td><StatusBadge type="paymentStatus" value={period.status} /></td>
                      <td>
                        {period.status === 'pending' && (
                          <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === period.id} onClick={() => onPayUsage(period.id)}>
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

function MaterialsTab({ project, stock, canEdit, onAdd, onUpdate, onDelete }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '' });
  const [formError, setFormError] = useState('');
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editForm, setEditForm] = useState({ product_id: '', quantity: '' });
  const [saving, setSaving] = useState(false);
  const plannedMaterials = project.planned_materials || [];

  const handleAdd = async (event) => {
    event.preventDefault();
    setFormError('');
    const quantity = Number(form.quantity);
    if (!form.product_id || !Number.isFinite(quantity) || quantity <= 0) {
      setFormError('Select a product and enter a quantity greater than zero.');
      return;
    }
    setSaving(true);
    const success = await onAdd({ product_id: form.product_id, quantity });
    if (success) {
      setForm({ product_id: '', quantity: '' });
      setShowAddForm(false);
    }
    setSaving(false);
  };

  const startEdit = (material) => {
    setEditingMaterial(material.id);
    setEditForm({ product_id: material.product_id, quantity: String(material.quantity) });
    setFormError('');
  };

  const handleUpdate = async (materialId) => {
    setFormError('');
    const quantity = Number(editForm.quantity);
    if (!editForm.product_id || !Number.isFinite(quantity) || quantity <= 0) {
      setFormError('Select a product and enter a quantity greater than zero.');
      return;
    }
    setSaving(true);
    const success = await onUpdate(materialId, { product_id: editForm.product_id, quantity });
    if (success) setEditingMaterial(null);
    setSaving(false);
  };

  const handleDelete = async (materialId) => {
    setSaving(true);
    await onDelete(materialId);
    setSaving(false);
  };

  return (
    <section className="panel project-materials-panel">
      <div className="project-section-heading">
        <div>
          <h2>Planned Materials</h2>
          <p className="page-subtitle">Planned quantities do not change inventory. Record actual stock issues through Stock Movements.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAddForm((visible) => !visible)}>
            <IconPlus size={18} /> {showAddForm ? 'Close' : 'Add Materials'}
          </button>
        )}
      </div>

      {formError && <div className="alert alert-error" role="alert">{formError}</div>}

      {showAddForm && (
        <form className="form-grid planned-material-form" onSubmit={handleAdd}>
          <label>
            Inventory Product
            <select required value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })}>
              <option value="">Select product</option>
              {stock.map((product) => (
                <option key={product.id} value={product.id}>
                  {formatProductLabel(product)} — {product.current_stock} {product.unit} available
                </option>
              ))}
            </select>
          </label>
          <label>
            Planned Quantity
            <input type="number" min="0.01" step="0.01" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </label>
          {stock.length === 0 && <p className="span-2 page-subtitle">No approved products are available in the inventory catalogue.</p>}
          <div className="span-2 dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || stock.length === 0}>{saving ? 'Adding…' : 'Add Planned Material'}</button>
          </div>
        </form>
      )}

      {plannedMaterials.length === 0 ? (
        <EmptyState icon={IconBoxSeam} title="No planned materials yet" description={canEdit ? 'Add products from the inventory catalogue to plan this project.' : undefined} />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Planned Quantity</th><th>Available Stock</th>{canEdit && <th>Actions</th>}</tr></thead>
            <tbody>
              {plannedMaterials.map((material) => {
                const product = stock.find((entry) => entry.id === material.product_id);
                const isEditing = editingMaterial === material.id;
                return (
                  <tr key={material.id}>
                    <td>
                      {isEditing ? (
                        <select aria-label={`Product for ${material.product_name}`} value={editForm.product_id} onChange={(event) => setEditForm({ ...editForm, product_id: event.target.value })}>
                          {stock.map((entry) => <option key={entry.id} value={entry.id}>{formatProductLabel(entry)}</option>)}
                        </select>
                      ) : material.product_name}
                    </td>
                    <td>
                      {isEditing ? (
                        <input aria-label={`Planned quantity for ${material.product_name}`} type="number" min="0.01" step="0.01" value={editForm.quantity} onChange={(event) => setEditForm({ ...editForm, quantity: event.target.value })} />
                      ) : `${material.quantity} ${material.unit || ''}`}
                    </td>
                    <td>{product ? `${product.current_stock} ${product.unit}` : '—'}</td>
                    {canEdit && (
                      <td className="planned-material-actions">
                        {isEditing ? (
                          <>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleUpdate(material.id)} disabled={saving}><IconCheck size={14} /> Save</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingMaterial(null)} disabled={saving}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(material)}>Edit</button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(material.id)} disabled={saving}><IconTrash size={14} /> Remove</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {project.materials?.length > 0 && (
        <div className="actual-materials-section">
          <h3>Previously Issued to Project</h3>
          <p className="page-subtitle">These are existing inventory issue records; planned materials above do not create stock movements.</p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Product</th><th>Quantity</th></tr></thead>
              <tbody>{project.materials.map((material) => <tr key={material.id}><td>{material.date || '—'}</td><td>{material.product_name}</td><td>{material.quantity} {material.unit || ''}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </section>
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

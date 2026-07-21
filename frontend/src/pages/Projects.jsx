import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconPlus, IconBriefcase, IconFolderOff, IconX } from '@tabler/icons-react';
import { listProjects, createProject } from '../api/projects';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import { MONTHS, yearsFrom, filterByDate } from '../utils/dateFilters';
import BackButton from '../components/BackButton';

const BUSINESS_MODEL_PAYMENT_CATEGORIES = {
  outright_purchase: ['full_payment', 'installments'],
  eaas: ['pay_as_you_go'],
  repair_service: ['full_payment', 'installments'],
  maintenance_service: ['full_payment', 'installments'],
  upgrade: ['full_payment', 'installments'],
};

const BUSINESS_MODEL_LABELS = {
  outright_purchase: 'Outright Purchase',
  eaas: 'EaaS',
  repair_service: 'Repair Service',
  maintenance_service: 'Maintenance Service',
  upgrade: 'Upgrade',
};

const PAYMENT_CATEGORY_LABELS = {
  full_payment: 'Full Payment',
  installments: 'Installments',
  pay_as_you_go: 'Pay as you Go',
};

const SECTORS = ['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Telecom', 'Street Lighting', 'Other'];

const emptyForm = {
  name: '',
  client_name: '',
  client_address: '',
  client_contact: '',
  description: '',
  manager: '',
  system_size_kwp: '',
  business_model: '',
  payment_category: '',
  sector: '',
};

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const loadProjects = () => {
    setLoading(true);
    listProjects()
      .then(setProjects)
      .catch(() => setError('Failed to load projects.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadProjects, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'business_model') {
        const allowed = BUSINESS_MODEL_PAYMENT_CATEGORIES[value] || [];
        if (!allowed.includes(prev.payment_category)) {
          next.payment_category = allowed.length === 1 ? allowed[0] : '';
        }
      }
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Project name is required.';
    if (form.business_model && !form.payment_category) {
      errors.payment_category = 'Choose a payment category for this business model.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const project = await createProject({
        ...form,
        system_size_kwp: form.system_size_kwp ? Number(form.system_size_kwp) : 0,
        business_model: form.business_model || null,
        payment_category: form.payment_category || null,
        sector: form.sector || null,
      });
      setShowForm(false);
      setForm(emptyForm);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const allowedPaymentCategories = form.business_model
    ? BUSINESS_MODEL_PAYMENT_CATEGORIES[form.business_model] || []
    : Object.keys(PAYMENT_CATEGORY_LABELS);

  const years = yearsFrom(projects, 'created_at');

  const filteredProjects = filterByDate(projects, 'created_at', { month: monthFilter, year: yearFilter })
    .filter((p) => !statusFilter || p.status === statusFilter)
    .filter(
      (p) =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.client_name || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date_desc') return (b.created_at || '').localeCompare(a.created_at || '');
      if (sortBy === 'date_asc') return (a.created_at || '').localeCompare(b.created_at || '');
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const { page, setPage, totalPages, paginated } = usePagination(filteredProjects, 12);
  const hasFilters = statusFilter || search || monthFilter || yearFilter;

  const clearFilters = () => {
    setStatusFilter('');
    setSearch('');
    setMonthFilter('');
    setYearFilter('');
  };

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader
          icon={IconBriefcase}
          title="Projects"
          subtitle="Every project, from prospect through completion."
          actions={
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              <IconPlus size={18} /> New Project
            </button>
          }
        />
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {!loading && projects.length > 0 && (
        <div className="stat-grid">
          <div className="stat-card"><div><div className="stat-value">{filteredProjects.length}</div><div className="stat-label">Total projects</div></div></div>
          <div className="stat-card"><div><div className="stat-value">{filteredProjects.filter((p) => p.status === 'prospect').length}</div><div className="stat-label">Prospects</div></div></div>
          <div className="stat-card"><div><div className="stat-value">{filteredProjects.filter((p) => p.status === 'on_going' || p.status === 'active_eaas').length}</div><div className="stat-label">Active / On-going</div></div></div>
          <div className="stat-card"><div><div className="stat-value">{filteredProjects.filter((p) => p.status === 'completed').length}</div><div className="stat-label">Completed</div></div></div>
        </div>
      )}

      {showForm && (
        <form className="panel form-grid" onSubmit={handleSubmit} noValidate>
          <label className={fieldErrors.name ? 'has-error' : ''}>
            Project Name
            <input name="name" value={form.name} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.name)} />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </label>
          <label>
            Client Name
            <input name="client_name" value={form.client_name} onChange={handleChange} />
          </label>
          <label>
            Client Address
            <input name="client_address" value={form.client_address} onChange={handleChange} />
          </label>
          <label>
            Client Contact
            <input name="client_contact" value={form.client_contact} onChange={handleChange} />
          </label>
          <label>
            Project Manager
            <input name="manager" value={form.manager} onChange={handleChange} />
          </label>
          <label>
            System Size (kWp)
            <input name="system_size_kwp" type="number" min="0" step="0.1" value={form.system_size_kwp} onChange={handleChange} />
          </label>
          <label>
            Sector
            <select name="sector" value={form.sector} onChange={handleChange}>
              <option value="">Select sector</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Business Model
            <select name="business_model" value={form.business_model} onChange={handleChange}>
              <option value="">Select business model</option>
              {Object.entries(BUSINESS_MODEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={fieldErrors.payment_category ? 'has-error' : ''}>
            Payment Category
            <select name="payment_category" value={form.payment_category} onChange={handleChange}>
              <option value="">Select payment category</option>
              {allowedPaymentCategories.map((value) => (
                <option key={value} value={value}>{PAYMENT_CATEGORY_LABELS[value]}</option>
              ))}
            </select>
            {fieldErrors.payment_category && <span className="field-error">{fieldErrors.payment_category}</span>}
          </label>
          <label className="span-2">
            Description
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} />
          </label>
          <div className="span-2">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {!loading && projects.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or client…" style={{ width: 200 }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="prospect">Prospect</option>
            <option value="quote_accepted">Quote Accepted</option>
            <option value="on_going">On-going</option>
            <option value="active_eaas">Active (EaaS)</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All months</option>
            {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name">Sort by name</option>
          </select>
          {hasFilters && <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}><IconX size={14} /> Clear</button>}
          <span className="page-subtitle">{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {loading ? (
        <div className="panel"><SkeletonRows rows={4} columns={1} /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={IconFolderOff}
          title="No projects yet"
          description="Create your first project to start quoting."
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState icon={IconFolderOff} title="No projects match your filters" />
      ) : (
        <>
          <div className="card-grid">
            {paginated.map((project) => (
              <Link to={`/projects/${project.id}`} className="job-card" key={project.id}>
                <h3>{project.name}</h3>
                <p>{project.client_name || 'No client assigned'}</p>
                <div className="quote-option-flags">
                  <StatusBadge type="projectStatus" value={project.status} />
                  {project.business_model && <StatusBadge type="businessModel" value={project.business_model} />}
                </div>
                <div className="job-card-footer">
                  <span>{project.quotation_count} quote option(s)</span>
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

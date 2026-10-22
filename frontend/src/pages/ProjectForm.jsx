import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject } from '../api/projects';
import BackButton from '../components/BackButton';

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
];

const BUSINESS_MODELS = [
  ['direct_purchase', 'Direct Purchase'],
  ['greenband_eaas', 'Greenband (EaaS)'],
  ['upgrade_expansion', 'Upgrade / System Expansion'],
  ['installation_only', 'Installation Only'],
  ['maintenance_repair', 'Maintenance / Repair Service'],
  ['other', 'Other'],
];

const PAYMENT_TYPES = [
  ['one_time_payment', 'One-time Payment'],
  ['instalment_payments', 'Instalment Payments'],
  ['pay_as_you_go', 'Pay-as-you-go (PAYG)'],
  ['other', 'Other'],
];

const PROJECT_STATUSES = [
  ['not_started', 'Not Started'],
  ['in_progress', 'In Progress'],
  ['on_hold', 'On Hold'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const REQUIRED_FIELDS = [
  ['name', 'Project name'],
  ['client_name', 'Client name'],
  ['client_address', 'Site address'],
  ['manager', 'Project manager'],
  ['sector', 'Sector'],
  ['business_model', 'Business model'],
  ['payment_category', 'Payment type'],
  ['status', 'Project status'],
];

const INITIAL_FORM = {
  name: '',
  client_name: '',
  client_address: '',
  client_contact: '',
  manager: '',
  description: '',
  sector: '',
  business_model: '',
  payment_category: '',
  status: 'not_started',
};

export default function ProjectForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    REQUIRED_FIELDS.forEach(([name, label]) => {
      if (typeof form[name] !== 'string' || !form[name].trim()) {
        nextErrors[name] = `${label} is required.`;
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError('');
    try {
      const project = await createProject({
        ...form,
        name: form.name.trim(),
        client_name: form.client_name.trim(),
        client_address: form.client_address.trim(),
        client_contact: form.client_contact.trim() || null,
        manager: form.manager.trim(),
        description: form.description.trim() || null,
      });
      navigate(`/projects/${project.id}`, { state: { success: `Project ${project.project_ref} created successfully.` } });
    } catch (err) {
      setError(err.response?.data?.error || 'We could not create the project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (field) => (errors[field] ? 'has-error' : '');

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton fallback="/projects" label="Back to Projects" />
        <h1 className="page-title">Create Project</h1>
        <p className="page-subtitle">Enter the details for this confirmed customer project.</p>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form className="panel form-grid project-form" onSubmit={handleSubmit} noValidate>
        <div className="span-2 project-form-section">
          <h2>Project Information</h2>
          <p className="page-subtitle">Fields marked * are required. Project contact is optional.</p>
        </div>

        <label className={fieldClass('name')}>
          Project Name *
          <input name="name" value={form.name} onChange={handleChange} maxLength={160} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'project-name-error' : undefined} />
          {errors.name && <span className="field-error" id="project-name-error">{errors.name}</span>}
        </label>
        <label className={fieldClass('client_name')}>
          Client Name *
          <input name="client_name" value={form.client_name} onChange={handleChange} required aria-invalid={Boolean(errors.client_name)} />
          {errors.client_name && <span className="field-error">{errors.client_name}</span>}
        </label>
        <label className={fieldClass('client_address')}>
          Site Address *
          <input name="client_address" value={form.client_address} onChange={handleChange} required aria-invalid={Boolean(errors.client_address)} />
          <span className="field-hint">The project location, which may differ from the client’s registered address.</span>
          {errors.client_address && <span className="field-error">{errors.client_address}</span>}
        </label>
        <label>
          Project Contact <span className="field-hint">(optional)</span>
          <input name="client_contact" type="tel" value={form.client_contact} onChange={handleChange} />
        </label>
        <label className={fieldClass('manager')}>
          Project Manager *
          <input name="manager" value={form.manager} onChange={handleChange} required aria-invalid={Boolean(errors.manager)} />
          {errors.manager && <span className="field-error">{errors.manager}</span>}
        </label>
        <label className="span-2">
          Description
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} />
        </label>
        <label className={fieldClass('status')}>
          Project Status *
          <select name="status" value={form.status} onChange={handleChange} required aria-invalid={Boolean(errors.status)}>
            {PROJECT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {errors.status && <span className="field-error">{errors.status}</span>}
        </label>

        <div className="span-2 project-form-section">
          <h2>Project Classification</h2>
        </div>

        <label className={fieldClass('sector')}>
          Sector *
          <select name="sector" value={form.sector} onChange={handleChange} required aria-invalid={Boolean(errors.sector)}>
            <option value="">Select sector</option>
            {SECTORS.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
          </select>
          {errors.sector && <span className="field-error">{errors.sector}</span>}
        </label>
        <label className={fieldClass('business_model')}>
          Business Model *
          <select name="business_model" value={form.business_model} onChange={handleChange} required aria-invalid={Boolean(errors.business_model)}>
            <option value="">Select business model</option>
            {BUSINESS_MODELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {errors.business_model && <span className="field-error">{errors.business_model}</span>}
        </label>
        <label className={fieldClass('payment_category')}>
          Payment Type *
          <select name="payment_category" value={form.payment_category} onChange={handleChange} required aria-invalid={Boolean(errors.payment_category)}>
            <option value="">Select payment type</option>
            {PAYMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {errors.payment_category && <span className="field-error">{errors.payment_category}</span>}
        </label>

        <div className="span-2 dialog-actions project-form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/projects')} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

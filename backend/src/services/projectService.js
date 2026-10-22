const db = require('../db');

function nextProjectReference() {
  const last = db.prepare(
    `SELECT COALESCE(MAX(CAST(SUBSTR(project_ref, 5) AS INTEGER)), 0) AS number
     FROM projects WHERE project_ref GLOB 'PRJ-[0-9]*'`
  ).get().number;
  return `PRJ-${String(last + 1).padStart(3, '0')}`;
}

// EaaS is metered/recurring, so it can only be billed Pay as you Go. Every other
// business model is a one-off sale/service, billed either in full or in installments.
const ALLOWED_PAYMENT_CATEGORIES = {
  outright_purchase: ['full_payment', 'installments', 'one_time_payment', 'instalment_payments', 'other'],
  eaas: ['pay_as_you_go'],
  repair_service: ['full_payment', 'installments', 'one_time_payment', 'instalment_payments', 'other'],
  maintenance_service: ['full_payment', 'installments', 'one_time_payment', 'instalment_payments', 'other'],
  upgrade: ['full_payment', 'installments', 'one_time_payment', 'instalment_payments', 'other'],
};

const PROJECT_STATUS_VALUES = [
  'prospect',
  'quote_accepted',
  'on_going',
  'active_eaas',
  'on_hold',
  'completed',
  'rejected',
  'not_started',
  'in_progress',
  'cancelled',
];

const PROJECT_SECTORS = [
  'Residential',
  'Commercial',
  'Industrial',
  'Agricultural',
  'Telecom',
  'Street Lighting',
  'Other',
  'Residential / Home',
  'Commercial / Business',
  'Healthcare',
  'Education',
  'Agriculture',
  'Industrial / Manufacturing',
  'Government',
  'Religious Organisation',
];

const PROJECT_BUSINESS_MODELS = [
  'outright_purchase',
  'eaas',
  'repair_service',
  'maintenance_service',
  'upgrade',
  'direct_purchase',
  'greenband_eaas',
  'upgrade_expansion',
  'installation_only',
  'maintenance_repair',
  'other',
];

const PROJECT_PAYMENT_CATEGORIES = [
  'full_payment',
  'installments',
  'pay_as_you_go',
  'one_time_payment',
  'instalment_payments',
  'other',
];

const NEW_PROJECT_BUSINESS_MODELS = [
  'direct_purchase',
  'greenband_eaas',
  'upgrade_expansion',
  'installation_only',
  'maintenance_repair',
  'other',
];

function isValidBusinessModelPaymentCategory(businessModel, paymentCategory) {
  if (!businessModel || !paymentCategory) return true;
  if (NEW_PROJECT_BUSINESS_MODELS.includes(businessModel)) return PROJECT_PAYMENT_CATEGORIES.includes(paymentCategory);
  const allowed = ALLOWED_PAYMENT_CATEGORIES[businessModel];
  return Boolean(allowed && allowed.includes(paymentCategory));
}

function getProjectWithCosts(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;
  const materialsCost = db
    .prepare(
      `SELECT COALESCE(SUM(pm.quantity * pr.unit_cost), 0) AS total
       FROM project_materials pm JOIN products pr ON pr.id = pm.product_id
       WHERE pm.project_id = ?`
    )
    .get(projectId).total;
  const otherCosts = db
    .prepare('SELECT COALESCE(SUM(cost), 0) AS total FROM project_costs WHERE project_id = ?')
    .get(projectId).total;
  return { ...project, materials_cost: materialsCost, other_costs: otherCosts, total_cost: materialsCost + otherCosts };
}

module.exports = {
  nextProjectReference,
  ALLOWED_PAYMENT_CATEGORIES,
  PROJECT_STATUS_VALUES,
  PROJECT_SECTORS,
  PROJECT_BUSINESS_MODELS,
  PROJECT_PAYMENT_CATEGORIES,
  isValidBusinessModelPaymentCategory,
  getProjectWithCosts,
};

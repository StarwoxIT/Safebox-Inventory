const db = require('../db');

// EaaS is metered/recurring, so it can only be billed Pay as you Go. Every other
// business model is a one-off sale/service, billed either in full or in installments.
const ALLOWED_PAYMENT_CATEGORIES = {
  outright_purchase: ['full_payment', 'installments'],
  eaas: ['pay_as_you_go'],
  repair_service: ['full_payment', 'installments'],
  maintenance_service: ['full_payment', 'installments'],
  upgrade: ['full_payment', 'installments'],
};

function isValidBusinessModelPaymentCategory(businessModel, paymentCategory) {
  if (!businessModel || !paymentCategory) return true;
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

module.exports = { ALLOWED_PAYMENT_CATEGORIES, isValidBusinessModelPaymentCategory, getProjectWithCosts };

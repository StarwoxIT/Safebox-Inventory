const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth, superAdmin } = require('../middleware/auth');
const audit = require('../middleware/audit');

const nextId = (prefix, table) => {
  const row = db.prepare(`SELECT id FROM ${table} WHERE id LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}-%`);
  if (!row) return `${prefix}-001`;
  const n = parseInt(row.id.replace(`${prefix}-`, '')) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
};

router.get('/', auth, (req, res) => {
  const prods = db.prepare('SELECT * FROM products ORDER BY id').all();
  res.json(prods);
});

router.get('/stock', auth, (req, res) => {
  const IN_TYPES = "'Purchase (IN)','Return (IN)','Transfer IN','Client Return to Stock','Project Return to Stock'";
  const OUT_TYPES = "'Used in Project (OUT)','Sale (OUT)','Transfer OUT','Damaged/Written Off','Adjustment'";
  const stock = db.prepare(`
    SELECT p.id, p.model, p.category, p.unit, p.min_threshold, p.max_threshold, p.unit_cost, p.status,
      COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id=p.id AND movement_type IN (${IN_TYPES}) AND status='Approved'),0)
      - COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id=p.id AND movement_type IN (${OUT_TYPES}) AND status='Approved'),0)
      + COALESCE((SELECT SUM(quantity) FROM returns WHERE product_id=p.id AND (return_type='Project Return' OR reconciled=1)),0)
      AS current_stock
    FROM products p WHERE p.status='Approved'
  `).all();
  res.json(stock);
});

router.post('/', auth, (req, res) => {
  const { category, subcategory, brand, model, unit, min_threshold, max_threshold, unit_cost, notes } = req.body;
  if (!model || !category) return res.status(400).json({ error: 'Category and model required' });
  const id = nextId('PRD', 'products');
  const status = req.user.role === 'Super Admin' ? 'Approved' : 'Pending';
  const approved_by = req.user.role === 'Super Admin' ? req.user.id : null;
  const approved_at = req.user.role === 'Super Admin' ? new Date().toISOString() : null;
  db.prepare(`INSERT INTO products (id,category,subcategory,brand,model,unit,min_threshold,max_threshold,unit_cost,status,created_by,approved_by,approved_at,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
    .run(id, category, subcategory, brand, model, unit||'Unit', min_threshold||0, max_threshold||100, unit_cost||0, status, req.user.id, approved_by, approved_at, notes||'');
  audit(req.user.id, req.user.name, 'Product added', 'product', id, `${id} – ${model} [${status}]`, req.ip);
  res.status(201).json({ id, status });
});

router.put('/:id', auth, (req, res) => {
  const prod = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  const { category, subcategory, brand, model, unit, min_threshold, max_threshold, unit_cost, notes } = req.body;
  db.prepare('UPDATE products SET category=?,subcategory=?,brand=?,model=?,unit=?,min_threshold=?,max_threshold=?,unit_cost=?,notes=? WHERE id=?')
    .run(category||prod.category, subcategory||prod.subcategory, brand||prod.brand, model||prod.model, unit||prod.unit, min_threshold??prod.min_threshold, max_threshold??prod.max_threshold, unit_cost??prod.unit_cost, notes??prod.notes, prod.id);
  audit(req.user.id, req.user.name, 'Product updated', 'product', prod.id, `${prod.id} – ${model||prod.model}`, req.ip);
  res.json({ success: true });
});

router.post('/:id/approve', auth, superAdmin, (req, res) => {
  const { decision } = req.body;
  if (!['Approved','Rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });
  const prod = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  db.prepare('UPDATE products SET status=?,approved_by=?,approved_at=datetime(\'now\') WHERE id=?').run(decision, req.user.id, prod.id);
  audit(req.user.id, req.user.name, `Product ${decision}`, 'product', prod.id, `${prod.id} – ${prod.model}`, req.ip);
  res.json({ success: true });
});

module.exports = router;

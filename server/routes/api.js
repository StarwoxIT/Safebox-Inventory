const router = require('express').Router();
const db = require('../db');
const { auth, superAdmin } = require('../middleware/auth');
const audit = require('../middleware/audit');

const nextId = (prefix, table, col = 'id') => {
  const row = db.prepare(`SELECT ${col} FROM ${table} WHERE ${col} LIKE ? ORDER BY ${col} DESC LIMIT 1`).get(`${prefix}-%`);
  if (!row) return `${prefix}-001`;
  const n = parseInt(row[col].replace(`${prefix}-`, '')) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
};

// ── Stock Movements ────────────────────────────────────────────────────────
router.get('/movements', auth, (req, res) => {
  res.json(db.prepare(`SELECT m.*, u.name as recorded_by_name, p.model as product_name, p.category, p.unit, p.unit_cost
    FROM stock_movements m LEFT JOIN users u ON m.recorded_by=u.id LEFT JOIN products p ON m.product_id=p.id
    ORDER BY m.date DESC, m.created_at DESC`).all());
});

router.post('/movements', auth, (req, res) => {
  const { date, product_id, movement_type, quantity, condition, source, notes } = req.body;
  if (!product_id || !quantity || !movement_type) return res.status(400).json({ error: 'Product, type and quantity required' });
  const id = nextId('MV', 'stock_movements');
  const status = req.user.role === 'Super Admin' ? 'Approved' : 'Pending';
  const approved_by = req.user.role === 'Super Admin' ? req.user.id : null;
  const approved_at = req.user.role === 'Super Admin' ? new Date().toISOString() : null;
  db.prepare(`INSERT INTO stock_movements (id,date,product_id,movement_type,quantity,condition,source,recorded_by,status,approved_by,approved_at,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
    .run(id, date||new Date().toISOString().slice(0,10), product_id, movement_type, quantity, condition||'New', source||'', req.user.id, status, approved_by, approved_at, notes||'');
  audit(req.user.id, req.user.name, 'Movement logged', 'movement', id, `${id} – ${movement_type} ${quantity}x ${product_id} [${condition||'New'}] [${status}]`, req.ip);
  res.status(201).json({ id, status });
});

router.post('/movements/:id/approve', auth, superAdmin, (req, res) => {
  const { decision } = req.body;
  if (!['Approved','Rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });
  const mv = db.prepare('SELECT * FROM stock_movements WHERE id=?').get(req.params.id);
  if (!mv) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE stock_movements SET status=?,approved_by=?,approved_at=datetime(\'now\') WHERE id=?').run(decision, req.user.id, mv.id);
  audit(req.user.id, req.user.name, `Movement ${decision}`, 'movement', mv.id, `${mv.id}`, req.ip);
  res.json({ success: true });
});

// ── Returns ───────────────────────────────────────────────────────────────
router.get('/returns', auth, (req, res) => {
  res.json(db.prepare(`SELECT r.*, p.model as product_name, pr.name as project_name, u.name as logged_by_name
    FROM returns r LEFT JOIN products p ON r.product_id=p.id LEFT JOIN projects pr ON r.project_id=pr.id
    LEFT JOIN users u ON r.logged_by=u.id ORDER BY r.date DESC`).all());
});

router.post('/returns', auth, (req, res) => {
  const { date, return_type, project_id, product_id, quantity, reason, oem, sent_to_oem_date, oem_response, notes } = req.body;
  if (!product_id || !quantity || !reason) return res.status(400).json({ error: 'Product, quantity and reason required' });
  const id = nextId('RET', 'returns');
  db.prepare(`INSERT INTO returns (id,date,return_type,project_id,product_id,quantity,reason,oem,sent_to_oem_date,oem_response,reconciled,notes,logged_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,datetime('now'))`)
    .run(id, date||new Date().toISOString().slice(0,10), return_type||'Client Return', project_id||null, product_id, quantity, reason, oem||'', sent_to_oem_date||'', oem_response||'', notes||'', req.user.id);
  audit(req.user.id, req.user.name, 'Return logged', 'return', id, `${id} – ${return_type} for ${product_id}`, req.ip);
  res.status(201).json({ id });
});

router.put('/returns/:id', auth, (req, res) => {
  const r = db.prepare('SELECT * FROM returns WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { oem, sent_to_oem_date, oem_response, reconciled, notes } = req.body;
  db.prepare('UPDATE returns SET oem=?,sent_to_oem_date=?,oem_response=?,reconciled=?,notes=? WHERE id=?')
    .run(oem??r.oem, sent_to_oem_date??r.sent_to_oem_date, oem_response??r.oem_response, reconciled?1:0, notes??r.notes, r.id);
  audit(req.user.id, req.user.name, 'Return updated', 'return', r.id, `${r.id} reconciled:${reconciled}`, req.ip);
  res.json({ success: true });
});

// ── Projects ──────────────────────────────────────────────────────────────
router.get('/projects', auth, (req, res) => {
  const projs = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  projs.forEach(p => {
    p.engineer_count = db.prepare('SELECT COUNT(*) as c FROM project_engineers WHERE project_id=?').get(p.id)?.c || 0;
    p.engineer_names = db.prepare('SELECT name FROM project_engineers WHERE project_id=?').all(p.id).map(e=>e.name).join(', ');
    const matCost = db.prepare(`SELECT COALESCE(SUM(pm.quantity * pr.unit_cost),0) as c FROM project_materials pm JOIN products pr ON pm.product_id=pr.id WHERE pm.project_id=?`).get(p.id);
    p.materials_cost = matCost?.c || 0;
    const otherCost = db.prepare(`SELECT COALESCE(SUM(cost),0) as c FROM project_costs WHERE project_id=?`).get(p.id);
    p.other_costs = otherCost?.c || 0;
    p.total_cost = p.materials_cost + p.other_costs;
  });
  res.json(projs);
});

router.post('/projects', auth, (req, res) => {
  const { name, client, project_type, sale_type, start_date, end_date, status, manager, system_size_kva, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name required' });
  const id = nextId('PRJ', 'projects');
  db.prepare(`INSERT INTO projects (id,name,client,project_type,sale_type,start_date,end_date,status,manager,system_size_kva,notes,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
    .run(id, name, client||'', project_type||'Commercial', sale_type||'Outright Purchase', start_date||'', end_date||'', status||'Planning', manager||'', system_size_kva||0, notes||'', req.user.id);
  audit(req.user.id, req.user.name, 'Project created', 'project', id, `${id} – ${name}`, req.ip);
  res.status(201).json({ id });
});

router.put('/projects/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const { name, client, project_type, sale_type, start_date, end_date, status, manager, system_size_kva, notes } = req.body;
  db.prepare('UPDATE projects SET name=?,client=?,project_type=?,sale_type=?,start_date=?,end_date=?,status=?,manager=?,system_size_kva=?,notes=? WHERE id=?')
    .run(name??p.name, client??p.client, project_type??p.project_type, sale_type??p.sale_type, start_date??p.start_date, end_date??p.end_date, status??p.status, manager??p.manager, system_size_kva??p.system_size_kva, notes??p.notes, p.id);
  audit(req.user.id, req.user.name, 'Project updated', 'project', p.id, `${p.id} – ${name||p.name}`, req.ip);
  res.json({ success: true });
});

// ── Project Materials ─────────────────────────────────────────────────────
router.get('/materials', auth, (req, res) => {
  res.json(db.prepare(`SELECT pm.*, p.name as project_name, pr.model as product_name, pr.category, pr.unit, pr.unit_cost,
    pm.quantity * pr.unit_cost as total_cost
    FROM project_materials pm LEFT JOIN projects p ON pm.project_id=p.id LEFT JOIN products pr ON pm.product_id=pr.id
    ORDER BY pm.date DESC`).all());
});

router.post('/materials', auth, (req, res) => {
  const { date, project_id, product_id, quantity } = req.body;
  if (!project_id || !product_id || !quantity) return res.status(400).json({ error: 'Project, product and quantity required' });
  const id = nextId('PML', 'project_materials');
  db.prepare(`INSERT INTO project_materials (id,date,project_id,product_id,quantity,created_by,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
    .run(id, date||new Date().toISOString().slice(0,10), project_id, product_id, quantity, req.user.id);
  audit(req.user.id, req.user.name, 'Material logged', 'material', id, `${id} – ${quantity}x ${product_id} → ${project_id}`, req.ip);
  res.status(201).json({ id });
});

// ── Engineers ─────────────────────────────────────────────────────────────
router.get('/engineers', auth, (req, res) => {
  res.json(db.prepare(`SELECT e.*, p.name as project_name FROM project_engineers e LEFT JOIN projects p ON e.project_id=p.id ORDER BY e.date_assigned DESC`).all());
});

router.post('/engineers', auth, (req, res) => {
  const { project_id, name, role, date_assigned, date_completed, notes } = req.body;
  if (!project_id || !name) return res.status(400).json({ error: 'Project and name required' });
  const id = nextId('ENG', 'project_engineers');
  db.prepare(`INSERT INTO project_engineers (id,project_id,name,role,date_assigned,date_completed,notes,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))`)
    .run(id, project_id, name, role||'', date_assigned||new Date().toISOString().slice(0,10), date_completed||'', notes||'', req.user.id);
  audit(req.user.id, req.user.name, 'Engineer assigned', 'engineer', id, `${id} – ${name} (${role}) → ${project_id}`, req.ip);
  res.status(201).json({ id });
});

router.put('/engineers/:id', auth, (req, res) => {
  const e = db.prepare('SELECT * FROM project_engineers WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const { name, role, date_assigned, date_completed, notes } = req.body;
  db.prepare('UPDATE project_engineers SET name=?,role=?,date_assigned=?,date_completed=?,notes=? WHERE id=?')
    .run(name??e.name, role??e.role, date_assigned??e.date_assigned, date_completed??e.date_completed, notes??e.notes, e.id);
  audit(req.user.id, req.user.name, 'Engineer updated', 'engineer', e.id, `${e.id}`, req.ip);
  res.json({ success: true });
});

// ── Categories ────────────────────────────────────────────────────────────
router.get('/categories', auth, (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY name').all();
  cats.forEach(c => { c.subs = db.prepare('SELECT * FROM subcategories WHERE category_id=? ORDER BY name').all(c.id); });
  res.json(cats);
});

router.post('/categories', auth, superAdmin, (req, res) => {
  const { name, subs } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = nextId('CAT', 'categories');
  db.prepare('INSERT INTO categories (id,name,created_at) VALUES (?,?,datetime(\'now\'))').run(id, name);
  (subs||[]).forEach(s => db.prepare('INSERT OR IGNORE INTO subcategories (id,category_id,name) VALUES (?,?,?)').run(`${id}-S${Date.now()}`, id, s));
  audit(req.user.id, req.user.name, 'Category added', 'category', id, name, req.ip);
  res.status(201).json({ id });
});

router.put('/categories/:id', auth, superAdmin, (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  const { name, subs } = req.body;
  if (name) db.prepare('UPDATE categories SET name=? WHERE id=?').run(name, cat.id);
  if (subs) {
    db.prepare('DELETE FROM subcategories WHERE category_id=?').run(cat.id);
    subs.forEach((s,i) => db.prepare('INSERT OR IGNORE INTO subcategories (id,category_id,name) VALUES (?,?,?)').run(`${cat.id}-S${i+1}`, cat.id, s));
  }
  audit(req.user.id, req.user.name, 'Category updated', 'category', cat.id, name||cat.name, req.ip);
  res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────
router.get('/users', auth, superAdmin, (req, res) => {
  res.json(db.prepare('SELECT id,name,email,role,status,invited,created_at,last_login FROM users ORDER BY created_at').all());
});

router.put('/users/:id', auth, superAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { name, role, status } = req.body;
  db.prepare('UPDATE users SET name=?,role=?,status=? WHERE id=?').run(name??u.name, role??u.role, status??u.status, u.id);
  audit(req.user.id, req.user.name, 'User updated', 'user', u.id, `${u.id} – ${name||u.name}`, req.ip);
  res.json({ success: true });
});

// ── Settings ──────────────────────────────────────────────────────────────
router.get('/settings', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/settings', auth, superAdmin, (req, res) => {
  const updates = req.body;
  Object.entries(updates).forEach(([k, v]) => {
    db.prepare('INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime(\'now\'))').run(k, String(v));
  });
  audit(req.user.id, req.user.name, 'Settings updated', 'settings', 'all', 'System settings saved', req.ip);
  res.json({ success: true });
});

// ── Audit Log ─────────────────────────────────────────────────────────────
router.get('/audit', auth, superAdmin, (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?').all(limit));
});

// ── Dashboard Stats ───────────────────────────────────────────────────────
router.get('/dashboard', auth, (req, res) => {
  const IN_TYPES = "'Purchase (IN)','Return (IN)','Transfer IN','Client Return to Stock','Project Return to Stock'";
  const OUT_TYPES = "'Used in Project (OUT)','Sale (OUT)','Transfer OUT','Damaged/Written Off','Adjustment'";
  const stock = db.prepare(`
    SELECT p.id, p.category, p.unit_cost, p.min_threshold,
      COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id=p.id AND movement_type IN (${IN_TYPES}) AND status='Approved'),0)
      - COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id=p.id AND movement_type IN (${OUT_TYPES}) AND status='Approved'),0)
      + COALESCE((SELECT SUM(quantity) FROM returns WHERE product_id=p.id AND (return_type='Project Return' OR reconciled=1)),0)
      AS current_stock
    FROM products p WHERE p.status='Approved'
  `).all();

  const totalValue = stock.reduce((s,p)=>s+p.current_stock*p.unit_cost,0);
  const below = stock.filter(p=>p.current_stock<=p.min_threshold).length;
  const low = stock.filter(p=>p.current_stock>p.min_threshold&&p.current_stock<=p.min_threshold*1.2).length;
  const activeProjects = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status='Active'").get().c;
  const completedProjects = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status='Completed'").get().c;
  const pendingApprovals = db.prepare("SELECT COUNT(*) as c FROM products WHERE status='Pending'").get().c
    + db.prepare("SELECT COUNT(*) as c FROM stock_movements WHERE status='Pending'").get().c;
  const openOemReturns = db.prepare("SELECT COUNT(*) as c FROM returns WHERE oem!='' AND reconciled=0").get().c;
  const totalEngineers = db.prepare('SELECT COUNT(*) as c FROM project_engineers').get().c;

  const catSummary = {};
  stock.forEach(p => {
    if (!catSummary[p.category]) catSummary[p.category] = { count:0, totalStock:0, totalValue:0 };
    catSummary[p.category].count++;
    catSummary[p.category].totalStock += p.current_stock;
    catSummary[p.category].totalValue += p.current_stock * p.unit_cost;
  });

  res.json({ totalValue, below, low, activeProjects, completedProjects, pendingApprovals, openOemReturns, totalEngineers, totalProducts: stock.length, catSummary });
});

// DELETE routes — Super Admin only
router.delete('/movements/:id', auth, superAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM stock_movements WHERE id=?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM stock_movements WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Movement deleted', 'movement', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

router.delete('/returns/:id', auth, superAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM returns WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM returns WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Return deleted', 'return', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

router.delete('/projects/:id', auth, superAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM project_materials WHERE project_id=?').run(req.params.id);
  db.prepare('DELETE FROM project_engineers WHERE project_id=?').run(req.params.id);
  db.prepare('DELETE FROM project_costs WHERE project_id=?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Project deleted', 'project', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

router.delete('/materials/:id', auth, superAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM project_materials WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM project_materials WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Material deleted', 'material', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

router.delete('/engineers/:id', auth, superAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM project_engineers WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM project_engineers WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Engineer deleted', 'engineer', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

router.delete('/users/:id', auth, superAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'User deleted', 'user', req.params.id, `Deleted user ${u.name}`, req.ip);
  res.json({ success: true });
});

router.delete('/products/:id', auth, superAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM products WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Product deleted', 'product', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

// ── Project Costs ─────────────────────────────────────────────────────────
router.get('/project-costs', auth, (req, res) => {
  res.json(db.prepare(`SELECT pc.*, p.name as project_name, u.name as logged_by_name
    FROM project_costs pc LEFT JOIN projects p ON pc.project_id=p.id LEFT JOIN users u ON pc.logged_by=u.id
    ORDER BY pc.created_at DESC`).all());
});

router.post('/project-costs', auth, (req, res) => {
  const { project_id, item_name, cost, notes } = req.body;
  if (!project_id || !item_name || cost === undefined) return res.status(400).json({ error: 'Project, item name and cost are required' });
  const id = nextId('PCO', 'project_costs');
  db.prepare(`INSERT INTO project_costs (id,project_id,item_name,cost,notes,logged_by,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
    .run(id, project_id, item_name, parseFloat(cost)||0, notes||'', req.user.id);
  audit(req.user.id, req.user.name, 'Project cost added', 'project_cost', id, `${id} – ${item_name} ₦${cost} → ${project_id}`, req.ip);
  res.status(201).json({ id });
});

router.delete('/project-costs/:id', auth, superAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM project_costs WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM project_costs WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Project cost deleted', 'project_cost', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

// ── Battery Collections ───────────────────────────────────────────────────
router.get('/battery-collections', auth, (req, res) => {
  res.json(db.prepare(`SELECT bc.*, u.name as logged_by_name
    FROM battery_collections bc LEFT JOIN users u ON bc.logged_by=u.id
    ORDER BY bc.date DESC, bc.created_at DESC`).all());
});

router.post('/battery-collections', auth, (req, res) => {
  const { date, battery_type, quantity, collected_from, notes } = req.body;
  if (!battery_type || !quantity || !collected_from) return res.status(400).json({ error: 'Battery type, quantity and collected from are required' });
  const id = nextId('BAT', 'battery_collections');
  db.prepare(`INSERT INTO battery_collections (id,date,battery_type,quantity,collected_from,notes,logged_by,created_at)
    VALUES (?,?,?,?,?,?,?,datetime('now'))`)
    .run(id, date||new Date().toISOString().slice(0,10), battery_type, parseInt(quantity)||1, collected_from, notes||'', req.user.id);
  audit(req.user.id, req.user.name, 'Battery collection logged', 'battery_collection', id, `${id} – ${quantity}x ${battery_type} from ${collected_from}`, req.ip);
  res.status(201).json({ id });
});

router.delete('/battery-collections/:id', auth, superAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM battery_collections WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM battery_collections WHERE id=?').run(req.params.id);
  audit(req.user.id, req.user.name, 'Battery collection deleted', 'battery_collection', req.params.id, `Deleted ${req.params.id}`, req.ip);
  res.json({ success: true });
});

module.exports = router;

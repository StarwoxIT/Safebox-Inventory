const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./index');

function seed() {
  let superAdminId = null;
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@safeboxenergy.com';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'SafeboxAdmin@2026';
    const passwordHash = bcrypt.hashSync(password, 10);
    superAdminId = uuid();
    db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run(superAdminId, 'Super Admin', email, passwordHash, 'super_admin');
    console.log('----------------------------------------------------');
    console.log(' Seeded super admin account:');
    console.log(`   email:    ${email}`);
    console.log(`   password: ${password}`);
    console.log(' Change this password after first login.');
    console.log('----------------------------------------------------');
  }

  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (productCount === 0) {
    const catalog = [
      ['Solar', 'Panel', 'Solar Panel 450W Mono', 145000],
      ['Storage', 'Battery', 'Lithium Battery 5kWh', 850000],
      ['Inverter', 'Hybrid Inverter', 'Hybrid Inverter 5kVA', 620000],
      ['Controller', 'MPPT', 'Charge Controller MPPT 60A', 95000],
      ['Accessories', 'Mounting', 'Mounting Structure (per panel)', 18000],
      ['Cabling', 'DC Cable', 'DC Cable (per meter)', 1200],
      ['Cabling', 'AC Cable', 'AC Cable (per meter)', 1500],
      ['Labour', 'Installation', 'Installation & Commissioning', 100000],
    ];
    const insert = db.prepare(
      `INSERT INTO products (id, category, subcategory, model, unit_cost, status, created_by, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, 'Approved', ?, ?, datetime('now'))`
    );
    const insertMany = db.transaction((rows) => {
      for (const [category, subcategory, model, unitCost] of rows) {
        insert.run(uuid(), category, subcategory, model, unitCost, superAdminId, superAdminId);
      }
    });
    insertMany(catalog);
    console.log('Seeded default product catalog.');
  }

  // eslint-disable-next-line global-require
  require('../services/companyService').getCompanyProfile();
}

seed();

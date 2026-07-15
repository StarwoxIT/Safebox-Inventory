const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = process.env.DB_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Indexes are split out and created after migrations run: some (e.g. the audit_log
// index on created_at) reference a column that only exists post-migration on a
// database reused from before the schema was unified (see migrations.js).
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const firstIndexAt = schema.indexOf('CREATE INDEX');
const tableStatements = firstIndexAt === -1 ? schema : schema.slice(0, firstIndexAt);
const indexStatements = firstIndexAt === -1 ? '' : schema.slice(firstIndexAt);
db.exec(tableStatements);

const { runMigrations } = require('./migrations');
runMigrations(db);

if (indexStatements) db.exec(indexStatements);

module.exports = db;

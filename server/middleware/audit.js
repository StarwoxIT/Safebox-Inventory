const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const audit = (userId, userName, action, entityType, entityId, detail, ip = null) => {
  try {
    db.prepare(`INSERT INTO audit_log (id,timestamp,user_id,user_name,action,entity_type,entity_id,detail,ip_address)
      VALUES (?,datetime('now'),?,?,?,?,?,?,?)`)
      .run(uuidv4(), userId, userName, action, entityType, entityId, detail, ip);
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
};

module.exports = audit;

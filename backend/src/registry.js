
// Flagged registry: stores salted hashes, never raw identifiers.
const crypto = require('crypto');
const ipaddr = require('ipaddr.js');
const db = require('./db');

function normalize(type, value) {
  if (value === null || value === undefined) return '';

  let v = String(value).trim().toLowerCase();
  if (!v) return '';

  if (type === 'email') {
    if (v.length > 254 || v.split('@').length !== 2) return '';

    let [local, domain] = v.split('@');
    if (!local || !domain || local.length > 64) return '';

    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      local = local.split('+')[0].replace(/\./g, '');
      domain = 'gmail.com';
    }

    if (!local) return '';
    return `${local}@${domain}`;
  }

  if (type === 'ip' || type === 'ip_address') {
    try {
      if (!ipaddr.isValid(v)) return '';
      return ipaddr.process(v).toString().toLowerCase();
    } catch {
      return '';
    }
  }

  if (type === 'device' || type === 'device_id') {
    return v.replace(/\s+/g, '');
  }

  if (type === 'address' || type === 'shipping_address') {
    return v.replace(/[^a-z0-9]/g, '');
  }

  // Payer IDs and other identifiers remain exact after trimming/lowercasing.
  return v;
}

function hashValue(type, value) {
  const salt = process.env.REGISTRY_SALT;
  if (!salt || salt === 'change-me-to-a-random-string' || salt === 'dev-salt') {
    throw new Error('A secure REGISTRY_SALT must be configured.');
  }

  const normalized = normalize(type, value);
  if (!normalized) {
    throw new Error(`Invalid or empty identifier for type: ${type}`);
  }

  return crypto
    .createHash('sha256')
    .update(`${salt}|${type}|${normalized}`)
    .digest('hex');
}

function addFlag({ type, value, reason, severity = 50, case_id = null }) {
  const info = db
    .prepare(
      'INSERT INTO flagged_entities (type, hash, reason, severity, case_id) VALUES (?,?,?,?,?)'
    )
    .run(type, hashValue(type, value), reason, severity, case_id);

  return info.lastInsertRowid;
}

function lookup(type, value) {
  if (!value) return [];

  return db
    .prepare(
      "SELECT * FROM flagged_entities WHERE type = ? AND hash = ? AND status = 'ACTIVE'"
    )
    .all(type, hashValue(type, value));
}

function findMatches(order) {
  const checks = [
    ['email', order.email],
    ['payer_id', order.payer_id],
    ['device', order.device_id],
    ['ip', order.ip || order.ip_address],
    ['address', order.shipping_address]
  ];

  const matches = [];

  for (const [type, value] of checks) {
    if (!value) continue;

    for (const row of lookup(type, value)) {
      matches.push({
        type,
        match: 'exact',
        flag_id: row.id,
        reason: row.reason,
        severity: row.severity,
        case_id: row.case_id,
        flagged_on: row.created_at
      });
    }
  }

  return matches;
}

function clearFlag(id) {
  return db
    .prepare("UPDATE flagged_entities SET status = 'CLEARED' WHERE id = ?")
    .run(id).changes > 0;
}

function listFlags() {
  return db
    .prepare(
      'SELECT id, type, reason, severity, case_id, status, created_at FROM flagged_entities ORDER BY id DESC'
    )
    .all();
}

module.exports = {
  addFlag,
  lookup,
  findMatches,
  clearFlag,
  listFlags,
  hashValue,
  normalize
};

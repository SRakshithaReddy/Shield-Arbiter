// Tamper-evident evidence chain: each entry's hash includes the previous entry's hash.
const crypto = require('crypto');
const db = require('./db');

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function computeEntryHash(prev, contentHash, caseId, type, createdAt) {
  return sha256(`${prev}|${contentHash}|${caseId}|${type}|${createdAt}`);
}

function addEvidence(caseId, type, content, note = '') {
  const last = db.prepare('SELECT entry_hash FROM evidence ORDER BY id DESC LIMIT 1').get();
  const prev = last ? last.entry_hash : 'GENESIS';
  const contentHash = sha256(typeof content === 'string' ? content : JSON.stringify(content));
  const createdAt = new Date().toISOString();
  const entryHash = computeEntryHash(prev, contentHash, caseId, type, createdAt);
  const info = db
    .prepare(
      `INSERT INTO evidence (case_id, type, note, content_hash, prev_hash, entry_hash, created_at)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(caseId, type, note, contentHash, prev, entryHash, createdAt);
  return { id: info.lastInsertRowid, content_hash: contentHash, entry_hash: entryHash, created_at: createdAt };
}

function verifyChain() {
  const rows = db.prepare('SELECT * FROM evidence ORDER BY id ASC').all();
  let prev = 'GENESIS';
  for (const r of rows) {
    const expected = computeEntryHash(prev, r.content_hash, r.case_id, r.type, r.created_at);
    if (r.prev_hash !== prev || r.entry_hash !== expected) {
      return { intact: false, tampered_at_entry: r.id, checked: rows.length };
    }
    prev = r.entry_hash;
  }
  return { intact: true, checked: rows.length };
}

const listEvidence = (caseId) =>
  db.prepare('SELECT * FROM evidence WHERE case_id = ? ORDER BY id ASC').all(caseId);

module.exports = { addEvidence, verifyChain, listEvidence, sha256 };

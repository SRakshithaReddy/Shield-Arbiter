
const db = require('../src/db');

const columns = [
  ['refund_id', 'TEXT'],
  ['refund_status', 'TEXT'],
  ['refund_request_id', 'TEXT']
];

const existing = db.prepare(
  'PRAGMA table_info(cases)'
).all().map(column => column.name);

for (const [name, definition] of columns) {
  if (!existing.includes(name)) {
    db.exec(`ALTER TABLE cases ADD COLUMN ${name} ${definition}`);
    console.log(`Added cases.${name}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS refund_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL UNIQUE,
    capture_id TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSING',
    paypal_refund_id TEXT,
    response_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log('Refund tracking migration completed.');
db.close();

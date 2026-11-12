
const db = require('../src/db');

const caseColumns = [
  ['complaint_type', 'TEXT'],
  ['delivery_delay_days', 'INTEGER'],
  ['resolution_status', "TEXT DEFAULT 'RECEIVED'"],
  ['proposed_action', 'TEXT'],
  ['proposed_compensation', 'REAL'],
  ['customer_response', 'TEXT'],
  ['approval_status', "TEXT DEFAULT 'PENDING'"],
  ['approved_at', 'TEXT']
];

const existingColumns = db.prepare(
  "PRAGMA table_info(cases)"
).all().map(column => column.name);

for (const [name, definition] of caseColumns) {
  if (!existingColumns.includes(name)) {
    db.exec(`ALTER TABLE cases ADD COLUMN ${name} ${definition}`);
    console.log(`Added cases.${name}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS merchant_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    complaint_type TEXT NOT NULL,
    min_delay_days INTEGER,
    max_delay_days INTEGER,
    compensation_type TEXT NOT NULL DEFAULT 'NONE',
    compensation_value REAL DEFAULT 0,
    max_compensation REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    response_template TEXT,
    active INTEGER DEFAULT 1,
    requires_approval INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_policy_complaint
  ON merchant_policies(complaint_type, active);
`);

console.log('Merchant policy database migration completed.');

db.close();

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_PATH || path.join(__dirname, '..', 'shieldarbiter.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,              -- PayPal order id
  capture_id TEXT,
  email TEXT,
  payer_id TEXT,
  ip TEXT,
  ip_country TEXT,
  ship_country TEXT,
  device_id TEXT,
  shipping_address TEXT,
  amount REAL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'CREATED',
  risk_score INTEGER,
  signals TEXT,                     -- JSON array
  matches TEXT,                     -- JSON array
  decision TEXT,
  popup TEXT,                       -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT,
  status TEXT DEFAULT 'OPEN',       -- OPEN | RESOLVED | ESCALATED
  complaint TEXT,
  recommendation TEXT,              -- JSON, filled by AI arbitrator
  outcome TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flagged_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,                        -- email | payer_id | device | ip | address
  hash TEXT,
  reason TEXT,
  severity INTEGER DEFAULT 50,      -- 0-100
  case_id INTEGER,
  status TEXT DEFAULT 'ACTIVE',     -- ACTIVE | CLEARED
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flag_hash ON flagged_entities(type, hash);

CREATE TABLE IF NOT EXISTS entity_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_a INTEGER,
  entity_b INTEGER,
  link_type TEXT                    -- same_device | same_address | same_payer
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  type TEXT,
  note TEXT,
  content_hash TEXT,
  prev_hash TEXT,
  entry_hash TEXT,
  created_at TEXT
);
`);

module.exports = db;

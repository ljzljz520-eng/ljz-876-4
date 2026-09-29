const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'compliance.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  high_risk INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','legal','audit','employee')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  pass_score INTEGER NOT NULL DEFAULT 80,
  high_risk_pass_score INTEGER NOT NULL DEFAULT 90,
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  min_duration_seconds INTEGER NOT NULL DEFAULT 0,
  current_version INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS quiz_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
  version INTEGER NOT NULL,
  questions_json TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  points_total INTEGER NOT NULL,
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  published_by INTEGER REFERENCES users(id),
  UNIQUE(quiz_id, version)
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
  scope TEXT NOT NULL CHECK(scope IN ('all','department','positions','users')),
  scope_value TEXT NOT NULL DEFAULT '',
  required INTEGER NOT NULL DEFAULT 1,
  due_date TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quiz_id INTEGER NOT NULL,
  version_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  questions_snapshot TEXT NOT NULL,
  answers_json TEXT,
  score INTEGER,
  points_total INTEGER NOT NULL,
  pass_threshold INTEGER NOT NULL,
  high_risk_required INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('in_progress','submitted','signed')),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  duration_seconds INTEGER,
  signed_at TEXT,
  signature_name TEXT,
  signature_text TEXT,
  client_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  prev_hash TEXT NOT NULL DEFAULT 'GENESIS',
  record_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  prev_hash TEXT NOT NULL DEFAULT 'GENESIS',
  record_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  ip_address TEXT
);
`);


// 追加式证据事件链：开考/交卷/签署各为一条不可变事件

db.exec(`
CREATE TABLE IF NOT EXISTS attempt_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('started','submitted','signed')),
  actor_id INTEGER NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  payload_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  prev_hash TEXT NOT NULL DEFAULT 'GENESIS',
  record_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_attempt ON attempt_events(attempt_id);
`);

module.exports = db;

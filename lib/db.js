import Database from 'better-sqlite3';
import path from 'node:path';
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';

const CURRENT_SCHEMA_VERSION = 3;
const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'ledgerly.sqlite');
const migrationPath = `${dbPath}.migrating`;
mkdirSync(dataDir, { recursive: true });

function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'partner',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, name)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      taken_by_user_id INTEGER REFERENCES users(id),
      business_id INTEGER REFERENCES businesses(id),
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'loan', 'draw')),
      entry_type TEXT NOT NULL DEFAULT 'spend',
      source TEXT NOT NULL DEFAULT 'wallet',
      amount INTEGER NOT NULL,
      occurred_on TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      transaction_id INTEGER REFERENCES transactions(id),
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  database.exec('CREATE INDEX IF NOT EXISTS transactions_org_date ON transactions (organization_id, occurred_on DESC)');
  database.exec('CREATE INDEX IF NOT EXISTS transactions_business ON transactions (business_id)');
  database.exec('CREATE INDEX IF NOT EXISTS audit_logs_transaction ON audit_logs (transaction_id, created_at DESC)');
}

function tableExists(database, table) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function columns(database, table) {
  return tableExists(database, table) ? database.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name) : [];
}

function copyTable(oldDb, newDb, table, fields) {
  if (!tableExists(oldDb, table)) return;
  const available = columns(oldDb, table);
  const selected = fields.filter((field) => available.includes(field));
  if (!selected.length) return;
  const placeholders = selected.map(() => '?').join(', ');
  const read = oldDb.prepare(`SELECT ${selected.join(', ')} FROM ${table}`).all();
  const insert = newDb.prepare(`INSERT OR IGNORE INTO ${table} (${selected.join(', ')}) VALUES (${placeholders})`);
  const copy = newDb.transaction((rows) => rows.forEach((row) => insert.run(...selected.map((field) => row[field]))));
  copy(read);
}

function migrateDatabase(backupPath) {
  rmSync(migrationPath, { force: true });
  const oldDb = new Database(backupPath, { readonly: true });
  const newDb = new Database(migrationPath);
  newDb.pragma('foreign_keys = ON');
  try {
    createSchema(newDb);
    copyTable(oldDb, newDb, 'organizations', ['id', 'name', 'invite_code', 'created_at']);
    copyTable(oldDb, newDb, 'users', ['id', 'organization_id', 'name', 'email', 'password_hash', 'role', 'created_at']);
    copyTable(oldDb, newDb, 'businesses', ['id', 'organization_id', 'name', 'description', 'created_at']);

    if (tableExists(oldDb, 'transactions')) {
      const oldColumns = columns(oldDb, 'transactions');
      const oldRows = oldDb.prepare('SELECT * FROM transactions').all();
      const insert = newDb.prepare(`INSERT INTO transactions
        (id, organization_id, user_id, taken_by_user_id, business_id, description, category, type, entry_type, source, amount, occurred_on, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const copyTransactions = newDb.transaction((rows) => rows.forEach((row) => {
        const entryType = oldColumns.includes('entry_type') ? row.entry_type : ({ income: 'return', expense: 'spend', loan: 'loan', draw: 'withdrawal' }[row.type] || 'spend');
        insert.run(row.id, row.organization_id, row.user_id, oldColumns.includes('taken_by_user_id') ? row.taken_by_user_id : null, oldColumns.includes('business_id') ? row.business_id : null, row.description, row.category, row.type, entryType, oldColumns.includes('source') ? row.source : 'wallet', row.amount, row.occurred_on, row.created_at);
      }));
      copyTransactions(oldRows);
    }
    copyTable(oldDb, newDb, 'sessions', ['token', 'user_id', 'expires_at']);
    copyTable(oldDb, newDb, 'audit_logs', ['id', 'organization_id', 'user_id', 'transaction_id', 'action', 'before_json', 'after_json', 'created_at']);
    newDb.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  } finally {
    oldDb.close();
    newDb.close();
  }
  rmSync(dbPath, { force: true });
  renameSync(migrationPath, dbPath);
}

const existingDatabase = existsSync(dbPath);
let currentSchemaVersion = 0;
if (existingDatabase) {
  const probe = new Database(dbPath, { readonly: true });
  currentSchemaVersion = probe.pragma('user_version', { simple: true });
  probe.close();
}

let backupPath = null;
if (existingDatabase && currentSchemaVersion < CURRENT_SCHEMA_VERSION) {
  const backupDir = path.join(dataDir, 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  backupPath = path.join(backupDir, `ledgerly-before-v${CURRENT_SCHEMA_VERSION}-${stamp}.sqlite`);
  copyFileSync(dbPath, backupPath);
  try {
    migrateDatabase(backupPath);
  } catch (error) {
    rmSync(migrationPath, { force: true });
    copyFileSync(backupPath, dbPath);
    throw new Error(`SQLite migration failed. Original backup restored from ${backupPath}: ${error.message}`);
  }
}

const db = new Database(dbPath);
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
if (!existingDatabase) {
  createSchema(db);
  db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
}

export default db;

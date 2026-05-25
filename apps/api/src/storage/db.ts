import initSqlJs, { type Database, type QueryExecResult, type SqlValue } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL, MIGRATIONS } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'nodemap.db');

let _db: Database | null = null;
let _inTransaction = false;

async function initDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  _db.exec('PRAGMA foreign_keys = ON;');
  _db.exec(SCHEMA_SQL);

  for (const migration of MIGRATIONS) {
    try { _db.exec(migration); } catch { /* column already exists */ }
  }

  persist();
  return _db;
}

export function persist(): void {
  if (!_db) return;
  const data = _db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

export const dbReady: Promise<void> = initDb().then(() => { /* ready */ });

export function getDb(): Database {
  if (!_db) throw new Error('DB not initialised — await dbReady first');
  return _db;
}

export function closeDb(): void {
  if (_db) { persist(); _db.close(); _db = null; }
}

// ─── Query helpers ────────────────────────────────────────

type Row = Record<string, unknown>;

function resultToRows(results: QueryExecResult[]): Row[] {
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]])),
  );
}

type DbParams = SqlValue[];

export function dbAll<T>(sql: string, params: unknown[] = []): T[] {
  const results = getDb().exec(sql, params as DbParams);
  return resultToRows(results) as T[];
}

export function dbGet<T>(sql: string, params: unknown[] = []): T | undefined {
  return dbAll<T>(sql, params)[0];
}

export function dbRun(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params as DbParams);
  if (!_inTransaction) persist();
}

// Use inside dbTransaction for bulk inserts — skips per-row disk write
export function dbRunBatch(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params as DbParams);
}

export function dbTransaction<T>(fn: () => T): T {
  const db = getDb();
  _inTransaction = true;
  db.exec('BEGIN;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    _inTransaction = false;
    persist();
    return result;
  } catch (err) {
    _inTransaction = false;
    db.exec('ROLLBACK;');
    throw err;
  }
}

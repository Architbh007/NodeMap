export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  upload_path TEXT,
  file_count  INTEGER NOT NULL DEFAULT 0,
  total_size  INTEGER NOT NULL DEFAULT 0,
  languages   TEXT NOT NULL DEFAULT '[]',
  framework   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id         TEXT PRIMARY KEY,
  repo_id    TEXT NOT NULL,
  path       TEXT NOT NULL,
  name       TEXT NOT NULL,
  extension  TEXT,
  size       INTEGER NOT NULL DEFAULT 0,
  type       TEXT NOT NULL DEFAULT 'other',
  language   TEXT,
  line_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_repo_id ON files(repo_id);

CREATE TABLE IF NOT EXISTS dependencies (
  id               TEXT PRIMARY KEY,
  repo_id          TEXT NOT NULL,
  source_file_id   TEXT NOT NULL,
  target_file_id   TEXT,
  target_module    TEXT,
  import_type      TEXT NOT NULL DEFAULT 'named',
  created_at       TEXT NOT NULL,
  FOREIGN KEY (repo_id)          REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (source_file_id)   REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (target_file_id)   REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deps_repo_id ON dependencies(repo_id);

CREATE TABLE IF NOT EXISTS analysis_results (
  id         TEXT PRIMARY KEY,
  repo_id    TEXT NOT NULL,
  type       TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_repo_id ON analysis_results(repo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_repo_type ON analysis_results(repo_id, type);
`;

// Migrations run after schema creation; each statement is attempted individually.
// SQLite doesn't support "ADD COLUMN IF NOT EXISTS", so we catch the duplicate-column error.
export const MIGRATIONS: string[] = [
  `ALTER TABLE files ADD COLUMN symbols TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE repositories ADD COLUMN source_url TEXT`,
];

// Database row shapes (snake_case from SQLite)
export interface RepositoryRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  upload_path: string | null;
  file_count: number;
  total_size: number;
  languages: string;
  framework: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileRow {
  id: string;
  repo_id: string;
  path: string;
  name: string;
  extension: string | null;
  size: number;
  type: string;
  language: string | null;
  line_count: number;
  symbols: string;
  created_at: string;
}

export interface DependencyRow {
  id: string;
  repo_id: string;
  source_file_id: string;
  target_file_id: string | null;
  target_module: string | null;
  import_type: string;
  created_at: string;
}

export interface AnalysisResultRow {
  id: string;
  repo_id: string;
  type: string;
  data: string;
  created_at: string;
}

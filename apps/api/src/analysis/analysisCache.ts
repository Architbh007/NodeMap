import type { RepoAnalysis } from '@nodemap/types';
import { dbGet, dbRun } from '../storage/db.js';
import { generateId, now } from '../utils/id.js';
import { buildRepoAnalysis } from './repoAnalysis.js';
import type { AnalysisResultRow } from '../types/index.js';

const ANALYSIS_TYPE = 'analysis_v1';

export function getCachedAnalysis(repoId: string): RepoAnalysis | null {
  const row = dbGet<AnalysisResultRow>(
    'SELECT data FROM analysis_results WHERE repo_id = ? AND type = ?',
    [repoId, ANALYSIS_TYPE],
  );
  if (!row) return null;
  try { return JSON.parse(row.data) as RepoAnalysis; }
  catch { return null; }
}

function setCachedAnalysis(repoId: string, analysis: RepoAnalysis): void {
  const json = JSON.stringify(analysis);
  const existing = dbGet<AnalysisResultRow>(
    'SELECT id FROM analysis_results WHERE repo_id = ? AND type = ?',
    [repoId, ANALYSIS_TYPE],
  );
  if (existing) {
    dbRun(
      'UPDATE analysis_results SET data = ?, created_at = ? WHERE id = ?',
      [json, now(), existing.id],
    );
  } else {
    dbRun(
      'INSERT INTO analysis_results (id, repo_id, type, data, created_at) VALUES (?, ?, ?, ?, ?)',
      [generateId('analysis'), repoId, ANALYSIS_TYPE, json, now()],
    );
  }
}

export function getOrBuildAnalysis(repoId: string, refresh = false): RepoAnalysis {
  if (!refresh) {
    const cached = getCachedAnalysis(repoId);
    if (cached) return cached;
  }
  const analysis = buildRepoAnalysis(repoId);
  setCachedAnalysis(repoId, analysis);
  return analysis;
}

export function invalidateAnalysis(repoId: string): void {
  dbRun(
    'DELETE FROM analysis_results WHERE repo_id = ? AND type = ?',
    [repoId, ANALYSIS_TYPE],
  );
}

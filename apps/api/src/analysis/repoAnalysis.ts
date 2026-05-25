import type {
  RepoAnalysis, ConnectionStat, HttpMethod,
} from '@nodemap/types';
import { dbAll, dbGet } from '../storage/db.js';
import type { RepositoryRow, FileRow, DependencyRow } from '../types/index.js';
import { detectEndpoints } from './endpoints/endpointDetector.js';
import { computeRiskScores } from './risk/riskEngine.js';
import { detectDeadCode } from './deadcode/deadCodeEngine.js';
import { classifyAllFiles } from './layers/layerClassifier.js';
import { findCircularGroups, flattenCircularFileIds } from './dependencies/circular.js';

/**
 * Unified repo analysis builder.
 * One pass through the DB rows produces every artefact downstream pages need.
 * Cached on disk in `analysis_results.type='analysis_v1'` keyed by repoId.
 */

const EMPTY_METHOD_COUNTS: Record<HttpMethod, number> = {
  GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0, OPTIONS: 0, HEAD: 0,
};

export interface LoadedRepoData {
  repo: RepositoryRow;
  files: FileRow[];
  deps: DependencyRow[];
  languages: string[];
}

export function loadRepoData(repoId: string): LoadedRepoData {
  const repo = dbGet<RepositoryRow>('SELECT * FROM repositories WHERE id = ?', [repoId]);
  if (!repo) throw new Error('Repository not found');
  if (repo.status !== 'ready') throw new Error(`Repository is not ready (status: ${repo.status})`);

  const files = dbAll<FileRow>(
    'SELECT * FROM files WHERE repo_id = ? ORDER BY path',
    [repoId],
  );
  const deps = dbAll<DependencyRow>(
    'SELECT * FROM dependencies WHERE repo_id = ?',
    [repoId],
  );

  let languages: string[] = [];
  try { languages = JSON.parse(repo.languages) as string[]; } catch { /* empty */ }

  return { repo, files, deps, languages };
}

export function buildRepoAnalysis(repoId: string): RepoAnalysis {
  const { repo, files, deps, languages } = loadRepoData(repoId);

  const sourceFiles = files.filter((f) => f.type === 'source');

  // 1. Circular deps
  const circularGroups = findCircularGroups(deps);
  const circularSet = flattenCircularFileIds(circularGroups);

  // 2. Endpoints
  const endpoints = detectEndpoints(repoId, files, deps);

  // 3. Risk scores
  const riskScores = computeRiskScores({
    files,
    deps,
    endpoints,
    circularFileIds: circularSet,
  });

  // 4. Dead code candidates
  const deadCodeCandidates = detectDeadCode({ files, deps, endpoints });

  // 5. Layers
  const layers = classifyAllFiles(files);

  // 6. Top connected (most-imported by others)
  const importedByCount = new Map<string, number>();
  const riskByFile = new Map(riskScores.map((r) => [r.fileId, r]));
  for (const d of deps) {
    if (!d.target_file_id) continue;
    importedByCount.set(d.target_file_id, (importedByCount.get(d.target_file_id) ?? 0) + 1);
  }
  const topConnected: ConnectionStat[] = sourceFiles
    .map((f) => ({
      fileId: f.id,
      path: f.path,
      connectionCount: importedByCount.get(f.id) ?? 0,
      riskScore: riskByFile.get(f.id)?.score ?? 0,
    }))
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 10);

  // 7. Endpoints by method
  const endpointsByMethod: Record<HttpMethod, number> = { ...EMPTY_METHOD_COUNTS };
  for (const ep of endpoints) endpointsByMethod[ep.method] = (endpointsByMethod[ep.method] ?? 0) + 1;

  // 8. Counts
  const folderSet = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) folderSet.add(parts.slice(0, i).join('/'));
  }

  const internalDeps = deps.filter((d) => d.target_file_id != null).length;
  const externalDeps = deps.length - internalDeps;

  const highRiskCount = riskScores.filter((r) => r.level === 'high' || r.level === 'critical').length;
  const mediumRiskCount = riskScores.filter((r) => r.level === 'medium').length;

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);

  // 9. Health score — composite penalty model
  const fileCount = Math.max(1, sourceFiles.length);
  const cycleHit = Math.min(40, circularGroups.length * 5);
  const deadHit = Math.min(20, Math.round((deadCodeCandidates.filter((c) => c.confidence === 'high').length / fileCount) * 100));
  const riskHit = Math.min(40, Math.round((highRiskCount / fileCount) * 100));
  const healthScore = Math.max(0, Math.round(100 - cycleHit - deadHit - riskHit));

  return {
    repoId,
    repoName: repo.name,
    framework: repo.framework ?? undefined,
    languages,
    fileCount: files.length,
    folderCount: folderSet.size,
    totalSize,

    dependencies: {
      total: deps.length,
      internal: internalDeps,
      external: externalDeps,
      circular: circularGroups,
    },

    endpoints,

    riskScores,

    deadCodeCandidates,

    layers,

    topConnected,

    endpointsByMethod,

    healthScore,
    highRiskCount,
    mediumRiskCount,
    generatedAt: new Date().toISOString(),
  };
}

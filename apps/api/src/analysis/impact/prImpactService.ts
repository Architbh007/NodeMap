import type { PrImpactResult } from '@nodemap/types';
import { getOrBuildAnalysis } from '../analysisCache.js';
import { loadRepoData } from '../repoAnalysis.js';
import {
  fetchPullRequestSummary,
  prFilesToChangedPaths,
  repoMatchesSource,
} from '../../services/githubClient.js';
import { getGithubToken } from '../../storage/settingsStore.js';
import { dbGet } from '../../storage/db.js';
import type { RepositoryRow } from '../../types/index.js';
import { computeImpactMulti } from './impactEngine.js';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveFileId(
  raw: string,
  pathToId: Map<string, string>,
  files: { id: string; path: string }[],
): string | undefined {
  const norm = normalizePath(raw);
  const direct = pathToId.get(norm);
  if (direct) return direct;

  const matches = files.filter((f) => {
    const p = normalizePath(f.path);
    return p === norm || p.endsWith(`/${norm}`);
  });
  if (matches.length === 1) return matches[0].id;
  return undefined;
}

export function buildPrImpactResult(
  repoId: string,
  changedFiles: string[],
  prMeta?: Omit<NonNullable<PrImpactResult['pr']>, 'changedFileCount'>,
): PrImpactResult {
  const data = loadRepoData(repoId);
  const analysis = getOrBuildAnalysis(repoId);
  const pathToId = new Map(data.files.map((f) => [normalizePath(f.path), f.id]));

  const fileIds: string[] = [];
  const unmatched: string[] = [];
  const matchedPaths: string[] = [];
  const seenIds = new Set<string>();

  for (const raw of changedFiles) {
    const id = resolveFileId(raw, pathToId, data.files);
    if (!id || seenIds.has(id)) {
      if (!id) unmatched.push(raw);
      continue;
    }
    seenIds.add(id);
    fileIds.push(id);
    matchedPaths.push(data.files.find((f) => f.id === id)?.path ?? raw);
  }

  const pr = prMeta
    ? { ...prMeta, changedFileCount: changedFiles.length }
    : undefined;

  if (fileIds.length === 0) {
    return {
      changedFiles: changedFiles,
      directDependents: [],
      indirectDependents: [],
      affectedEndpoints: [],
      affectedModules: [],
      riskLevel: 'low',
      riskReasons: ['None of the changed files match a file in this repository.'],
      unmatchedFiles: unmatched.length ? unmatched : undefined,
      pr,
    };
  }

  const impact = computeImpactMulti(fileIds, {
    files: data.files,
    deps: data.deps,
    endpoints: analysis.endpoints,
  });

  const riskReasons: string[] = [];
  if (impact.affectedEndpoints.length) {
    riskReasons.push(`Touches ${impact.affectedEndpoints.length} HTTP endpoint(s)`);
  }
  if (impact.directDependents.length >= 10) {
    riskReasons.push(`${impact.directDependents.length} direct dependents`);
  }
  if (impact.indirectDependents.length >= 30) {
    riskReasons.push(`${impact.indirectDependents.length} indirect dependents`);
  }
  if (!riskReasons.length) riskReasons.push('Contained change — no widespread impact detected');
  if (unmatched.length) {
    riskReasons.push(`${unmatched.length} PR file(s) not found in this repo (ignored)`);
  }

  return {
    changedFiles: matchedPaths,
    directDependents: impact.directDependents,
    indirectDependents: impact.indirectDependents,
    affectedEndpoints: impact.affectedEndpoints,
    affectedModules: impact.affectedModules,
    riskLevel: impact.riskLevel,
    riskReasons,
    unmatchedFiles: unmatched.length ? unmatched : undefined,
    pr,
  };
}

export async function buildPrImpactFromGithub(
  repoId: string,
  prUrl: string,
): Promise<PrImpactResult> {
  const token = getGithubToken();
  const summary = await fetchPullRequestSummary(prUrl, token);

  const row = dbGet<RepositoryRow>(
    'SELECT source_url FROM repositories WHERE id = ?',
    [repoId],
  );

  if (!repoMatchesSource(summary, row?.source_url)) {
    throw new Error(
      `This PR is for ${summary.owner}/${summary.repo}, but the selected repository was ingested from a different source. Re-ingest from the matching GitHub URL or pick the correct repo.`,
    );
  }

  const changedPaths = prFilesToChangedPaths(summary.changedFiles);

  return buildPrImpactResult(repoId, changedPaths, {
    owner: summary.owner,
    repo: summary.repo,
    number: summary.number,
    title: summary.title,
    url: summary.url,
    state: summary.state,
  });
}

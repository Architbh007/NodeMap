import type { RiskScore, RiskLevel, RiskInputs, DetectedEndpoint } from '@nodemap/types';
import type { FileRow, DependencyRow } from '../../types/index.js';

/**
 * Risk Scoring Engine
 *
 * Pure, deterministic risk score. No randomness, no AI.
 *
 * Formula (from spec):
 *   riskScore =
 *     incomingDeps * 3
 *   + outgoingDeps * 2
 *   + affectedEndpoints * 5
 *   + circularDependencyPenalty (= 25 if part of a cycle, else 0)
 *   + fileSizePenalty (lineCount tier)
 *   + complexityPenalty (function + class count tier)
 *
 * Output is normalised to a 0–100 scale with a soft cap, and an explanation
 * list ("reasons") is returned so the UI can show *why* something is risky.
 */

const HARD_CAP = 100;

function sizePenalty(lineCount: number): number {
  if (lineCount >= 1000) return 20;
  if (lineCount >= 500) return 12;
  if (lineCount >= 250) return 6;
  if (lineCount >= 100) return 2;
  return 0;
}

function complexityPenalty(functions: number, classes: number): number {
  const total = functions + classes * 2; // classes weighted slightly higher
  if (total >= 25) return 15;
  if (total >= 15) return 9;
  if (total >= 8) return 4;
  return 0;
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export interface RiskComputeInput {
  files: FileRow[];
  deps: DependencyRow[];
  endpoints: DetectedEndpoint[];
  circularFileIds: Set<string>;
  /** Optional: pre-computed symbols (function+class counts) per file id. */
  symbolCounts?: Map<string, { functions: number; classes: number }>;
}

function safeSymbolCount(file: FileRow): { functions: number; classes: number } {
  try {
    const s = JSON.parse(file.symbols ?? '{}');
    return {
      functions: Array.isArray(s.functions) ? s.functions.length : 0,
      classes: Array.isArray(s.classes) ? s.classes.length : 0,
    };
  } catch {
    return { functions: 0, classes: 0 };
  }
}

/**
 * Compute centrality as a simple ratio: how many other files depend on this
 * file (transitively, depth 2) divided by total file count.
 */
function computeCentrality(
  fileId: string,
  importedBy: Map<string, Set<string>>,
  totalFiles: number,
): number {
  if (totalFiles === 0) return 0;
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: fileId, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (depth > 2) continue;
    const set = importedBy.get(id);
    if (!set) continue;
    for (const src of set) {
      if (visited.has(src)) continue;
      visited.add(src);
      queue.push({ id: src, depth: depth + 1 });
    }
  }
  return visited.size / totalFiles;
}

export function computeRiskScores(input: RiskComputeInput): RiskScore[] {
  const { files, deps, endpoints, circularFileIds } = input;

  const importsCount = new Map<string, number>();
  const importedByCount = new Map<string, number>();
  const importedBySet = new Map<string, Set<string>>();

  for (const f of files) {
    importsCount.set(f.id, 0);
    importedByCount.set(f.id, 0);
    importedBySet.set(f.id, new Set());
  }

  for (const d of deps) {
    if (d.target_file_id == null) continue;
    importsCount.set(d.source_file_id, (importsCount.get(d.source_file_id) ?? 0) + 1);
    importedByCount.set(d.target_file_id, (importedByCount.get(d.target_file_id) ?? 0) + 1);
    importedBySet.get(d.target_file_id)?.add(d.source_file_id);
  }

  // affected endpoints per file (file appears in route/controller/service chain)
  const affectedEndpointsByFile = new Map<string, number>();
  for (const ep of endpoints) {
    const ids = new Set<string>();
    if (ep.routeFileId) ids.add(ep.routeFileId);
    if (ep.controllerFileId) ids.add(ep.controllerFileId);
    for (const s of ep.serviceChainIds) ids.add(s);
    for (const r of ep.repositoryChainIds) ids.add(r);
    for (const id of ids) {
      affectedEndpointsByFile.set(id, (affectedEndpointsByFile.get(id) ?? 0) + 1);
    }
  }

  const scores: RiskScore[] = [];

  for (const f of files) {
    if (f.type !== 'source') continue;
    const sym = input.symbolCounts?.get(f.id) ?? safeSymbolCount(f);
    const incomingDeps = importedByCount.get(f.id) ?? 0;
    const outgoingDeps = importsCount.get(f.id) ?? 0;
    const affected = affectedEndpointsByFile.get(f.id) ?? 0;
    const inCircular = circularFileIds.has(f.id);
    const centrality = computeCentrality(f.id, importedBySet, files.length);

    const inputs: RiskInputs = {
      incomingDeps,
      outgoingDeps,
      affectedEndpoints: affected,
      inCircularDep: inCircular,
      fileSize: f.size,
      lineCount: f.line_count,
      functionCount: sym.functions,
      classCount: sym.classes,
      centrality,
    };

    let raw =
      incomingDeps * 3 +
      outgoingDeps * 2 +
      affected * 5 +
      (inCircular ? 25 : 0) +
      sizePenalty(f.line_count) +
      complexityPenalty(sym.functions, sym.classes);

    raw += Math.round(centrality * 20);

    const score = Math.min(HARD_CAP, Math.max(0, Math.round(raw)));
    const level = levelFromScore(score);

    const reasons: string[] = [];
    if (incomingDeps >= 10) reasons.push(`${incomingDeps} files depend on this`);
    else if (incomingDeps >= 5) reasons.push(`${incomingDeps} dependents — moderately central`);
    if (outgoingDeps >= 15) reasons.push(`${outgoingDeps} outgoing imports — high coupling`);
    if (affected >= 5) reasons.push(`Affects ${affected} HTTP endpoints`);
    else if (affected >= 1) reasons.push(`On the path of ${affected} endpoint${affected > 1 ? 's' : ''}`);
    if (inCircular) reasons.push('Part of a circular dependency');
    if (f.line_count >= 500) reasons.push(`Large file (${f.line_count} LOC)`);
    if (sym.functions + sym.classes >= 15) reasons.push(`High symbol density (${sym.functions} fns / ${sym.classes} classes)`);
    if (centrality >= 0.3) reasons.push('Sits in the middle of many dependency paths');
    if (reasons.length === 0) {
      if (score === 0) reasons.push('Low connectivity, small surface area');
      else reasons.push('Modest connectivity');
    }

    scores.push({
      fileId: f.id,
      path: f.path,
      score,
      level,
      reasons,
      inputs,
    });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

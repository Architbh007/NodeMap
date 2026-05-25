import type { ImpactResult, ImpactRef, DetectedEndpoint, ArchitectureLayer, RiskLevel } from '@nodemap/types';
import type { FileRow, DependencyRow } from '../../types/index.js';
import { classifyFile } from '../layers/layerClassifier.js';

/**
 * Impact Analysis Engine
 *
 * For a given file or set of files, performs reverse BFS over the dependency
 * graph to find:
 *  - direct dependents     (files that directly import the changed file)
 *  - indirect dependents   (transitive — anything that reaches the changed file)
 *  - affected endpoints    (any endpoint whose chain includes a changed/affected file)
 *  - affected modules      (top-level directory roll-up)
 *
 * Deterministic. No AI.
 */

export interface ImpactInput {
  files: FileRow[];
  deps: DependencyRow[];
  endpoints: DetectedEndpoint[];
}

function buildReverseAdj(deps: DependencyRow[]): Map<string, Set<string>> {
  // target -> set of sources (i.e. who depends on target)
  const rev = new Map<string, Set<string>>();
  for (const d of deps) {
    if (!d.target_file_id) continue;
    let set = rev.get(d.target_file_id);
    if (!set) { set = new Set(); rev.set(d.target_file_id, set); }
    set.add(d.source_file_id);
  }
  return rev;
}

function deriveRiskLevel(directCount: number, indirectCount: number, endpointCount: number): RiskLevel {
  const total = directCount + indirectCount;
  if (endpointCount >= 5 || total >= 50) return 'critical';
  if (endpointCount >= 2 || total >= 20) return 'high';
  if (total >= 5) return 'medium';
  return 'low';
}

export function computeImpact(
  fileId: string,
  input: ImpactInput,
): ImpactResult {
  const { files, deps, endpoints } = input;
  const fileById = new Map<string, FileRow>();
  for (const f of files) fileById.set(f.id, f);
  const target = fileById.get(fileId);
  const targetPath = target?.path ?? fileId;

  const reverseAdj = buildReverseAdj(deps);

  const direct = new Set<string>();
  const indirect = new Set<string>();

  const queue: Array<{ id: string; depth: number }> = [{ id: fileId, depth: 0 }];
  const visited = new Set<string>([fileId]);

  while (queue.length) {
    const { id, depth } = queue.shift()!;
    const upstream = reverseAdj.get(id);
    if (!upstream) continue;
    for (const src of upstream) {
      if (visited.has(src)) continue;
      visited.add(src);
      if (depth === 0) direct.add(src);
      else indirect.add(src);
      queue.push({ id: src, depth: depth + 1 });
    }
  }

  function toRef(id: string): ImpactRef {
    const f = fileById.get(id);
    return {
      fileId: id,
      path: f?.path ?? id,
      layer: f ? (classifyFile(f.path, f.type) as ArchitectureLayer) : 'unknown',
    };
  }

  // Affected endpoints: endpoint whose chain contains target OR any direct/indirect dependent
  const affectedFiles = new Set<string>([fileId, ...direct, ...indirect]);
  const affectedEndpoints: DetectedEndpoint[] = [];
  for (const ep of endpoints) {
    const ids = new Set<string>();
    if (ep.routeFileId) ids.add(ep.routeFileId);
    if (ep.controllerFileId) ids.add(ep.controllerFileId);
    for (const s of ep.serviceChainIds) ids.add(s);
    for (const r of ep.repositoryChainIds) ids.add(r);
    for (const id of ids) {
      if (affectedFiles.has(id)) { affectedEndpoints.push(ep); break; }
    }
  }

  // Affected modules — top-level dirs of affected files
  const modules = new Set<string>();
  for (const id of affectedFiles) {
    const f = fileById.get(id);
    if (!f) continue;
    const top = f.path.split('/')[0];
    if (top && top !== f.name) modules.add(top);
  }

  const directRefs = [...direct].map(toRef).sort((a, b) => a.path.localeCompare(b.path));
  const indirectRefs = [...indirect].map(toRef).sort((a, b) => a.path.localeCompare(b.path));

  return {
    fileId,
    path: targetPath,
    directDependents: directRefs,
    indirectDependents: indirectRefs,
    affectedEndpoints,
    affectedModules: [...modules].sort(),
    riskLevel: deriveRiskLevel(directRefs.length, indirectRefs.length, affectedEndpoints.length),
  };
}

/**
 * Compute impact for multiple files at once (used by PR Impact page).
 * The result is the union of direct/indirect dependents minus the input set.
 */
export function computeImpactMulti(
  fileIds: string[],
  input: ImpactInput,
): ImpactResult {
  const direct = new Set<string>();
  const indirect = new Set<string>();
  const affectedEndpoints = new Map<string, DetectedEndpoint>();
  const affectedModules = new Set<string>();

  for (const id of fileIds) {
    const r = computeImpact(id, input);
    for (const ref of r.directDependents) direct.add(ref.fileId);
    for (const ref of r.indirectDependents) indirect.add(ref.fileId);
    for (const ep of r.affectedEndpoints) affectedEndpoints.set(ep.id, ep);
    for (const m of r.affectedModules) affectedModules.add(m);
  }

  // remove self-references from indirect set
  const inputSet = new Set(fileIds);
  for (const id of inputSet) { direct.delete(id); indirect.delete(id); }
  // also remove anything in direct from indirect to avoid double-counting
  for (const id of direct) indirect.delete(id);

  const fileById = new Map(input.files.map((f) => [f.id, f]));
  function toRef(id: string): ImpactRef {
    const f = fileById.get(id);
    return {
      fileId: id,
      path: f?.path ?? id,
      layer: f ? (classifyFile(f.path, f.type) as ArchitectureLayer) : 'unknown',
    };
  }

  const directRefs = [...direct].map(toRef).sort((a, b) => a.path.localeCompare(b.path));
  const indirectRefs = [...indirect].map(toRef).sort((a, b) => a.path.localeCompare(b.path));

  return {
    fileId: fileIds.join(','),
    path: fileIds.length === 1
      ? (fileById.get(fileIds[0])?.path ?? fileIds[0])
      : `${fileIds.length} files`,
    directDependents: directRefs,
    indirectDependents: indirectRefs,
    affectedEndpoints: [...affectedEndpoints.values()],
    affectedModules: [...affectedModules].sort(),
    riskLevel: deriveRiskLevel(directRefs.length, indirectRefs.length, affectedEndpoints.size),
  };
}

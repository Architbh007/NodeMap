import type { DependencyRow } from '../../types/index.js';

/**
 * Strongly-Connected-Component based circular dependency detection.
 * Tarjan's algorithm — returns groups of file IDs that participate in a cycle.
 * Single-node "components" are filtered out unless they self-loop.
 */
export function findCircularGroups(deps: DependencyRow[]): string[][] {
  const adj = new Map<string, string[]>();
  const allNodes = new Set<string>();

  for (const d of deps) {
    if (!d.target_file_id) continue;
    allNodes.add(d.source_file_id);
    allNodes.add(d.target_file_id);
    if (!adj.has(d.source_file_id)) adj.set(d.source_file_id, []);
    adj.get(d.source_file_id)!.push(d.target_file_id);
  }

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indexMap = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const components: string[][] = [];

  function strongConnect(v: string) {
    indexMap.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const successors = adj.get(v) ?? [];
    for (const w of successors) {
      if (!indexMap.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indexMap.get(w)!));
      }
    }

    if (lowlink.get(v) === indexMap.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) {
        components.push(component);
      } else {
        // self-loop?
        const id = component[0];
        if ((adj.get(id) ?? []).includes(id)) components.push(component);
      }
    }
  }

  for (const v of allNodes) {
    if (!indexMap.has(v)) strongConnect(v);
  }

  return components;
}

export function flattenCircularFileIds(groups: string[][]): Set<string> {
  const out = new Set<string>();
  for (const g of groups) for (const id of g) out.add(id);
  return out;
}

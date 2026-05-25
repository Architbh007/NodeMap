import type { GraphNode } from '@nodemap/types';

const API_PATH_RE =
  /(^|\/)(routes?|api|controllers?|handlers?|routers?|endpoints?|middleware|pages\/api)(\/|$)/i;

/** Transitive reverse BFS — all files that depend on `nodeId`. */
export function computeImpactIds(nodeId: string, graphNodes: GraphNode[]): string[] {
  const nodeMap = new Map(graphNodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const node = nodeMap.get(cur);
    for (const dep of node?.data.importedBy ?? []) {
      if (!visited.has(dep.fileId)) queue.push(dep.fileId);
    }
  }

  visited.delete(nodeId);
  return [...visited];
}

export function isApiLikeNode(node: GraphNode): boolean {
  if (node.type !== 'file') return false;
  const path = node.data.path ?? '';
  const name = path.split('/').pop() ?? '';
  return API_PATH_RE.test(path) || /route|controller|handler|middleware|api/i.test(name);
}

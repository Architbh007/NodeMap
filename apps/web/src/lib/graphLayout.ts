import type { GraphEdgeView, GraphNode } from '@nodemap/types';

export const LAYOUT_NODE_W = 220;
export const LAYOUT_NODE_H = 64;
export const LAYOUT_LEVEL_GAP_Y = 96;
const LEVEL_GAP_Y = LAYOUT_LEVEL_GAP_Y;
const SIBLING_GAP_X = 36;
const ROOT_GAP_X = 48;
const INITIAL_X = 60;
const INITIAL_Y = 40;

/** Row labels shown in flow layout (matches architecture diagram). */
export const FLOW_ROW_LABELS: Record<number, string> = {
  0: 'Entry',
  1: 'App / root',
  2: 'Pages / routes',
  3: 'Components',
  4: 'Services / context',
  5: 'Data / utils / HTTP',
  6: 'Styles / assets',
};

export function isFolderNodeType(type: string | undefined): boolean {
  return type === 'folder' || type === 'group';
}

type LayoutEdge = { source: string; target: string };

// ─── Visibility / children map (structure view only) ──────────────────────────

export function buildChildrenMap(
  visibleNodes: GraphNode[],
  expandedNodes: Set<string>,
): { childrenMap: Map<string, string[]>; roots: string[]; nodeById: Map<string, GraphNode> } {
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const nodeById = new Map(visibleNodes.map((n) => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

  for (const node of visibleNodes) {
    const pid = node.parentId;
    if (pid && visibleIds.has(pid) && expandedNodes.has(pid)) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(node.id);
    } else {
      roots.push(node.id);
    }
  }

  for (const kids of childrenMap.values()) {
    kids.sort((a, b) => {
      const na = nodeById.get(a)!;
      const nb = nodeById.get(b)!;
      const aFolder = isFolderNodeType(na.type);
      const bFolder = isFolderNodeType(nb.type);
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return (na.data.path ?? '').localeCompare(nb.data.path ?? '');
    });
  }

  return { childrenMap, roots, nodeById };
}

// ─── Flat tree (structure view) ───────────────────────────────────────────────

function subtreeWFlat(id: string, childrenMap: Map<string, string[]>): number {
  const ch = childrenMap.get(id) ?? [];
  if (ch.length === 0) return LAYOUT_NODE_W;
  const total = ch.reduce((s, c) => s + subtreeWFlat(c, childrenMap), 0)
    + (ch.length - 1) * SIBLING_GAP_X;
  return Math.max(LAYOUT_NODE_W, total);
}

function placeFlat(
  id: string,
  cx: number,
  y: number,
  childrenMap: Map<string, string[]>,
  posMap: Map<string, { x: number; y: number }>,
): void {
  posMap.set(id, { x: cx - LAYOUT_NODE_W / 2, y });
  const ch = childrenMap.get(id) ?? [];
  if (ch.length === 0) return;

  const childY = y + LAYOUT_NODE_H + LEVEL_GAP_Y;
  const totalW = ch.reduce((s, c) => s + subtreeWFlat(c, childrenMap), 0)
    + (ch.length - 1) * SIBLING_GAP_X;
  let curX = cx - totalW / 2;

  for (const child of ch) {
    const w = subtreeWFlat(child, childrenMap);
    placeFlat(child, curX + w / 2, childY, childrenMap, posMap);
    curX += w + SIBLING_GAP_X;
  }
}

function computeFlatTreeLayout(
  visibleNodes: GraphNode[],
  expandedNodes: Set<string>,
): Map<string, { x: number; y: number }> {
  const { childrenMap, roots } = buildChildrenMap(visibleNodes, expandedNodes);
  const posMap = new Map<string, { x: number; y: number }>();
  let curX = INITIAL_X;
  for (const rootId of roots) {
    const w = subtreeWFlat(rootId, childrenMap);
    placeFlat(rootId, curX + w / 2, INITIAL_Y, childrenMap, posMap);
    curX += w + ROOT_GAP_X;
  }
  return posMap;
}

// ─── Global flow rows (imports / api / circular / combined) ───────────────────

function pathBaseLayer(path: string, isFolder: boolean): number {
  const p = (path || '').replace(/\\/g, '/').toLowerCase();
  const segments = p.split('/').filter(Boolean);
  const file = segments[segments.length - 1] ?? '';

  if (isFolder) {
    if (segments.length <= 1) return 0;
    if (p.endsWith('/pages') || segments.includes('pages')) return 2;
    if (p.endsWith('/components') || segments.includes('components')) return 3;
    if (p.endsWith('/services') || p.endsWith('/context') || segments.includes('services') || segments.includes('context')) return 4;
    if (p.endsWith('/data') || p.endsWith('/utils') || segments.includes('data') || segments.includes('utils')) return 5;
    if (p.endsWith('/styles') || p.endsWith('/assets') || p.endsWith('/public')) return 6;
    if (segments.includes('routes') || segments.includes('api') || segments.includes('controllers')) return 2;
    return Math.min(segments.length, 4);
  }

  if (/^main\.(j|t)sx?$/.test(file) || file === 'index.jsx' || file === 'index.tsx') return 0;
  if (/^app\.(j|t)sx?$/.test(file)) return 1;
  if (file === 'http.js' || file === 'http.ts' || file === 'api.ts' || file === 'client.ts' || file === 'apiendpoints.js') return 5;
  if (/\/pages\//.test(p) || /\/views\//.test(p)) return 2;
  if (/\/components\//.test(p) || /\/ui\//.test(p)) return 3;
  if (/\/services\//.test(p) || /\/context\//.test(p) || /\/hooks\//.test(p)) return 4;
  if (/\/data\//.test(p) || /\/utils\//.test(p) || /\/lib\//.test(p)) return 5;
  if (/\/styles\//.test(p) || /\.css$/.test(file)) return 6;
  if (/\/routes?\//.test(p) || /\/controllers?\//.test(p) || /\/handlers?\//.test(p)) return 2;
  if (/\/middleware\//.test(p)) return 1;
  if (/\/repositories?\//.test(p) || /\/models?\//.test(p) || /\/dal\//.test(p)) return 5;

  if (segments.length <= 2) return 1;
  return 3;
}

function apiPathLayer(node: GraphNode): number {
  const path = node.data.path ?? '';
  if (isFolderNodeType(node.type)) {
    if (/(^|\/)(routes?|api|endpoints?)(\/|$)/i.test(path)) return 2;
    if (/(^|\/)(controllers?|handlers?)(\/|$)/i.test(path)) return 2;
    if (/(^|\/)(services?)(\/|$)/i.test(path)) return 4;
    return pathBaseLayer(path, true);
  }
  if (/(^|\/)(routes?|api|endpoints?|middleware)(\/|$)/i.test(path)) return 2;
  if (/(^|\/)(controllers?|handlers?)(\/|$)/i.test(path)) return 2;
  if (/(^|\/)(services?)(\/|$)/i.test(path)) return 4;
  if (/(^|\/)(repositories?|repos?|models?|dal)(\/|$)/i.test(path)) return 5;
  return pathBaseLayer(path, false);
}

function assignFlowLayers(
  visibleNodes: GraphNode[],
  edgeView: GraphEdgeView,
  layoutEdges: LayoutEdge[],
): Map<string, number> {
  const nodeById = new Map(visibleNodes.map((n) => [n.id, n]));
  const layers = new Map<string, number>();

  for (const n of visibleNodes) {
    layers.set(n.id, edgeView === 'api' ? apiPathLayer(n) : pathBaseLayer(n.data.path ?? '', isFolderNodeType(n.type)));
  }

  const fileIds = visibleNodes
    .filter((n) => !isFolderNodeType(n.type))
    .map((n) => n.id);
  const fileSet = new Set(fileIds);
  const edges = layoutEdges.filter((e) => fileSet.has(e.source) && fileSet.has(e.target));

  for (let pass = 0; pass < fileIds.length + 2; pass++) {
    for (const { source, target } of edges) {
      const next = (layers.get(target) ?? 0) + 1;
      if (next > (layers.get(source) ?? 0)) layers.set(source, next);
    }
  }

  if (edgeView === 'circular') {
    const inCycle = new Set<string>();
    for (const { source, target } of edges) {
      inCycle.add(source);
      inCycle.add(target);
    }
    for (const id of fileIds) {
      if (inCycle.has(id)) layers.set(id, Math.max(layers.get(id) ?? 0, 3));
    }
  }

  const minLayer = Math.min(...layers.values(), 0);
  const normalized = new Map<string, number>();
  for (const [id, L] of layers) normalized.set(id, L - minLayer);

  return normalized;
}

function computeGlobalFlowLayout(
  visibleNodes: GraphNode[],
  edgeView: GraphEdgeView,
  layoutEdges: LayoutEdge[],
): Map<string, { x: number; y: number }> {
  const layerMap = assignFlowLayers(visibleNodes, edgeView, layoutEdges);
  const byLayer = new Map<number, GraphNode[]>();

  for (const n of visibleNodes) {
    const L = layerMap.get(n.id) ?? 0;
    if (!byLayer.has(L)) byLayer.set(L, []);
    byLayer.get(L)!.push(n);
  }

  const posMap = new Map<string, { x: number; y: number }>();
  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  let y = INITIAL_Y;

  for (const L of sortedLayers) {
    const row = byLayer.get(L)!
      .sort((a, b) => {
        const aFolder = isFolderNodeType(a.type);
        const bFolder = isFolderNodeType(b.type);
        if (aFolder !== bFolder) return aFolder ? -1 : 1;
        return (a.data.path ?? '').localeCompare(b.data.path ?? '');
      });

    let x = INITIAL_X;
    for (const n of row) {
      posMap.set(n.id, { x, y });
      x += LAYOUT_NODE_W + SIBLING_GAP_X;
    }
    y += LAYOUT_NODE_H + LEVEL_GAP_Y;
  }

  return posMap;
}

// ─── Auto-expand shallow folders for flow views ───────────────────────────────

/** Expand src + first-level feature folders so flow rows populate (e.g. EVAT-Website). */
export function getFlowExpansionIds(graphNodes: GraphNode[]): string[] {
  const ids: string[] = [];
  for (const n of graphNodes) {
    if (!isFolderNodeType(n.type)) continue;
    const path = (n.data.path ?? '').replace(/\\/g, '/');
    const depth = path.split('/').filter(Boolean).length;
    if (depth <= 3) ids.push(n.id);
  }
  return ids;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function usesFlowLayout(edgeView: GraphEdgeView): boolean {
  return edgeView !== 'structure';
}

export function computeGraphLayout(
  edgeView: GraphEdgeView,
  visibleNodes: GraphNode[],
  expandedNodes: Set<string>,
  layoutEdges: LayoutEdge[] = [],
): Map<string, { x: number; y: number }> {
  if (edgeView === 'structure') {
    return computeFlatTreeLayout(visibleNodes, expandedNodes);
  }
  return computeGlobalFlowLayout(visibleNodes, edgeView, layoutEdges);
}

/** source imports target → target row must be above source row. */
export function isHierarchicalEdge(
  source: string,
  target: string,
  posMap: Map<string, { x: number; y: number }>,
): boolean {
  const sp = posMap.get(source);
  const tp = posMap.get(target);
  if (!sp || !tp) return false;
  return tp.y + LAYOUT_NODE_H * 0.5 < sp.y;
}

export function filterEdgesForView(
  edges: Array<{ source: string; target: string }>,
  edgeView: GraphEdgeView,
  posMap: Map<string, { x: number; y: number }>,
): Array<{ source: string; target: string }> {
  if (edgeView === 'combined') {
    return edges.filter((e) => isHierarchicalEdge(e.source, e.target, posMap));
  }
  return edges.filter((e) => isHierarchicalEdge(e.source, e.target, posMap));
}

/** Row index for the dedicated Dependency Graph page (files only, no folders). */
export function dependencyGraphRow(path: string, archLayer?: string): number {
  const p = (path || '').replace(/\\/g, '/').toLowerCase();
  const file = p.split('/').pop() ?? '';

  if (/^main\.(j|t)sx?$/.test(file) || file === 'index.jsx') return 0;
  if (/^app\.(j|t)sx?$/.test(file)) return 1;
  if (/\/pages\//.test(p)) return 2;
  if (/\/components\//.test(p)) return 3;
  if (/\/services\//.test(p) || /\/context\//.test(p)) return 4;
  if (file === 'http.js' || file === 'http.ts' || /\/data\//.test(p) || /\/utils\//.test(p)) return 5;
  if (/\.css$/.test(file) || /\/styles\//.test(p)) return 6;

  const archRow: Record<string, number> = {
    entry: 0,
    route: 2,
    controller: 3,
    middleware: 1,
    service: 4,
    repository: 5,
    model: 5,
    util: 5,
    view: 3,
    config: 6,
    test: 7,
    unknown: 6,
  };
  return archRow[archLayer ?? 'unknown'] ?? 6;
}

export const DEP_GRAPH_ROW_LABELS: Record<number, string> = {
  0: 'Entry',
  1: 'App / bootstrap',
  2: 'Pages / routes',
  3: 'Components / UI',
  4: 'Services / context',
  5: 'Data / HTTP / utils',
  6: 'Styles / config',
  7: 'Tests',
};

export function getFlowRowGuide(
  visibleNodes: GraphNode[],
  edgeView: GraphEdgeView,
  layoutEdges: LayoutEdge[],
  posMap: Map<string, { x: number; y: number }>,
): { y: number; label: string }[] {
  const layerMap = assignFlowLayers(visibleNodes, edgeView, layoutEdges);
  const rowY = new Map<number, number>();
  for (const n of visibleNodes) {
    const L = layerMap.get(n.id) ?? 0;
    const y = posMap.get(n.id)?.y;
    if (y !== undefined && !rowY.has(L)) rowY.set(L, y);
  }
  return [...rowY.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([L, y]) => ({ y, label: FLOW_ROW_LABELS[L] ?? `Layer ${L}` }));
}

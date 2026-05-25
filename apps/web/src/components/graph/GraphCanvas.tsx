import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  Panel,
  type NodeTypes,
  type Node,
  type Edge,
  type ReactFlowInstance,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FolderNode } from './nodes/FolderNode';
import { FolderBgNode } from './nodes/FolderBgNode';
import { FileNode } from './nodes/FileNode';
import { ServiceNode } from './nodes/ServiceNode';
import { ModuleNode } from './nodes/ModuleNode';
import { GraphToolbar } from './GraphToolbar';
import { GraphLegend } from './GraphLegend';
import { NodeDetailPanel } from './NodeDetailPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { ContextMenu } from './ContextMenu';
import { OnboardingOverlay } from './OnboardingOverlay';
import { GraphControls } from './GraphControls';
import { useGraphStore } from '@/store/graphStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { computeImpactIds, isApiLikeNode } from '@/lib/graphAnalysis';
import {
  computeGraphLayout,
  filterEdgesForView,
  getFlowExpansionIds,
  isFolderNodeType,
  getFlowRowGuide,
  LAYOUT_NODE_H,
  LAYOUT_NODE_W,
  usesFlowLayout,
} from '@/lib/graphLayout';
import type { GraphNode, GraphEdge, EdgeType, NodeData, GraphMode, GraphEdgeView, RiskLevel } from '@nodemap/types';

const NODE_TYPES: NodeTypes = {
  folder:   FolderNode,
  folderBg: FolderBgNode,
  file:     FileNode,
  service:  ServiceNode,
  route:    ServiceNode,
  module:   ModuleNode,
  group:    FolderNode,
};

// Re-export for GraphControls
export const NODE_W = LAYOUT_NODE_W;
export const NODE_H = LAYOUT_NODE_H;

const INITIAL_FIT_MIN_ZOOM = 0.55;
const INITIAL_FIT_MAX_ZOOM = 1.0;

// A node is visible when every ancestor folder is expanded (roots always visible).
function isNodeVisible(
  nodeId: string,
  parentMap: Map<string, string>,
  expandedNodes: Set<string>,
): boolean {
  let parentId = parentMap.get(nodeId);
  while (parentId) {
    if (!expandedNodes.has(parentId)) return false;
    parentId = parentMap.get(parentId);
  }
  return true;
}

// ─── Edge colours ──────────────────────────────────────────────────────────────
const TREE_STROKE = 'rgba(99, 102, 241, 0.35)';

const IMPORT_EDGE_COLOR: Record<EdgeType, string> = {
  imports:         '#6366f1',
  contains:        'transparent',
  'api-flow':      '#10b981',
  'service-usage': '#8b5cf6',
  circular:        '#ef4444',
};

const RISK_OPACITY: Record<RiskLevel, number> = {
  low: 0.22,
  medium: 0.48,
  high: 0.78,
  critical: 1,
};

function edgeTypesForView(view: GraphEdgeView, edgeFilters: Set<string>): Set<string> {
  switch (view) {
    case 'structure':
      return new Set();
    case 'imports':
      return new Set(['imports']);
    case 'api':
      return new Set(['api-flow', 'service-usage']);
    case 'circular':
      return new Set(['circular']);
    case 'combined':
      return edgeFilters;
  }
}

function showTreeEdges(view: GraphEdgeView): boolean {
  return view === 'structure';
}

const RISK_MINIMAP_COLOR: Record<string, string> = {
  low:      '#22c55e',
  medium:   '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
};

// ─── Flow helpers ──────────────────────────────────────────────────────────────
function toFlowNode(n: GraphNode, pos: { x: number; y: number }, edgeView: GraphEdgeView): Node {
  const layered = edgeView !== 'structure';
  return {
    id: n.id,
    type: n.type,
    position: pos,
    data: n.data as Record<string, unknown>,
    selected: false,
    zIndex: n.type === 'folder' || n.type === 'group' ? 1 : 2,
    width: NODE_W,
    sourcePosition: layered ? Position.Bottom : undefined,
    targetPosition: layered ? Position.Top : undefined,
  };
}

function toTreeEdge(source: string, target: string): Edge {
  return {
    id: `tree:${source}→${target}`,
    source,
    target,
    type: 'smoothstep',
    style: { stroke: TREE_STROKE, strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 7, height: 7, color: TREE_STROKE },
    animated: false,
    selectable: false,
  };
}

function toImportEdge(
  e: GraphEdge,
  targetImportedBy = 0,
  edgeView: GraphEdgeView = 'structure',
  mode: GraphMode = 'folder',
): Edge {
  const color = IMPORT_EDGE_COLOR[e.type];
  const emphasis = edgeView !== 'structure' && edgeView !== 'combined';
  const strokeWidth = emphasis
    ? Math.min(5, 2 + targetImportedBy * 0.35)
    : Math.min(4, 1.5 + targetImportedBy * 0.3);
  const edgePath = edgeView === 'structure' ? 'smoothstep' : 'step';

  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: edgePath,
    animated: e.data?.isCircular ?? false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color },
    style: {
      stroke: color,
      strokeWidth,
      opacity: emphasis ? 0.85 : mode === 'risk' ? 0.35 : edgeView === 'combined' ? 0.55 : 0.7,
    },
    label: e.label,
    labelStyle: { fontSize: 10, fill: '#94a3b8' },
    labelBgStyle: { fill: 'hsl(0,0%,4%)', fillOpacity: 0.9 },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
interface GraphCanvasProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}

export function GraphCanvas({ graphNodes, graphEdges }: GraphCanvasProps) {
  const {
    selectNode, selectedNodeId, highlightedNodes, expandedNodes, toggleNodeExpansion,
    searchQuery, setHighlightedNodes, clearHighlight, activePanel, edgeFilters, mode, edgeView,
    mergeExpandedFolders,
  } = useGraphStore();

  const rfInstance    = useRef<ReactFlowInstance | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isInitialLoadRef    = useRef(true);
  const prevFirstNodeIdRef  = useRef<string | null>(null);
  const prevEdgeViewRef     = useRef<GraphEdgeView>(edgeView);
  const shouldFitViewRef    = useRef(true);

  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  useKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onFitView:     () => rfInstance.current?.fitView({ padding: 0.12, duration: 450, maxZoom: 1.2 }),
  });

  // ── Derived maps ────────────────────────────────────────────────────────────
  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of graphNodes) {
      if (n.parentId) map.set(n.id, n.parentId);
    }
    return map;
  }, [graphNodes]);

  const importedByCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of graphNodes) map.set(n.id, n.data.metrics?.importedByCount ?? 0);
    return map;
  }, [graphNodes]);

  const { folderGraphNodes, fileGraphNodes } = useMemo(() => {
    const folders: GraphNode[] = [];
    const files: GraphNode[]   = [];
    for (const n of graphNodes) {
      // 'group' is rendered as FolderNode and must behave like a folder
      (n.type === 'folder' || n.type === 'group' ? folders : files).push(n);
    }
    return { folderGraphNodes: folders, fileGraphNodes: files };
  }, [graphNodes]);

  // ── Visible sets ────────────────────────────────────────────────────────────
  const visibleFileNodes = useMemo(
    () => fileGraphNodes.filter((n) => isNodeVisible(n.id, parentMap, expandedNodes)),
    [fileGraphNodes, parentMap, expandedNodes],
  );

  const collapsedFolderNodes = useMemo(
    () => folderGraphNodes.filter((n) => {
      if (expandedNodes.has(n.id)) return false;
      return isNodeVisible(n.id, parentMap, expandedNodes);
    }),
    [folderGraphNodes, parentMap, expandedNodes],
  );

  const expandedFolderNodes = useMemo(
    () => folderGraphNodes.filter((n) => {
      if (!expandedNodes.has(n.id)) return false;
      return isNodeVisible(n.id, parentMap, expandedNodes);
    }),
    [folderGraphNodes, parentMap, expandedNodes],
  );

  // ── Import edge aggregation ─────────────────────────────────────────────────
  const findVisibleId = useMemo(() => {
    const visibleFileIds     = new Set(visibleFileNodes.map((n) => n.id));
    const collapsedFolderIds = new Set(collapsedFolderNodes.map((n) => n.id));
    const cache              = new Map<string, string | null>();

    function find(id: string): string | null {
      if (cache.has(id)) return cache.get(id)!;
      let result: string | null = null;
      if (visibleFileIds.has(id) || collapsedFolderIds.has(id)) {
        result = id;
      } else {
        const pid = parentMap.get(id);
        if (pid) result = find(pid);
      }
      cache.set(id, result);
      return result;
    }
    return find;
  }, [visibleFileNodes, collapsedFolderNodes, parentMap]);

  const importEdges = useMemo(() => {
    const seen   = new Set<string>();
    const result: GraphEdge[] = [];
    for (const edge of graphEdges) {
      if (edge.type === 'contains') continue;
      const src = findVisibleId(edge.source);
      const tgt = findVisibleId(edge.target);
      if (!src || !tgt || src === tgt) continue;
      const key = `${src}->${tgt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...edge, id: key, source: src, target: tgt });
    }
    return result;
  }, [graphEdges, findVisibleId]);

  const activeEdgeTypes = useMemo(
    () => edgeTypesForView(edgeView, edgeFilters),
    [edgeView, edgeFilters],
  );

  const filteredImportEdges = useMemo(
    () => importEdges.filter((e) => activeEdgeTypes.has(e.type)),
    [importEdges, activeEdgeTypes],
  );

  /** All import edges for stable global row assignment. */
  const layoutEdges = useMemo(
    () => importEdges
      .filter((e) => e.type === 'imports' || e.type === 'circular')
      .map((e) => ({ source: e.source, target: e.target })),
    [importEdges],
  );

  const [flowRowGuide, setFlowRowGuide] = useState<{ y: number; label: string }[]>([]);

  const importEdgeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of filteredImportEdges) {
      ids.add(e.source);
      ids.add(e.target);
    }
    return ids;
  }, [filteredImportEdges]);

  const apiLikeNodeIds = useMemo(
    () => new Set(graphNodes.filter(isApiLikeNode).map((n) => n.id)),
    [graphNodes],
  );

  const apiConnectedNodeIds = useMemo(() => {
    const ids = new Set(apiLikeNodeIds);
    for (const e of filteredImportEdges) {
      if (apiLikeNodeIds.has(e.source)) ids.add(e.target);
      if (apiLikeNodeIds.has(e.target)) ids.add(e.source);
    }
    return ids;
  }, [apiLikeNodeIds, filteredImportEdges]);

  const impactFocusIds = useMemo(() => {
    if (mode !== 'impact' || !selectedNodeId) return new Set<string>();
    return new Set(computeImpactIds(selectedNodeId, graphNodes));
  }, [mode, selectedNodeId, graphNodes]);

  // Impact mode: auto-highlight affected files when selection changes
  useEffect(() => {
    if (mode !== 'impact') return;
    if (!selectedNodeId) {
      clearHighlight();
      return;
    }
    setHighlightedNodes(computeImpactIds(selectedNodeId, graphNodes));
  }, [mode, selectedNodeId, graphNodes, setHighlightedNodes, clearHighlight]);

  // Auto-expand shallow folders so flow rows (pages, components, services) populate
  useEffect(() => {
    if (edgeView === 'structure') return;
    mergeExpandedFolders(getFlowExpansionIds(graphNodes));
  }, [edgeView, graphNodes, mergeExpandedFolders]);

  // ── Search highlighting (skipped in risk / impact overlay modes)
  useEffect(() => {
    if (mode === 'risk' || mode === 'impact') return;
    const q = searchQuery.trim().toLowerCase();
    if (!q) { clearHighlight(); return; }
    const matches = graphNodes
      .filter((n) => !isFolderNodeType(n.type) && (
        (n.data.path ?? '').toLowerCase().includes(q) ||
        (n.data.functions ?? []).some((f) => f.name.toLowerCase().includes(q)) ||
        (n.data.classes  ?? []).some((c) => c.name.toLowerCase().includes(q))
      ))
      .map((n) => n.id);
    setHighlightedNodes(matches);
  }, [searchQuery, graphNodes, setHighlightedNodes, clearHighlight, mode]);

  // ── React Flow state ────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (prevEdgeViewRef.current !== edgeView) {
      shouldFitViewRef.current = true;
      prevEdgeViewRef.current = edgeView;
    }

    const visibleIds = new Set([
      ...collapsedFolderNodes.map((n) => n.id),
      ...expandedFolderNodes.map((n)  => n.id),
      ...visibleFileNodes.map((n)     => n.id),
    ]);
    const allVisible = graphNodes.filter((n) => visibleIds.has(n.id));
    const posMap     = computeGraphLayout(edgeView, allVisible, expandedNodes, layoutEdges);

    const firstNodeId = graphNodes[0]?.id ?? null;
    if (firstNodeId !== prevFirstNodeIdRef.current) {
      isInitialLoadRef.current = true;
      shouldFitViewRef.current = true;
      prevFirstNodeIdRef.current = firstNodeId;
    }

    const hierarchicalKeys = new Set(
      filterEdgesForView(layoutEdges, edgeView, posMap).map((e) => `${e.source}->${e.target}`),
    );
    const displayImportEdges = filteredImportEdges.filter((e) =>
      hierarchicalKeys.has(`${e.source}->${e.target}`),
    );

    const treeEdges: Edge[] = [];
    if (showTreeEdges(edgeView)) {
      for (const folder of expandedFolderNodes) {
        for (const node of allVisible) {
          if (node.parentId === folder.id) {
            treeEdges.push(toTreeEdge(folder.id, node.id));
          }
        }
      }
    }

    setNodes(allVisible.map((n) => toFlowNode(n, posMap.get(n.id) ?? { x: 0, y: 0 }, edgeView)));
    if (usesFlowLayout(edgeView)) {
      setFlowRowGuide(getFlowRowGuide(allVisible, edgeView, layoutEdges, posMap));
    } else {
      setFlowRowGuide([]);
    }
    setEdges([
      ...treeEdges,
      ...displayImportEdges.map((e) =>
        toImportEdge(e, importedByCountMap.get(e.target) ?? 0, edgeView, mode),
      ),
    ]);

    if (isInitialLoadRef.current || shouldFitViewRef.current) {
      setTimeout(() => {
        rfInstance.current?.fitView({
          padding: 0.18,
          duration: 350,
          minZoom: INITIAL_FIT_MIN_ZOOM,
          maxZoom: INITIAL_FIT_MAX_ZOOM,
        });
      }, 80);
      isInitialLoadRef.current = false;
      shouldFitViewRef.current = false;
    }
  }, [
    collapsedFolderNodes, expandedFolderNodes, visibleFileNodes,
    filteredImportEdges, layoutEdges, expandedNodes, importedByCountMap, mode, edgeView,
    graphNodes, setNodes, setEdges,
  ]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (conn: Connection) => setNodes((ns) => addEdge(conn, ns as never) as unknown as typeof ns),
    [setNodes],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setContextMenu(null);
    if (node.type === 'folder' || node.type === 'group') {
      toggleNodeExpansion(node.id);
    } else {
      selectNode(node.id);
    }
  }, [selectNode, toggleNodeExpansion]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setContextMenu(null);
  }, [selectNode]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, rfNode: Node) => {
    event.preventDefault();
    if (rfNode.type === 'folderBg') return;
    const node = graphNodes.find((n) => n.id === rfNode.id);
    if (!node || node.type === 'folder') return;
    setContextMenu({ node, x: event.clientX, y: event.clientY });
  }, [graphNodes]);

  const getNodeOpacity = useCallback((nodeId: string, nodeType: string | undefined): number => {
    const graphNode = graphNodes.find((n) => n.id === nodeId);
    const isFolder = isFolderNodeType(nodeType);

    if (mode === 'impact') {
      if (nodeId === selectedNodeId) return 1;
      if (impactFocusIds.has(nodeId)) return 0.92;
      return selectedNodeId ? 0.1 : 0.45;
    }

    if (mode === 'risk') {
      if (highlightedNodes.size > 0) {
        return highlightedNodes.has(nodeId) ? 1 : 0.12;
      }
      if (isFolder) return 0.35;
      const risk = graphNode?.data.riskLevel ?? 'low';
      return RISK_OPACITY[risk];
    }

    // Search / filter highlights (all edge views except risk/impact)
    if (highlightedNodes.size > 0) {
      return highlightedNodes.has(nodeId) ? 1 : 0.12;
    }

    switch (edgeView) {
      case 'imports': {
        if (isFolder) return importEdgeNodeIds.has(nodeId) ? 0.5 : 0.22;
        return importEdgeNodeIds.has(nodeId) ? 1 : 0.12;
      }
      case 'api': {
        if (apiLikeNodeIds.has(nodeId)) return 1;
        if (isFolder) return 0.28;
        return apiConnectedNodeIds.has(nodeId) ? 0.75 : 0.1;
      }
      case 'circular': {
        if (isFolder) return importEdgeNodeIds.has(nodeId) ? 0.45 : 0.2;
        return importEdgeNodeIds.has(nodeId) ? 1 : 0.1;
      }
      case 'combined':
        return 1;
      default:
        return 1;
    }
  }, [
    mode, edgeView, graphNodes, highlightedNodes, importEdgeNodeIds,
    apiLikeNodeIds, apiConnectedNodeIds, selectedNodeId, impactFocusIds,
  ]);

  const styledNodes = useMemo(
    () => nodes.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
      style: {
        opacity: getNodeOpacity(n.id, n.type),
        transition: 'opacity 0.25s ease, transform 0.45s ease',
      },
    })),
    [nodes, selectedNodeId, getNodeOpacity],
  );

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onInit={(inst) => { rfInstance.current = inst as unknown as ReactFlowInstance; }}
        minZoom={0.04}
        maxZoom={3}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="hsl(0,0%,8%)" />

        <MiniMap
          position="bottom-left"
          style={{ marginLeft: activePanel ? '16rem' : '14rem' }}
          nodeColor={(node) => {
            const riskLevel = (node.data as NodeData)?.riskLevel;
            if (riskLevel && RISK_MINIMAP_COLOR[riskLevel]) return RISK_MINIMAP_COLOR[riskLevel];
            if (node.type === 'folder' || node.type === 'group') return '#4f46e5';
            return '#52525b';
          }}
          nodeStrokeWidth={0}
          zoomable
          pannable
        />

        {/* Custom viewport controls — rendered inside ReactFlow so useReactFlow() works */}
        <Panel position="bottom-right">
          <GraphControls rfInstance={rfInstance} selectedNodeId={selectedNodeId} nodes={nodes} />
        </Panel>
      </ReactFlow>

      <AnalysisPanel />
      <GraphToolbar graphNodes={graphNodes} searchInputRef={searchInputRef} />
      <GraphLegend />
      {usesFlowLayout(edgeView) && flowRowGuide.length > 0 && (
        <div
          className="absolute z-10 pointer-events-none hidden lg:block"
          style={{ left: activePanel ? '17rem' : '0.75rem', top: 0, bottom: 0 }}
        >
          {flowRowGuide.map(({ y, label }) => (
            <div
              key={label}
              className="absolute font-mono text-[9px] text-primary/40 uppercase tracking-widest whitespace-nowrap"
              style={{ top: y + LAYOUT_NODE_H / 2 - 6, left: 0 }}
            >
              {label}
            </div>
          ))}
        </div>
      )}
      <NodeDetailPanel />
      <OnboardingOverlay />

      {contextMenu && (
        <ContextMenu
          node={contextMenu.node}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

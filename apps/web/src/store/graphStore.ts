import { create } from 'zustand';
import type { GraphData, GraphNode, GraphMode, GraphEdgeView } from '@nodemap/types';

export type AnalysisPanel = 'circular' | 'deadcode' | 'stats' | 'ai';

const DEFAULT_EDGE_FILTERS = new Set(['imports', 'circular', 'api-flow', 'service-usage']);

interface GraphState {
  graphData: GraphData | null;
  selectedNodeId: string | null;
  selectedNode: GraphNode | null;
  mode: GraphMode;
  edgeView: GraphEdgeView;
  expandedNodes: Set<string>;
  highlightedNodes: Set<string>;
  edgeFilters: Set<string>;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  activePanel: AnalysisPanel | null;
  repoSourceUrl: string | null;

  setGraphData: (data: GraphData) => void;
  selectNode: (id: string | null) => void;
  setMode: (mode: GraphMode) => void;
  setEdgeView: (view: GraphEdgeView) => void;
  toggleNodeExpansion: (id: string) => void;
  mergeExpandedFolders: (ids: string[]) => void;
  setHighlightedNodes: (ids: string[]) => void;
  clearHighlight: () => void;
  toggleEdgeFilter: (type: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActivePanel: (panel: AnalysisPanel | null) => void;
  setRepoSourceUrl: (url: string | null) => void;
  expandNodeToVisible: (nodeId: string) => void;
  reset: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphData: null,
  selectedNodeId: null,
  selectedNode: null,
  mode: 'folder',
  edgeView: 'structure',
  expandedNodes: new Set<string>(),
  highlightedNodes: new Set<string>(),
  edgeFilters: new Set(DEFAULT_EDGE_FILTERS),
  isLoading: false,
  error: null,
  searchQuery: '',
  activePanel: null,
  repoSourceUrl: null,

  setGraphData: (graphData) => set({ graphData }),

  selectNode: (id) => {
    if (!id) return set({ selectedNodeId: null, selectedNode: null });
    const node = get().graphData?.nodes.find((n) => n.id === id) ?? null;
    set({ selectedNodeId: id, selectedNode: node });
  },

  setMode: (mode) => set({ mode, highlightedNodes: new Set<string>() }),

  setEdgeView: (edgeView) => set({ edgeView, highlightedNodes: new Set<string>() }),

  toggleNodeExpansion: (id) =>
    set((s) => {
      const next = new Set(s.expandedNodes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedNodes: next };
    }),

  mergeExpandedFolders: (ids) =>
    set((s) => {
      const next = new Set(s.expandedNodes);
      for (const id of ids) next.add(id);
      return { expandedNodes: next };
    }),

  setHighlightedNodes: (ids) => set({ highlightedNodes: new Set(ids) }),
  clearHighlight: () => set({ highlightedNodes: new Set() }),

  toggleEdgeFilter: (type) =>
    set((s) => {
      const next = new Set(s.edgeFilters);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { edgeFilters: next };
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setActivePanel: (activePanel) => set({ activePanel }),
  setRepoSourceUrl: (repoSourceUrl) => set({ repoSourceUrl }),

  expandNodeToVisible: (nodeId) => {
    const graphData = get().graphData;
    if (!graphData) return;
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    const newExpanded = new Set(get().expandedNodes);
    let current = nodeMap.get(nodeId);
    while (current?.parentId) {
      newExpanded.add(current.parentId);
      current = nodeMap.get(current.parentId);
    }
    set({ expandedNodes: newExpanded });
  },

  reset: () =>
    set({
      graphData: null,
      selectedNodeId: null,
      selectedNode: null,
      mode: 'folder',
      edgeView: 'structure',
      expandedNodes: new Set<string>(),
      highlightedNodes: new Set<string>(),
      edgeFilters: new Set(DEFAULT_EDGE_FILTERS),
      isLoading: false,
      error: null,
      searchQuery: '',
      activePanel: null,
      repoSourceUrl: null,
    }),
}));

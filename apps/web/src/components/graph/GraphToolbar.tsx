import { useRef, useMemo } from 'react';
import {
  Layers, GitBranch, Zap, AlertTriangle, Target, Search,
  GitMerge, Skull, BarChart2, Sparkles, Link2, CircleDot,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useGraphStore, type AnalysisPanel } from '@/store/graphStore';
import { SearchDropdown } from './SearchDropdown';
import { ExportMenu } from './ExportMenu';
import { FilterBar } from './FilterBar';
import type { GraphMode, GraphEdgeView, GraphNode } from '@nodemap/types';
import { TUNNER } from '@/constants/tunner';

const EDGE_VIEWS: { id: GraphEdgeView; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'structure', label: 'Tree',      icon: <Layers className="w-3.5 h-3.5" />,    hint: 'Folder hierarchy — one row of direct children per folder' },
  { id: 'imports',   label: 'Imports',   icon: <GitBranch className="w-3.5 h-3.5" />, hint: 'Layered import flow — dependencies above importers' },
  { id: 'api',       label: 'API',       icon: <Zap className="w-3.5 h-3.5" />,        hint: 'Layered API stack — routes → controllers → services → repos' },
  { id: 'circular',  label: 'Circular',  icon: <CircleDot className="w-3.5 h-3.5" />,  hint: 'Circular deps on a layered tree — cycles grouped on row 2' },
  { id: 'combined',  label: 'All',       icon: <Link2 className="w-3.5 h-3.5" />,      hint: 'Architecture rows + all downward relationship lines' },
];

const OVERLAY_MODES: { id: GraphMode; label: string; icon: React.ReactNode }[] = [
  { id: 'risk',   label: 'Risk',   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { id: 'impact', label: 'Impact', icon: <Target className="w-3.5 h-3.5" /> },
];

const EDGE_TYPES: { type: string; label: string; color: string; activeColor: string }[] = [
  { type: 'imports',       label: 'imports',  color: 'text-muted-foreground', activeColor: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/30' },
  { type: 'circular',      label: 'circular', color: 'text-muted-foreground', activeColor: 'text-risk-critical bg-risk-critical/10 border-risk-critical/30' },
  { type: 'api-flow',      label: 'api',      color: 'text-muted-foreground', activeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  { type: 'service-usage', label: 'services', color: 'text-muted-foreground', activeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
];

interface Props {
  graphNodes: GraphNode[];
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function GraphToolbar({ graphNodes, searchInputRef }: Props) {
  const {
    mode, setMode,
    edgeView, setEdgeView,
    searchQuery, setSearchQuery,
    activePanel, setActivePanel,
    edgeFilters, toggleEdgeFilter,
    graphData,
  } = useGraphStore();

  const localSearchRef = useRef<HTMLInputElement>(null);
  const effectiveSearchRef = searchInputRef ?? localSearchRef;

  const counts = useMemo(() => {
    if (!graphData) return { circular: 0, dead: 0 };
    return {
      circular: graphData.metadata.circularDependencyCount,
      dead: graphData.metadata.deadCodeCount,
    };
  }, [graphData]);

  const activeEdgeHint = EDGE_VIEWS.find((v) => v.id === edgeView)?.hint ?? null;

  function togglePanel(id: AnalysisPanel) {
    setActivePanel(activePanel === id ? null : id);
  }

  function selectEdgeView(view: GraphEdgeView) {
    setEdgeView(view);
    setMode('folder');
  }

  function selectOverlay(next: GraphMode) {
    setMode(mode === next ? 'folder' : next);
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5">
      {/* Edge / line view selector */}
      <div className="flex items-center gap-1.5 glass rounded-lg px-2 py-1.5 shadow-lg">
        <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest hidden sm:inline mr-0.5">
          lines
        </span>
        <div className="flex items-center gap-0.5">
          {EDGE_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              title={v.hint}
              onClick={() => selectEdgeView(v.id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all',
                edgeView === v.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              {v.icon}
              <span className="hidden sm:inline font-mono text-[11px]">{v.label}</span>
            </button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Risk / impact overlays */}
        <div className="flex items-center gap-0.5">
          {OVERLAY_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => selectOverlay(m.id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all',
                mode === m.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              {m.icon}
              <span className="hidden sm:inline font-mono text-[11px]">{m.label}</span>
            </button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Analysis panel toggles */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => togglePanel('circular')}
            title="Circular dependencies"
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-all',
              activePanel === 'circular'
                ? 'bg-risk-critical/15 text-risk-critical'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            <GitMerge className="w-3.5 h-3.5" />
            {counts.circular > 0 && (
              <span className="text-[9px] font-mono bg-risk-critical/20 text-risk-critical rounded px-1">
                {counts.circular}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => togglePanel('deadcode')}
            title="Dead code"
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-all',
              activePanel === 'deadcode'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            <Skull className="w-3.5 h-3.5" />
            {counts.dead > 0 && (
              <span className="text-[9px] font-mono bg-secondary text-muted-foreground rounded px-1">
                {counts.dead}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => togglePanel('stats')}
            title="Repository stats"
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-all',
              activePanel === 'stats'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => togglePanel('ai')}
            title={`${TUNNER.architectureBrief} (Tunner)`}
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-all',
              activePanel === 'ai'
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">{TUNNER.name}</span>
          </button>
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            ref={effectiveSearchRef as React.RefObject<HTMLInputElement>}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search… (press /)"
            className="h-7 pl-6 pr-6 text-[11px] w-44 bg-secondary/50 font-mono border border-border rounded text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ×
            </button>
          )}
          <SearchDropdown graphNodes={graphNodes} />
        </div>

        <Separator orientation="vertical" className="h-5" />

        <ExportMenu />
      </div>

      {/* Per-type filters — only when "All" is active */}
      {edgeView === 'combined' && mode === 'folder' && (
        <div className="flex items-center gap-1 glass rounded-md px-2 py-1 shadow-sm">
          <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mr-0.5">
            filter
          </span>
          {EDGE_TYPES.map((et) => {
            const active = edgeFilters.has(et.type);
            return (
              <button
                key={et.type}
                type="button"
                onClick={() => toggleEdgeFilter(et.type)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all',
                  active
                    ? et.activeColor
                    : 'border-transparent text-muted-foreground/30 hover:text-muted-foreground',
                )}
              >
                {et.label}
              </button>
            );
          })}
        </div>
      )}

      {activeEdgeHint && mode === 'folder' && (
        <div className="glass rounded-md px-3 py-1 shadow-sm pointer-events-none">
          <span className="text-[10px] font-mono text-muted-foreground/80">{activeEdgeHint}</span>
        </div>
      )}

      {mode === 'impact' && (
        <div className="glass rounded-md px-3 py-1 shadow-sm pointer-events-none">
          <span className="text-[10px] font-mono text-muted-foreground/80">
            Click a file to highlight its blast radius
          </span>
        </div>
      )}

      {mode === 'risk' && (
        <div className="glass rounded-md px-3 py-1 shadow-sm pointer-events-none">
          <span className="text-[10px] font-mono text-muted-foreground/80">
            Node opacity scales with risk score
          </span>
        </div>
      )}

      {(edgeView === 'structure' || edgeView === 'combined') && mode === 'folder' && (
        <FilterBar graphNodes={graphNodes} onFilterChange={() => {}} />
      )}
    </div>
  );
}

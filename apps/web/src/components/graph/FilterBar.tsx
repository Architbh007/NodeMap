import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/store/graphStore';
import type { GraphNode, RiskLevel } from '@nodemap/types';

interface Props {
  graphNodes: GraphNode[];
  onFilterChange: (visibleIds: Set<string> | null) => void;
}

const RISKS: { level: RiskLevel; label: string; color: string; activeColor: string }[] = [
  { level: 'low',      label: 'Low',    color: 'text-muted-foreground', activeColor: 'bg-risk-low/20 text-risk-low border-risk-low/30' },
  { level: 'medium',   label: 'Med',    color: 'text-muted-foreground', activeColor: 'bg-risk-medium/20 text-risk-medium border-risk-medium/30' },
  { level: 'high',     label: 'High',   color: 'text-muted-foreground', activeColor: 'bg-risk-high/20 text-risk-high border-risk-high/30' },
  { level: 'critical', label: 'Crit',   color: 'text-muted-foreground', activeColor: 'bg-risk-critical/20 text-risk-critical border-risk-critical/30' },
];

export function FilterBar({ graphNodes, onFilterChange }: Props) {
  const { setHighlightedNodes, clearHighlight } = useGraphStore();

  const languages = useMemo(() => {
    const langs = new Set<string>();
    for (const n of graphNodes) if (n.type === 'file' && n.data.language) langs.add(n.data.language);
    return [...langs].sort().slice(0, 6);
  }, [graphNodes]);

  function filterByRisk(level: RiskLevel) {
    const ids = graphNodes.filter((n) => n.type === 'file' && n.data.riskLevel === level).map((n) => n.id);
    if (ids.length === 0) return;
    setHighlightedNodes(ids);
  }

  function filterByLang(lang: string) {
    const ids = graphNodes.filter((n) => n.data.language === lang).map((n) => n.id);
    if (ids.length === 0) return;
    setHighlightedNodes(ids);
  }

  function filterDeadCode() {
    const ids = graphNodes
      .filter((n) => n.type === 'file' && (n.data.isDeadCode || (n.data.metrics?.importedByCount ?? 1) === 0))
      .map((n) => n.id);
    if (ids.length === 0) return;
    setHighlightedNodes(ids);
  }

  return (
    <div className="flex items-center gap-1.5 glass rounded-lg px-2.5 py-1.5 shadow-lg">
      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mr-1">Filter</span>

      {/* Risk filters */}
      {RISKS.map((r) => (
        <button
          key={r.level}
          onClick={() => filterByRisk(r.level)}
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-mono border transition-all',
            'border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50',
          )}
        >
          {r.label}
        </button>
      ))}

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Language filters */}
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => filterByLang(lang)}
          className="px-2 py-0.5 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
        >
          {lang}
        </button>
      ))}

      <div className="w-px h-4 bg-border mx-0.5" />

      <button
        onClick={filterDeadCode}
        className="px-2 py-0.5 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
      >
        dead
      </button>

      <button
        onClick={clearHighlight}
        className="px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground/50 hover:text-foreground transition-all"
      >
        clear
      </button>
    </div>
  );
}

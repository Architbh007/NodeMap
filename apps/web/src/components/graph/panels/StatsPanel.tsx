import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGraphStore } from '@/store/graphStore';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@nodemap/types';

const RISK_BAR: Record<RiskLevel, string> = {
  low:      'bg-risk-low',
  medium:   'bg-risk-medium',
  high:     'bg-risk-high',
  critical: 'bg-risk-critical',
};

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('text-[11px] font-mono', accent ? 'text-primary' : 'text-foreground')}>{value}</span>
    </div>
  );
}

export function StatsPanel() {
  const { graphData, setHighlightedNodes } = useGraphStore();

  const stats = useMemo(() => {
    if (!graphData) return null;

    const fileNodes = graphData.nodes.filter((n) => n.type === 'file');
    const meta = graphData.metadata;

    const riskCounts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const n of fileNodes) riskCounts[n.data.riskLevel ?? 'low']++;

    const langMap = new Map<string, number>();
    for (const n of fileNodes) {
      if (n.data.language) langMap.set(n.data.language, (langMap.get(n.data.language) ?? 0) + 1);
    }
    const languages = [...langMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([lang, count]) => ({ lang, count, pct: Math.round((count / (fileNodes.length || 1)) * 100) }));

    const mostImported = [...fileNodes]
      .filter((n) => (n.data.metrics?.importedByCount ?? 0) > 0)
      .sort((a, b) => (b.data.metrics?.importedByCount ?? 0) - (a.data.metrics?.importedByCount ?? 0))
      .slice(0, 8);

    const criticalCount = riskCounts.critical + riskCounts.high;
    const healthScore = Math.max(0, Math.round(
      100
      - Math.min(50, meta.circularDependencyCount * 5)
      - Math.round((meta.deadCodeCount / (fileNodes.length || 1)) * 30)
      - Math.round((criticalCount / (fileNodes.length || 1)) * 40),
    ));

    return { fileNodes, riskCounts, languages, mostImported, meta, healthScore };
  }, [graphData]);

  if (!stats) return null;

  const { fileNodes, riskCounts, languages, mostImported, meta, healthScore } = stats;
  const total = fileNodes.length || 1;
  const risks: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

  const healthColor = healthScore >= 80 ? 'text-risk-low' : healthScore >= 60 ? 'text-risk-medium' : healthScore >= 40 ? 'text-risk-high' : 'text-risk-critical';
  const healthLabel = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'fair' : healthScore >= 40 ? 'at risk' : 'critical';

  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-4">

        {/* Health score */}
        <div className="flex items-center justify-between px-2.5 py-2 rounded border border-border">
          <div className="space-y-0.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Health Score</p>
            <p className={cn('text-[10px] font-mono capitalize', healthColor)}>{healthLabel}</p>
          </div>
          <div className={cn('text-3xl font-mono font-bold tabular-nums', healthColor)}>{healthScore}</div>
        </div>

        {/* Overview */}
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Overview</p>
          <div className="rounded border border-border divide-y divide-border">
            <StatRow label="Total files"    value={meta.totalNodes} />
            <StatRow label="Total edges"    value={meta.totalEdges} />
            <StatRow label="Circular deps"  value={meta.circularDependencyCount} accent={meta.circularDependencyCount > 0} />
            <StatRow label="Dead code"      value={meta.deadCodeCount} accent={meta.deadCodeCount > 0} />
            <StatRow label="Avg risk score" value={meta.avgRiskScore.toFixed(1)} />
          </div>
        </div>

        {/* Risk distribution */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Risk Distribution</p>
          <div className="flex h-1.5 rounded overflow-hidden gap-px">
            {risks.map((r) =>
              riskCounts[r] > 0 ? (
                <div
                  key={r}
                  className={cn('h-full', RISK_BAR[r])}
                  style={{ width: `${(riskCounts[r] / total) * 100}%` }}
                  title={`${r}: ${riskCounts[r]}`}
                />
              ) : null,
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {risks.map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full shrink-0', RISK_BAR[r])} />
                <span className="text-[10px] text-muted-foreground capitalize">{r}</span>
                <span className="text-[10px] font-mono text-foreground ml-auto">{riskCounts[r]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Languages */}
        {languages.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Languages</p>
            <div className="space-y-1.5">
              {languages.map(({ lang, count, pct }) => (
                <div key={lang} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground w-16 truncate shrink-0">{lang}</span>
                  <div className="flex-1 h-1 bg-secondary rounded overflow-hidden">
                    <div className="h-full bg-primary/50 rounded" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-foreground w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most imported */}
        {mostImported.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Most Imported</p>
            <div className="space-y-0.5">
              {mostImported.map((node, i) => (
                <button
                  key={node.id}
                  className="w-full flex items-center gap-2 px-1 py-1 rounded hover:bg-secondary/40 transition-colors group text-left"
                  onClick={() => setHighlightedNodes([node.id])}
                >
                  <span className="text-[10px] font-mono text-muted-foreground/40 w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-[10px] font-mono text-foreground flex-1 truncate group-hover:text-primary transition-colors">
                    {node.data.path?.split('/').pop()}
                  </span>
                  <span className="text-[10px] font-mono text-primary shrink-0">
                    {node.data.metrics?.importedByCount}×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </ScrollArea>
  );
}

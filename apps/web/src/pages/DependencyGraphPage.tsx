import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { graphApi, analysisApi } from '@/api/client';
import { DependencyGraphCanvas } from '@/components/graph/DependencyGraphCanvas';
import { NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ArchitectureLayer } from '@nodemap/types';

const LAYERS: Array<ArchitectureLayer | 'all'> = [
  'all', 'entry', 'route', 'controller', 'middleware', 'service', 'repository',
  'model', 'util', 'view', 'config', 'test', 'unknown',
];

export function DependencyGraphPage() {
  const { repoId } = useActiveRepo();
  const { data: analysis, isLoading: aLoading, error: aErr } = useAnalysis(repoId ?? undefined);
  const { data: graph, isLoading: gLoading, error: gErr } = useQuery({
    queryKey: ['graph', repoId],
    queryFn: () => graphApi.get(repoId!),
    enabled: !!repoId,
    staleTime: 1000 * 60 * 5,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [layerFilter, setLayerFilter] = useState<ArchitectureLayer | 'all'>('all');

  const fileDeps = useMemo(() => {
    if (!graph?.data) return [];
    return graph.data.edges
      .filter((e) => e.type === 'imports' || e.type === 'circular')
      .map((e) => ({ source: e.source, target: e.target }));
  }, [graph?.data]);

  const selectedFile = useMemo(() => {
    if (!analysis || !selected) return null;
    const layer = analysis.layers.find((l) => l.fileId === selected);
    const risk = analysis.riskScores.find((r) => r.fileId === selected);
    return { layer, risk };
  }, [analysis, selected]);

  const { data: impact } = useQuery({
    queryKey: ['impact', repoId, selected],
    queryFn: () => analysisApi.impact(repoId!, selected!),
    enabled: !!repoId && !!selected,
  });

  if (!repoId) {
    return <div className="px-6 py-6"><NoRepoState title="No repository selected" subtitle="Choose a repository above to view its dependency graph." /></div>;
  }
  if (aLoading || gLoading) return <PageLoading label="Loading dependency graph…" />;
  if (aErr || gErr) return <div className="px-6 py-6"><PageError error={aErr ?? gErr} /></div>;
  if (!analysis || !graph?.data) return null;

  return (
    <div className="h-[calc(100vh-3rem)] flex">
      {/* Graph + filter bar */}
      <div className="flex-1 relative">
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1 max-w-3xl">
          {LAYERS.map((l) => {
            const active = layerFilter === l;
            return (
              <button
                key={l}
                onClick={() => setLayerFilter(l)}
                className={
                  'text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors ' +
                  (active
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40')
                }
              >
                {l}
              </button>
            );
          })}
        </div>

        <ErrorBoundary>
          <DependencyGraphCanvas
            analysis={analysis}
            deps={fileDeps}
            selectedFileId={selected ?? undefined}
            onSelect={setSelected}
            layerFilter={layerFilter === 'all' ? null : layerFilter}
          />
        </ErrorBoundary>
      </div>

      {/* Side panel */}
      <aside className="w-80 border-l border-border bg-background/95 overflow-y-auto">
        {!selected || !selectedFile ? (
          <div className="px-4 py-6 text-xs font-mono text-muted-foreground">
            <p className="text-foreground mb-1">Click a node</p>
            <p>See dependencies, impact, and risk for that file.</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">File</p>
              <p className="font-mono text-xs text-foreground break-all">{selectedFile.layer?.path}</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded-sm bg-secondary/40">{selectedFile.layer?.layer}</span>
                {selectedFile.risk && <span className="px-1.5 py-0.5 rounded-sm bg-secondary/40 capitalize">{selectedFile.risk.level} risk · {selectedFile.risk.score}</span>}
              </div>
            </div>

            {selectedFile.risk && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Why risky</p>
                <ul className="space-y-1 text-xs font-mono text-foreground/80">
                  {selectedFile.risk.reasons.map((r, i) => (
                    <li key={i}>· {r}</li>
                  ))}
                </ul>
              </div>
            )}

            {impact?.data && (
              <>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
                    Direct dependents ({impact.data.directDependents.length})
                  </p>
                  <ul className="space-y-1 text-xs font-mono">
                    {impact.data.directDependents.slice(0, 10).map((d) => (
                      <li key={d.fileId} className="truncate text-muted-foreground">{d.path}</li>
                    ))}
                    {impact.data.directDependents.length > 10 && (
                      <li className="text-muted-foreground/50">…and {impact.data.directDependents.length - 10} more</li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
                    Affected endpoints ({impact.data.affectedEndpoints.length})
                  </p>
                  {impact.data.affectedEndpoints.length === 0 ? (
                    <p className="text-xs font-mono text-muted-foreground">No endpoints affected</p>
                  ) : (
                    <ul className="space-y-1 text-xs font-mono">
                      {impact.data.affectedEndpoints.slice(0, 8).map((e) => (
                        <li key={e.id} className="text-foreground/80">
                          <span className="text-primary">{e.method}</span> {e.path}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
                    Indirect impact
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {impact.data.indirectDependents.length} indirect dependent(s), {impact.data.affectedModules.length} module(s)
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { graphApi, analysisApi } from '@/api/client';
import { DependencyGraphCanvas } from '@/components/graph/DependencyGraphCanvas';
import { NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
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
    <div className="h-[calc(100vh-44px)] flex bg-[#F8F9FB]">
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
                  'text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ' +
                  (active
                    ? 'border-[#2563EB] text-[#1D4ED8] bg-[#EFF6FF]'
                    : 'border-[#E4E7EC] text-[#6B7280] bg-white hover:text-[#111827] hover:border-[#BFDBFE]')
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
      <aside className="w-72 border-l border-[#E4E7EC] bg-white overflow-y-auto">
        {!selected || !selectedFile ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-[#374151]">Click a node</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">See dependencies, impact, and risk.</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            <div>
              <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1">File</p>
              <p className="text-[11px] font-mono text-[#374151] break-all">{selectedFile.layer?.path}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-medium px-2 py-0.5 bg-[#F3F4F6] text-[#6B7280] rounded">
                  {selectedFile.layer?.layer}
                </span>
                {selectedFile.risk && (
                  <span className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded capitalize',
                    selectedFile.risk.level === 'critical' ? 'bg-[#FEF2F2] text-[#991B1B]' :
                    selectedFile.risk.level === 'high'     ? 'bg-[#FEF3C7] text-[#92400E]' :
                    selectedFile.risk.level === 'medium'   ? 'bg-[#EFF6FF] text-[#1D4ED8]' :
                                                              'bg-[#F0FDF4] text-[#166534]'
                  )}>
                    {selectedFile.risk.level} · {selectedFile.risk.score}
                  </span>
                )}
              </div>
            </div>

            {selectedFile.risk?.reasons && selectedFile.risk.reasons.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">Why risky</p>
                <ul className="space-y-1">
                  {selectedFile.risk.reasons.map((r, i) => (
                    <li key={i} className="text-[11px] text-[#374151] flex gap-1.5">
                      <span className="shrink-0 text-[#DC2626]">·</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {impact?.data && (
              <>
                <div>
                  <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                    Direct dependents ({impact.data.directDependents.length})
                  </p>
                  <ul className="space-y-1">
                    {impact.data.directDependents.slice(0, 10).map((d) => (
                      <li key={d.fileId} className="text-[11px] font-mono text-[#6B7280] truncate">{d.path}</li>
                    ))}
                    {impact.data.directDependents.length > 10 && (
                      <li className="text-[10px] text-[#9CA3AF]">…and {impact.data.directDependents.length - 10} more</li>
                    )}
                  </ul>
                </div>

                {impact.data.affectedEndpoints.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                      Affected endpoints ({impact.data.affectedEndpoints.length})
                    </p>
                    <ul className="space-y-1">
                      {impact.data.affectedEndpoints.slice(0, 8).map((e) => (
                        <li key={e.id} className="text-[11px] font-mono">
                          <span className="text-[#2563EB] font-medium">{e.method}</span>{' '}
                          <span className="text-[#374151]">{e.path}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-[#F8F9FB] rounded-lg px-3 py-2">
                  <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-0.5">Indirect</p>
                  <p className="text-[12px] text-[#374151]">
                    {impact.data.indirectDependents.length} file(s), {impact.data.affectedModules.length} module(s)
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

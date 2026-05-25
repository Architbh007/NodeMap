import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Workflow, ArrowDown, Database } from 'lucide-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { analysisApi } from '@/api/client';
import { PageShell, NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { ArchitectureLayer, HttpMethod } from '@nodemap/types';

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-blue-400 border-blue-400/40',
  POST: 'text-green-400 border-green-400/40',
  PUT: 'text-yellow-400 border-yellow-400/40',
  PATCH: 'text-orange-400 border-orange-400/40',
  DELETE: 'text-red-400 border-red-400/40',
  OPTIONS: 'text-purple-400 border-purple-400/40',
  HEAD: 'text-gray-400 border-gray-400/40',
};

const LAYER_COLORS: Record<ArchitectureLayer, string> = {
  route:      'border-blue-400/60 text-blue-400',
  controller: 'border-purple-400/60 text-purple-400',
  service:    'border-green-400/60 text-green-400',
  repository: 'border-yellow-400/60 text-yellow-400',
  middleware: 'border-pink-400/60 text-pink-400',
  util:       'border-slate-400/60 text-slate-400',
  config:     'border-gray-400/60 text-gray-400',
  model:      'border-orange-400/60 text-orange-400',
  view:       'border-cyan-400/60 text-cyan-400',
  test:       'border-slate-500/60 text-slate-500',
  entry:      'border-primary/60 text-primary',
  unknown:    'border-neutral-500/60 text-neutral-500',
};

export function EndpointMapPage() {
  const { repoId } = useActiveRepo();
  const { data: analysis, isLoading, error } = useAnalysis(repoId ?? undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: flowRes } = useQuery({
    queryKey: ['endpoint-flow', repoId, selectedId],
    queryFn: () => analysisApi.endpointFlow(repoId!, selectedId!),
    enabled: !!repoId && !!selectedId,
  });

  const filteredEndpoints = useMemo(() => analysis?.endpoints ?? [], [analysis]);

  if (!repoId) {
    return <PageShell title="Endpoint Map" subtitle="API request → response flow"><NoRepoState title="No repository selected" subtitle="Pick a repository in the top bar." /></PageShell>;
  }
  if (isLoading) return <PageLoading label="Detecting endpoints…" />;
  if (error) return <PageShell title="Endpoint Map"><PageError error={error} /></PageShell>;
  if (!analysis) return null;

  const noEndpoints = filteredEndpoints.length === 0;

  return (
    <PageShell title="Endpoint Map" subtitle="API request → response flow">
      {noEndpoints ? (
        <div className="border border-border rounded-sm py-16 px-6 text-center space-y-3">
          <Workflow className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <h2 className="font-mono text-base text-foreground">No API endpoints detected in this repository.</h2>
          <p className="font-mono text-xs text-muted-foreground max-w-md mx-auto">
            This appears to be a static/frontend-only project, so there are no backend request flows to map.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
          {/* Endpoint list */}
          <div className="border border-border rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 bg-secondary/20">
              {filteredEndpoints.length} endpoint{filteredEndpoints.length !== 1 ? 's' : ''}
            </div>
            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto">
              {filteredEndpoints.map((ep) => {
                const active = ep.id === selectedId;
                return (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedId(ep.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-left border-b border-border/40 last:border-0',
                      active ? 'bg-primary/8 text-primary' : 'text-foreground hover:bg-secondary/40',
                    )}
                  >
                    <span className={cn('px-1.5 py-0.5 rounded-sm border text-[10px] tabular-nums shrink-0', METHOD_COLORS[ep.method])}>
                      {ep.method}
                    </span>
                    <span className="truncate">{ep.path}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flow diagram */}
          <div className="border border-border rounded-sm p-6 min-h-[400px]">
            {!selectedId ? (
              <div className="h-full flex items-center justify-center text-center">
                <div className="space-y-2">
                  <Workflow className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-mono text-foreground">Select an endpoint</p>
                  <p className="text-xs font-mono text-muted-foreground">See its full execution flow</p>
                </div>
              </div>
            ) : !flowRes?.data ? (
              <PageLoading label="Resolving execution flow…" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-mono">
                  <span className={cn('px-2 py-1 rounded-sm border text-xs tabular-nums', METHOD_COLORS[flowRes.data.endpoint.method])}>
                    {flowRes.data.endpoint.method}
                  </span>
                  <span className="text-base font-bold text-foreground">{flowRes.data.endpoint.path}</span>
                  <span className="text-[10px] text-muted-foreground/70 ml-auto px-1.5 py-0.5 border border-border rounded-sm uppercase">
                    {flowRes.data.endpoint.framework}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 pt-4">
                  {(() => {
                    const steps = flowRes.data!.steps;
                    return steps.map((s, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 w-full max-w-md">
                        <div className={cn(
                          'border rounded-sm px-3 py-2 w-full text-xs font-mono bg-background',
                          LAYER_COLORS[s.layer],
                        )}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">{s.label}</span>
                            {s.layer === 'unknown' && s.path === 'database' && <Database className="w-3 h-3" />}
                            <span className="text-[10px] uppercase tracking-widest opacity-60">{s.layer}</span>
                          </div>
                          {s.path && s.path !== s.label && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 break-all">{s.path}</p>
                          )}
                          {s.detail && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{s.detail}</p>
                          )}
                        </div>
                        {i < steps.length - 1 && (
                          <ArrowDown className="w-3 h-3 text-muted-foreground/40" />
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

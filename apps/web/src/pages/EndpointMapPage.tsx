import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, Database } from 'lucide-react';
import { IconRoute } from '@tabler/icons-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { analysisApi } from '@/api/client';
import { PageShell, NoRepoState, PageError, PageLoading, StudioCard } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { ArchitectureLayer, HttpMethod } from '@nodemap/types';

const METHOD_BADGE: Record<HttpMethod, string> = {
  GET:     'badge-GET',
  POST:    'badge-POST',
  PUT:     'badge-PUT',
  PATCH:   'badge-PATCH',
  DELETE:  'badge-DELETE',
  OPTIONS: 'badge-OPTIONS',
  HEAD:    'badge-HEAD',
};

const LAYER_STYLE: Record<ArchitectureLayer, { border: string; bg: string; text: string; badge: string }> = {
  route:      { border: 'border-[#BFDBFE]', bg: 'bg-[#EFF6FF]',  text: 'text-[#1D4ED8]', badge: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  controller: { border: 'border-[#DDD6FE]', bg: 'bg-[#F5F3FF]',  text: 'text-[#5B21B6]', badge: 'bg-[#F5F3FF] text-[#5B21B6]' },
  service:    { border: 'border-[#A7F3D0]', bg: 'bg-[#ECFDF5]',  text: 'text-[#065F46]', badge: 'bg-[#ECFDF5] text-[#065F46]' },
  repository: { border: 'border-[#FDE68A]', bg: 'bg-[#FFFBEB]',  text: 'text-[#92400E]', badge: 'bg-[#FFFBEB] text-[#92400E]' },
  middleware: { border: 'border-[#FBCFE8]', bg: 'bg-[#FDF2F8]',  text: 'text-[#9D174D]', badge: 'bg-[#FDF2F8] text-[#9D174D]' },
  util:       { border: 'border-[#E5E7EB]', bg: 'bg-[#F9FAFB]',  text: 'text-[#374151]', badge: 'bg-[#F9FAFB] text-[#374151]' },
  config:     { border: 'border-[#E5E7EB]', bg: 'bg-[#F3F4F6]',  text: 'text-[#6B7280]', badge: 'bg-[#F3F4F6] text-[#6B7280]' },
  model:      { border: 'border-[#FED7AA]', bg: 'bg-[#FFF7ED]',  text: 'text-[#92400E]', badge: 'bg-[#FFF7ED] text-[#92400E]' },
  view:       { border: 'border-[#A5F3FC]', bg: 'bg-[#ECFEFF]',  text: 'text-[#155E75]', badge: 'bg-[#ECFEFF] text-[#155E75]' },
  test:       { border: 'border-[#E2E8F0]', bg: 'bg-[#F8FAFC]',  text: 'text-[#64748B]', badge: 'bg-[#F8FAFC] text-[#64748B]' },
  entry:      { border: 'border-[#BFDBFE]', bg: 'bg-[#EFF6FF]',  text: 'text-[#1D4ED8]', badge: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  unknown:    { border: 'border-[#E5E7EB]', bg: 'bg-white',       text: 'text-[#6B7280]', badge: 'bg-[#F3F4F6] text-[#6B7280]' },
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

  const endpoints = useMemo(() => analysis?.endpoints ?? [], [analysis]);

  if (!repoId) {
    return (
      <PageShell title="Endpoint Map" subtitle="API request → response flow">
        <NoRepoState />
      </PageShell>
    );
  }
  if (isLoading) return <PageLoading label="Detecting endpoints…" />;
  if (error) return <PageShell title="Endpoint Map"><PageError error={error} /></PageShell>;
  if (!analysis) return null;

  if (endpoints.length === 0) {
    return (
      <PageShell title="Endpoint Map" subtitle="API request → response flow">
        <StudioCard className="py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
            <IconRoute size={22} className="text-[#2563EB]" />
          </div>
          <p className="text-[15px] font-medium text-[#111827]">No API endpoints detected</p>
          <p className="text-[13px] text-[#6B7280] max-w-sm text-center">
            This appears to be a static/frontend-only project with no backend request flows to map.
          </p>
        </StudioCard>
      </PageShell>
    );
  }

  return (
    <PageShell title="Endpoint Map" subtitle="API request → response flow">
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        {/* Endpoint list */}
        <StudioCard className="overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8F9FB]">
            <p className="text-[12px] font-medium text-[#374151]">
              {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            {endpoints.map((ep) => {
              const isActive = ep.id === selectedId;
              return (
                <button
                  key={ep.id}
                  onClick={() => setSelectedId(ep.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[#E4E7EC]/60 last:border-0 text-left transition-colors',
                    isActive ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8F9FB]',
                  )}
                >
                  <span className={METHOD_BADGE[ep.method]}>{ep.method}</span>
                  <span className="truncate text-[12px] font-mono text-[#374151]">{ep.path}</span>
                </button>
              );
            })}
          </div>
        </StudioCard>

        {/* Flow diagram */}
        <StudioCard className="min-h-[400px]">
          {!selectedId ? (
            <div className="h-full flex items-center justify-center text-center py-20">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-3">
                  <IconRoute size={20} className="text-[#2563EB]" />
                </div>
                <p className="text-[14px] font-medium text-[#374151]">Select an endpoint</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">View its full execution flow</p>
              </div>
            </div>
          ) : !flowRes?.data ? (
            <PageLoading label="Resolving execution flow…" />
          ) : (
            <div className="p-5 space-y-4">
              {/* Endpoint header */}
              <div className="flex items-center gap-3 pb-4 border-b border-[#E4E7EC]">
                <span className={METHOD_BADGE[flowRes.data.endpoint.method]}>
                  {flowRes.data.endpoint.method}
                </span>
                <span className="text-[16px] font-semibold text-[#111827] font-mono">
                  {flowRes.data.endpoint.path}
                </span>
                <span className="ml-auto text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] px-2 py-1 bg-[#F3F4F6] rounded-md">
                  {flowRes.data.endpoint.framework}
                </span>
              </div>

              {/* Steps */}
              <div className="flex flex-col items-center gap-0 pt-2">
                {flowRes.data.steps.map((s, i) => {
                  const style = LAYER_STYLE[s.layer];
                  return (
                    <div key={i} className="flex flex-col items-center w-full max-w-lg">
                      <div className={cn(
                        'w-full border rounded-lg px-4 py-3',
                        style.border, style.bg,
                      )}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {s.layer === 'unknown' && s.path === 'database' && (
                              <Database className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                            )}
                            <span className={cn('text-[13px] font-medium', style.text)}>
                              {s.label}
                            </span>
                          </div>
                          <span className={cn(
                            'text-[9px] font-medium uppercase tracking-[0.06em] px-1.5 py-0.5 rounded',
                            style.badge,
                          )}>
                            {s.layer}
                          </span>
                        </div>
                        {s.path && s.path !== s.label && (
                          <p className="text-[11px] font-mono text-[#6B7280] mt-1 break-all">
                            {s.path}
                          </p>
                        )}
                        {s.detail && (
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{s.detail}</p>
                        )}
                      </div>
                      {i < flowRes.data!.steps.length - 1 && (
                        <div className="flex flex-col items-center py-1.5">
                          <div className="w-px h-4 bg-[#E4E7EC]" />
                          <ArrowDown className="w-3 h-3 text-[#9CA3AF]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </StudioCard>
      </div>
    </PageShell>
  );
}

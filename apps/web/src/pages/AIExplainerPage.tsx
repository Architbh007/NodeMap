import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, FileCode, AlertTriangle } from 'lucide-react';
import { IconSparkles, IconSettings } from '@tabler/icons-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { aiApi } from '@/api/client';
import { PageShell, NoRepoState, PageError, PageLoading, StudioCard } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { AiNodeExplain, AiRepoBrief } from '@nodemap/types';
import { TUNNER } from '@/constants/tunner';

export function AIExplainerPage() {
  const { repoId } = useActiveRepo();
  const { data: analysis, isLoading, error } = useAnalysis(repoId ?? undefined);
  const { data: statusRes } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.status(),
    staleTime: 1000 * 30,
  });

  const [query, setQuery]         = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explain, setExplain]     = useState<AiNodeExplain | null>(null);
  const [brief, setBrief]         = useState<AiRepoBrief | null>(null);
  const [busy, setBusy]           = useState(false);
  const [errStr, setErrStr]       = useState<string | null>(null);

  const files = useMemo(() => {
    if (!analysis) return [];
    if (!query.trim()) return analysis.layers.slice(0, 50);
    const q = query.toLowerCase();
    return analysis.layers.filter((l) => l.path.toLowerCase().includes(q)).slice(0, 100);
  }, [analysis, query]);

  const aiOn = statusRes?.data?.configured === true;

  async function runExplain(fileId: string) {
    if (!repoId) return;
    setSelectedId(fileId); setBusy(true); setErrStr(null); setExplain(null); setBrief(null);
    try {
      const res = await aiApi.explain(repoId, fileId);
      if (!res.data) throw new Error(res.error ?? 'Empty response');
      setExplain(res.data);
    } catch (e) {
      setErrStr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function runBrief() {
    if (!repoId) return;
    setBusy(true); setErrStr(null); setBrief(null); setExplain(null); setSelectedId(null);
    try {
      const res = await aiApi.briefRepo(repoId);
      if (!res.data) throw new Error(res.error ?? 'Empty response');
      setBrief(res.data);
    } catch (e) {
      setErrStr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (!repoId) return <PageShell title={TUNNER.name}><NoRepoState /></PageShell>;
  if (isLoading) return <PageLoading label="Loading analysis…" />;
  if (error) return <PageShell title={TUNNER.name}><PageError error={error} /></PageShell>;

  return (
    <PageShell title={TUNNER.name} subtitle={TUNNER.tagline}>
      {/* AI not configured warning */}
      {!aiOn && (
        <div className="flex items-start gap-3 p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[13px] font-medium text-[#92400E]">{TUNNER.notConfigured}</p>
            <p className="text-[12px] text-[#D97706]">{TUNNER.configureHint}</p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-[12px] text-[#2563EB] hover:underline mt-1"
            >
              <IconSettings size={13} /> Open Settings
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4">
        {/* Left column: controls + file list */}
        <div className="space-y-3">
          {/* Repo brief button */}
          <button
            disabled={!aiOn || busy}
            onClick={runBrief}
            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <IconSparkles size={15} />
            {TUNNER.briefAction}
          </button>

          {/* File search + list */}
          <StudioCard className="overflow-hidden">
            <div className="relative border-b border-[#E4E7EC]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files…"
                className="w-full bg-transparent pl-9 pr-3 py-2.5 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
              />
            </div>
            <div className="max-h-[calc(100vh-24rem)] overflow-y-auto">
              {files.map((f) => {
                const isSelected = selectedId === f.fileId;
                return (
                  <button
                    key={f.fileId}
                    onClick={() => runExplain(f.fileId)}
                    disabled={!aiOn || busy}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[#E4E7EC]/60 last:border-0 text-left transition-colors disabled:opacity-50',
                      isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8F9FB]',
                    )}
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" />
                    <span className={cn(
                      'flex-1 truncate text-[12px] font-mono',
                      isSelected ? 'text-[#1D4ED8]' : 'text-[#374151]',
                    )}>
                      {f.path}
                    </span>
                    <span className="ml-auto text-[9px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] shrink-0">
                      {f.layer}
                    </span>
                  </button>
                );
              })}
            </div>
          </StudioCard>
        </div>

        {/* Right column: output */}
        <StudioCard className="min-h-[400px]">
          {busy ? (
            <div className="h-full flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin" />
                <p className="text-[13px] text-[#6B7280]">{TUNNER.thinking}</p>
              </div>
            </div>
          ) : errStr ? (
            <div className="p-5">
              <PageError error={errStr} />
            </div>
          ) : brief ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-4 border-b border-[#E4E7EC]">
                <IconSparkles size={16} className="text-[#2563EB]" />
                <p className="text-[14px] font-medium text-[#111827]">Repository Overview</p>
              </div>
              <div className="space-y-4">
                <Section title="Summary" content={brief.summary} />
                {brief.entryPoints.length > 0 && (
                  <Section title="Entry Points">
                    <ul className="space-y-1">
                      {brief.entryPoints.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] font-mono text-[#374151]">
                          <span className="text-[#2563EB] shrink-0">→</span> {p}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {brief.risks.length > 0 && (
                  <Section title="Identified Risks">
                    <ul className="space-y-1.5">
                      {brief.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-[#374151]">
                          <span className="shrink-0 w-1 h-1 rounded-full bg-[#DC2626] mt-[6px]" /> {r}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            </div>
          ) : explain ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-4 border-b border-[#E4E7EC]">
                <IconSparkles size={16} className="text-[#2563EB]" />
                <p className="text-[13px] font-mono text-[#374151] truncate flex-1">{explain.path}</p>
              </div>
              <div className="space-y-4">
                <Section title="Summary"          content={explain.summary} />
                <Section title="Role"             content={explain.role} />
                <Section title="Impact"           content={explain.impact} />
                <Section title="Safe to Change"   content={explain.safeToChange} />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center py-20 text-center">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mx-auto">
                  <IconSparkles size={20} className="text-[#2563EB]" />
                </div>
                <p className="text-[14px] font-medium text-[#374151]">{TUNNER.chooseFile}</p>
                <p className="text-[12px] text-[#9CA3AF] max-w-xs">
                  Select a file on the left or generate a full repo brief above.
                </p>
              </div>
            </div>
          )}
        </StudioCard>
      </div>
    </PageShell>
  );
}

function Section({
  title,
  content,
  children,
}: {
  title: string;
  content?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">{title}</p>
      {content && <p className="text-[13px] text-[#374151] leading-relaxed">{content}</p>}
      {children}
    </div>
  );
}

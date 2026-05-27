import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Sparkles, FileCode } from 'lucide-react';
import { IconFlame } from '@tabler/icons-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { analysisApi, aiApi } from '@/api/client';
import { PageShell, NoRepoState, PageError, PageLoading, StudioCard } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@nodemap/types';
import { TUNNER } from '@/constants/tunner';

const RISK_META: Record<RiskLevel, { badge: string; dot: string; label: string }> = {
  critical: { badge: 'badge-critical', dot: 'bg-[#DC2626]', label: 'Critical' },
  high:     { badge: 'badge-high',     dot: 'bg-[#D97706]', label: 'High' },
  medium:   { badge: 'badge-medium',   dot: 'bg-[#2563EB]', label: 'Medium' },
  low:      { badge: 'badge-low',      dot: 'bg-[#059669]', label: 'Low' },
};

export function RiskMapPage() {
  const { repoId } = useActiveRepo();
  const { data: analysis, isLoading, error } = useAnalysis(repoId ?? undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<RiskLevel | 'all'>('all');
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { data: impactRes } = useQuery({
    queryKey: ['impact', repoId, selected],
    queryFn: () => analysisApi.impact(repoId!, selected!),
    enabled: !!repoId && !!selected,
  });

  const filtered = useMemo(() => {
    if (!analysis) return [];
    if (levelFilter === 'all') return analysis.riskScores;
    return analysis.riskScores.filter((r) => r.level === levelFilter);
  }, [analysis, levelFilter]);

  const selectedRisk = useMemo(
    () => (selected && analysis ? analysis.riskScores.find((r) => r.fileId === selected) : null),
    [analysis, selected],
  );

  async function explainWithAI() {
    if (!repoId || !selected) return;
    setAiBusy(true); setAiError(null); setAiOutput(null);
    try {
      const res = await aiApi.explain(repoId, selected);
      const d = res.data;
      if (!d) throw new Error('Empty AI response');
      setAiOutput(
        `**Summary**\n${d.summary}\n\n**Role**: ${d.role}\n\n**Impact**: ${d.impact}\n\n**Safe to change**: ${d.safeToChange}`,
      );
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  if (!repoId) return <PageShell title="Risk Map"><NoRepoState /></PageShell>;
  if (isLoading) return <PageLoading label="Scoring risks…" />;
  if (error) return <PageShell title="Risk Map"><PageError error={error} /></PageShell>;
  if (!analysis) return null;

  const counts = {
    critical: analysis.riskScores.filter((r) => r.level === 'critical').length,
    high:     analysis.riskScores.filter((r) => r.level === 'high').length,
    medium:   analysis.riskScores.filter((r) => r.level === 'medium').length,
    low:      analysis.riskScores.filter((r) => r.level === 'low').length,
  };

  return (
    <PageShell title="Risk Map" subtitle="Files ranked by deterministic risk score">
      {/* Risk level filter cards */}
      <div className="grid grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as RiskLevel[]).map((level) => {
          const meta = RISK_META[level];
          const isActive = levelFilter === level;
          return (
            <button
              key={level}
              onClick={() => setLevelFilter(isActive ? 'all' : level)}
              className={cn(
                'bg-white border rounded-lg px-4 py-3 text-left transition-all',
                isActive ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20' : 'border-[#E4E7EC] hover:border-[#BFDBFE]',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
                <span className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em]">{meta.label}</span>
              </div>
              <p className="text-[22px] font-medium text-[#111827] tabular-nums">{counts[level]}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">files</p>
            </button>
          );
        })}
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4">
        {/* File list */}
        <StudioCard className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E7EC] bg-[#F8F9FB]">
            <p className="text-[12px] font-medium text-[#374151]">
              {filtered.length} {levelFilter !== 'all' ? levelFilter : 'total'} files
            </p>
            {levelFilter !== 'all' && (
              <button
                onClick={() => setLevelFilter('all')}
                className="text-[11px] text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
            {filtered.slice(0, 200).map((r) => {
              const isActive = r.fileId === selected;
              const meta = RISK_META[r.level];
              return (
                <button
                  key={r.fileId}
                  onClick={() => setSelected(r.fileId)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 border-b border-[#E4E7EC]/60 last:border-0 text-left transition-colors',
                    isActive ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8F9FB]',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />
                  <span className="flex-1 truncate text-[12px] font-mono text-[#374151]">{r.path}</span>
                  <span className={meta.badge}>{r.score}</span>
                </button>
              );
            })}
          </div>
        </StudioCard>

        {/* Detail pane */}
        <StudioCard className="max-h-[calc(100vh-15rem)] overflow-y-auto">
          {!selectedRisk ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center mb-3">
                <IconFlame size={18} className="text-[#DC2626]" />
              </div>
              <p className="text-[13px] font-medium text-[#374151]">Select a file</p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">See risk details and impact</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* File info */}
              <div>
                <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1">Risk File</p>
                <p className="text-[12px] font-mono text-[#374151] break-all">{selectedRisk.path}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={RISK_META[selectedRisk.level].badge}>
                    {selectedRisk.level} · score {selectedRisk.score}
                  </span>
                </div>
              </div>

              {/* Reasons */}
              <div>
                <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-2">
                  Why it's risky
                </p>
                <ul className="space-y-1.5">
                  {selectedRisk.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-[#374151]">
                      <span className="shrink-0 w-1 h-1 rounded-full bg-[#9CA3AF] mt-[6px]" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Impact data */}
              {impactRes?.data && (
                <>
                  <div className="grid grid-cols-3 gap-2 py-1">
                    {[
                      { label: 'Direct', val: impactRes.data.directDependents.length },
                      { label: 'Indirect', val: impactRes.data.indirectDependents.length },
                      { label: 'Endpoints', val: impactRes.data.affectedEndpoints.length },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-[#F8F9FB] border border-[#E4E7EC] rounded-md px-2 py-2 text-center">
                        <p className="text-[10px] text-[#9CA3AF] uppercase tracking-[0.06em]">{label}</p>
                        <p className="text-[16px] font-medium text-[#111827] tabular-nums">{val}</p>
                      </div>
                    ))}
                  </div>

                  {impactRes.data.affectedEndpoints.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-2">
                        Affected Endpoints
                      </p>
                      <ul className="space-y-1">
                        {impactRes.data.affectedEndpoints.slice(0, 6).map((e) => (
                          <li key={e.id} className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="text-[#2563EB] font-medium">{e.method}</span>
                            <span className="text-[#374151]">{e.path}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedRisk.inputs.inCircularDep && (
                    <div className="flex items-start gap-2 text-[12px] text-[#92400E] px-3 py-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Part of a circular dependency. Refactoring is risky.</span>
                    </div>
                  )}
                </>
              )}

              {/* AI explain */}
              <div className="pt-2 border-t border-[#E4E7EC] space-y-2">
                <button
                  onClick={explainWithAI}
                  disabled={aiBusy}
                  className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium py-2 rounded-lg border border-[#BFDBFE] text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] disabled:opacity-40 disabled:cursor-wait transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiBusy ? TUNNER.thinking : TUNNER.ask}
                </button>
                {aiError && (
                  <p className="text-[11px] text-[#DC2626]">{aiError}</p>
                )}
                {aiOutput && (
                  <div className="bg-[#F8F9FB] border border-[#E4E7EC] rounded-md p-3">
                    <p className="text-[9px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                      {TUNNER.explainBy}
                    </p>
                    <div className="text-[11px] font-mono text-[#374151] whitespace-pre-wrap leading-relaxed">
                      {aiOutput}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </StudioCard>
      </div>
    </PageShell>
  );
}

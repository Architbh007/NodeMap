import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Sparkles, AlertTriangle } from 'lucide-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { analysisApi, aiApi } from '@/api/client';
import { PageShell, NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@nodemap/types';
import { TUNNER } from '@/constants/tunner';

const LEVEL_COLORS: Record<RiskLevel, string> = {
  critical: 'bg-risk-critical/20 text-risk-critical border-risk-critical/30',
  high: 'bg-risk-high/20 text-risk-high border-risk-high/30',
  medium: 'bg-risk-medium/20 text-risk-medium border-risk-medium/30',
  low: 'bg-risk-low/20 text-risk-low border-risk-low/30',
};

const LEVEL_DOT: Record<RiskLevel, string> = {
  critical: 'bg-risk-critical',
  high: 'bg-risk-high',
  medium: 'bg-risk-medium',
  low: 'bg-risk-low',
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

  if (!repoId) return <PageShell title="Risk Map"><NoRepoState title="No repository selected" /></PageShell>;
  if (isLoading) return <PageLoading label="Scoring risks…" />;
  if (error) return <PageShell title="Risk Map"><PageError error={error} /></PageShell>;
  if (!analysis) return null;

  const counts = {
    critical: analysis.riskScores.filter((r) => r.level === 'critical').length,
    high: analysis.riskScores.filter((r) => r.level === 'high').length,
    medium: analysis.riskScores.filter((r) => r.level === 'medium').length,
    low: analysis.riskScores.filter((r) => r.level === 'low').length,
  };

  return (
    <PageShell title="Risk Map" subtitle="Files ranked by deterministic risk score">
      {/* Risk distribution */}
      <div className="grid grid-cols-4 gap-2">
        {(['critical', 'high', 'medium', 'low'] as RiskLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => setLevelFilter(levelFilter === level ? 'all' : level)}
            className={cn(
              'border rounded-sm px-3 py-2 text-left transition-colors',
              levelFilter === level ? 'border-primary' : 'border-border hover:border-foreground/40',
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', LEVEL_DOT[level])} />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{level}</span>
            </div>
            <p className="text-xl font-mono font-bold mt-0.5 tabular-nums">{counts[level]}</p>
          </button>
        ))}
      </div>

      {/* Two-pane: list + detail */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4">
        <div className="border border-border rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 bg-secondary/20 flex items-center justify-between">
            <span>{filtered.length} files</span>
            {levelFilter !== 'all' && (
              <button className="text-foreground hover:text-primary" onClick={() => setLevelFilter('all')}>clear filter</button>
            )}
          </div>
          <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
            {filtered.slice(0, 200).map((r) => {
              const active = r.fileId === selected;
              return (
                <button
                  key={r.fileId}
                  onClick={() => setSelected(r.fileId)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 border-b border-border/30 last:border-0 text-xs font-mono text-left',
                    active ? 'bg-primary/8' : 'hover:bg-secondary/40',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', LEVEL_DOT[r.level])} />
                  <span className="flex-1 truncate text-foreground">{r.path}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-sm border tabular-nums', LEVEL_COLORS[r.level])}>{r.score}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="border border-border rounded-sm p-4 max-h-[calc(100vh-15rem)] overflow-y-auto">
          {!selectedRisk ? (
            <div className="text-center text-xs font-mono text-muted-foreground py-8">
              <Flame className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              Pick a file
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Risk file</p>
                <p className="font-mono text-xs text-foreground break-all">{selectedRisk.path}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-sm border', LEVEL_COLORS[selectedRisk.level])}>
                    {selectedRisk.level} · {selectedRisk.score}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Why it's risky</p>
                <ul className="space-y-1 text-xs font-mono">
                  {selectedRisk.reasons.map((r, i) => (
                    <li key={i} className="text-foreground/80">· {r}</li>
                  ))}
                </ul>
              </div>

              {impactRes?.data && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="border border-border rounded-sm px-2 py-1.5">
                      <p className="text-[10px] font-mono text-muted-foreground/60">direct</p>
                      <p className="text-sm font-mono tabular-nums">{impactRes.data.directDependents.length}</p>
                    </div>
                    <div className="border border-border rounded-sm px-2 py-1.5">
                      <p className="text-[10px] font-mono text-muted-foreground/60">indirect</p>
                      <p className="text-sm font-mono tabular-nums">{impactRes.data.indirectDependents.length}</p>
                    </div>
                    <div className="border border-border rounded-sm px-2 py-1.5">
                      <p className="text-[10px] font-mono text-muted-foreground/60">endpoints</p>
                      <p className="text-sm font-mono tabular-nums">{impactRes.data.affectedEndpoints.length}</p>
                    </div>
                  </div>

                  {impactRes.data.affectedEndpoints.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Affected endpoints</p>
                      <ul className="space-y-1 text-xs font-mono">
                        {impactRes.data.affectedEndpoints.slice(0, 6).map((e) => (
                          <li key={e.id} className="text-foreground/80"><span className="text-primary">{e.method}</span> {e.path}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedRisk.inputs.inCircularDep && (
                    <div className="flex items-start gap-2 text-xs font-mono text-risk-high px-2 py-1.5 border border-risk-high/30 rounded-sm">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>Part of a circular dependency — refactoring is risky.</span>
                    </div>
                  )}
                </>
              )}

              <div className="pt-2 border-t border-border space-y-2">
                <button
                  onClick={explainWithAI}
                  disabled={aiBusy}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-mono py-1.5 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-wait"
                >
                  <Sparkles className="w-3 h-3" />
                  {aiBusy ? TUNNER.thinking : TUNNER.ask}
                </button>
                {aiError && <p className="text-[10px] font-mono text-destructive">{aiError}</p>}
                {aiOutput && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-primary/60">{TUNNER.explainBy}</p>
                    <div className="text-xs font-mono text-foreground/90 whitespace-pre-wrap border border-border/40 rounded-sm p-2 bg-secondary/20">
                      {aiOutput}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

import { useState } from 'react';
import { GitPullRequest, Play, AlertCircle } from 'lucide-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { analysisApi } from '@/api/client';
import { PageShell, NoRepoState, PageError } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { PrImpactResult, RiskLevel } from '@nodemap/types';

const LEVEL_COLORS: Record<RiskLevel, string> = {
  critical: 'bg-risk-critical/15 text-risk-critical border-risk-critical/30',
  high:     'bg-risk-high/15 text-risk-high border-risk-high/30',
  medium:   'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  low:      'bg-risk-low/15 text-risk-low border-risk-low/30',
};

export function PRImpactPage() {
  const { repoId } = useActiveRepo();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<PrImpactResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!repoId) return;
    const files = input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (files.length === 0) { setError('Add at least one file path.'); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await analysisApi.prImpact(repoId, files);
      if (!res.data) throw new Error(res.error ?? 'Unknown error');
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!repoId) return <PageShell title="PR Impact"><NoRepoState title="No repository selected" /></PageShell>;

  return (
    <PageShell title="PR Impact" subtitle="Estimate the blast radius of a set of changed files">
      <div className="border border-border rounded-sm p-4 space-y-3 bg-secondary/10">
        <div className="flex items-start gap-2">
          <GitPullRequest className="w-4 h-4 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-mono text-foreground">Connect GitHub to analyse active pull requests.</h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              GitHub integration is coming soon. In the meantime, paste a list of changed file paths below
              (one per line) — NodeMap will compute their impact using the dependency graph.
            </p>
          </div>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder={'src/services/userService.ts\nsrc/controllers/userController.ts'}
          className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50"
        />

        <button
          disabled={busy || !input.trim()}
          onClick={run}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-wait"
        >
          <Play className="w-3 h-3" />
          {busy ? 'computing…' : 'Compute impact'}
        </button>

        {error && <PageError error={error} />}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="border border-border rounded-sm px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">changed</p>
              <p className="text-xl font-mono tabular-nums">{result.changedFiles.length}</p>
            </div>
            <div className="border border-border rounded-sm px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">direct</p>
              <p className="text-xl font-mono tabular-nums">{result.directDependents.length}</p>
            </div>
            <div className="border border-border rounded-sm px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">indirect</p>
              <p className="text-xl font-mono tabular-nums">{result.indirectDependents.length}</p>
            </div>
            <div className={cn('border rounded-sm px-3 py-2', LEVEL_COLORS[result.riskLevel])}>
              <p className="text-[10px] font-mono uppercase tracking-widest opacity-80">risk</p>
              <p className="text-xl font-mono">{result.riskLevel}</p>
            </div>
          </div>

          <div className="border border-border rounded-sm p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">Why this risk level</p>
            <ul className="space-y-1 text-xs font-mono">
              {result.riskReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/50" /> {r}</li>
              ))}
            </ul>
          </div>

          {result.affectedEndpoints.length > 0 && (
            <div className="border border-border rounded-sm">
              <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 bg-secondary/20">
                Affected endpoints ({result.affectedEndpoints.length})
              </div>
              <ul>
                {result.affectedEndpoints.slice(0, 50).map((e) => (
                  <li key={e.id} className="px-3 py-1.5 border-b border-border/30 last:border-0 text-xs font-mono">
                    <span className="text-primary mr-2">{e.method}</span>{e.path}
                    <span className="ml-2 text-muted-foreground/50">{e.routeFile}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.directDependents.length > 0 && (
            <div className="border border-border rounded-sm">
              <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 bg-secondary/20">
                Direct dependents
              </div>
              <ul>
                {result.directDependents.slice(0, 100).map((d) => (
                  <li key={d.fileId} className="px-3 py-1.5 border-b border-border/30 last:border-0 text-xs font-mono flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground/50 w-16">{d.layer}</span>
                    <span>{d.path}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

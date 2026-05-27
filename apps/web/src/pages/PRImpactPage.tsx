import { useState } from 'react';
import { GitPullRequest, Play, AlertCircle, Github, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useActiveRepo } from '@/store/activeRepoStore';
import { analysisApi, settingsApi } from '@/api/client';
import { PageShell, NoRepoState, PageError } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { PrImpactResult, RiskLevel } from '@nodemap/types';

const LEVEL_COLORS: Record<RiskLevel, string> = {
  critical: 'bg-risk-critical/15 text-risk-critical border-risk-critical/30',
  high:     'bg-risk-high/15 text-risk-high border-risk-high/30',
  medium:   'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  low:      'bg-risk-low/15 text-risk-low border-risk-low/30',
};

type InputMode = 'github' | 'manual';

export function PRImpactPage() {
  const { repoId } = useActiveRepo();
  const [mode, setMode] = useState<InputMode>('github');
  const [prUrl, setPrUrl] = useState('');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<PrImpactResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: settingsRes } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });
  const githubConnected = settingsRes?.data?.github.connected ?? false;

  async function runGithub() {
    if (!repoId) return;
    const url = prUrl.trim();
    if (!url) { setError('Paste a GitHub pull request URL.'); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await analysisApi.prImpactFromGithub(repoId, url);
      if (!res.data) throw new Error(res.error ?? 'Unknown error');
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runManual() {
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
    <PageShell
      title="PR Impact"
      subtitle="Blast-radius analysis: what depends on changed files and which endpoints are affected"
    >
      <div className="border border-border rounded-sm p-4 space-y-4 bg-secondary/10">
        <div className="flex items-start gap-2">
          <GitPullRequest className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-medium text-foreground">PR risk radar, not a code reviewer</h3>
            <p className="text-xs font-mono text-muted-foreground leading-relaxed">
              GitHub shows <em>what</em> changed. NodeMap shows <em>what else could break</em>: direct and indirect
              dependents and affected HTTP routes from your ingested dependency graph.
            </p>
          </div>
        </div>

        <div className="flex gap-1">
          {([
            { id: 'github' as const, label: 'GitHub PR', icon: Github },
            { id: 'manual' as const, label: 'Manual paths', icon: Link2 },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-mono border transition-all',
                mode === id
                  ? 'border-primary text-primary bg-primary/8'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {mode === 'github' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                Pull request URL
              </label>
              <input
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/42"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            {!githubConnected && (
              <p className="text-[10px] font-mono text-muted-foreground/70">
                Public PRs work without a token. For private repos, add a GitHub PAT in{' '}
                <Link to="/settings" className="text-primary underline">Settings</Link>{' '}
                (<code className="text-foreground/80">repo</code> scope).
              </p>
            )}
            <button
              disabled={busy || !prUrl.trim()}
              onClick={runGithub}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-wait"
            >
              <Play className="w-3 h-3" />
              {busy ? 'fetching PR & computing…' : 'Analyze pull request'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={6}
              placeholder={'src/services/userService.ts\nsrc/controllers/userController.ts'}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50"
            />
            <button
              disabled={busy || !input.trim()}
              onClick={runManual}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-wait"
            >
              <Play className="w-3 h-3" />
              {busy ? 'computing…' : 'Compute impact'}
            </button>
          </div>
        )}

        {error && <PageError error={error} />}
      </div>

      {result && (
        <div className="space-y-4">
          {result.pr && (
            <div className="border border-border rounded-sm p-4 bg-primary/5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Pull request</p>
              <a
                href={result.pr.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-mono text-primary hover:underline"
              >
                {result.pr.owner}/{result.pr.repo}#{result.pr.number}
              </a>
              <p className="text-xs font-mono text-foreground mt-1">{result.pr.title}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                {result.pr.changedFileCount} file(s) in PR · {result.changedFiles.length} matched in repo
                {result.pr.state !== 'open' && ` · ${result.pr.state}`}
              </p>
            </div>
          )}

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
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/50" /> {r}
                </li>
              ))}
            </ul>
          </div>

          {result.unmatchedFiles && result.unmatchedFiles.length > 0 && (
            <div className="border border-border rounded-sm">
              <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 bg-secondary/20">
                Unmatched PR files ({result.unmatchedFiles.length})
              </div>
              <ul>
                {result.unmatchedFiles.slice(0, 30).map((p) => (
                  <li key={p} className="px-3 py-1.5 border-b border-border/30 last:border-0 text-xs font-mono text-muted-foreground">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.changedFiles.length > 0 && (
            <div className="border border-border rounded-sm">
              <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 bg-secondary/20">
                Matched changed files
              </div>
              <ul>
                {result.changedFiles.slice(0, 100).map((p) => (
                  <li key={p} className="px-3 py-1.5 border-b border-border/30 last:border-0 text-xs font-mono">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

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

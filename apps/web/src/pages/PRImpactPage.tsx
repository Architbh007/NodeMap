import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, AlertCircle, Github, Link2 } from 'lucide-react';
import { IconGitPullRequest } from '@tabler/icons-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { analysisApi, settingsApi } from '@/api/client';
import { PageShell, NoRepoState, PageError, StudioCard } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { PrImpactResult, RiskLevel } from '@nodemap/types';

const RISK_BADGE: Record<RiskLevel, string> = {
  critical: 'badge-critical',
  high:     'badge-high',
  medium:   'badge-medium',
  low:      'badge-low',
};

type InputMode = 'github' | 'manual';

export function PRImpactPage() {
  const { repoId } = useActiveRepo();
  const [mode, setMode]     = useState<InputMode>('github');
  const [prUrl, setPrUrl]   = useState('');
  const [input, setInput]   = useState('');
  const [result, setResult] = useState<PrImpactResult | null>(null);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

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
    } finally { setBusy(false); }
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
    } finally { setBusy(false); }
  }

  if (!repoId) return <PageShell title="PR Impact"><NoRepoState title="No repository selected" /></PageShell>;

  return (
    <PageShell title="PR Impact" subtitle="Blast-radius analysis: what depends on changed files and which endpoints are affected">
      {/* Input card */}
      <StudioCard className="p-5 space-y-4">
        {/* Info row */}
        <div className="flex items-start gap-3 p-3 bg-[#EFF6FF] rounded-lg border border-[#BFDBFE]">
          <IconGitPullRequest size={16} className="text-[#2563EB] mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-[#1D4ED8]">PR risk radar, not a code reviewer</p>
            <p className="text-[12px] text-[#374151] mt-0.5 leading-relaxed">
              GitHub shows <em>what</em> changed. NodeMap shows <em>what else could break</em>: direct and
              indirect dependents and affected HTTP routes from your dependency graph.
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1.5">
          {([
            { id: 'github' as const, label: 'GitHub PR',     icon: Github },
            { id: 'manual' as const, label: 'Manual paths',  icon: Link2  },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium border transition-colors',
                mode === id
                  ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]'
                  : 'bg-white border-[#E4E7EC] text-[#6B7280] hover:text-[#111827]',
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        {mode === 'github' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                Pull Request URL
              </label>
              <input
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/42"
                className="studio-input max-w-lg font-mono"
              />
            </div>
            {!githubConnected && (
              <p className="text-[11px] text-[#9CA3AF]">
                Public PRs work without a token. For private repos, add a GitHub PAT in{' '}
                <Link to="/settings" className="text-[#2563EB] hover:underline">Settings</Link>{' '}
                (<code className="text-[#374151] text-[10px]">repo</code> scope).
              </p>
            )}
            <button
              disabled={busy || !prUrl.trim()}
              onClick={runGithub}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-wait transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {busy ? 'Fetching PR & computing…' : 'Analyze pull request'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                Changed file paths (one per line)
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={5}
                placeholder={'src/services/userService.ts\nsrc/controllers/userController.ts'}
                className="studio-input font-mono resize-none max-w-lg"
              />
            </div>
            <button
              disabled={busy || !input.trim()}
              onClick={runManual}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-wait transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {busy ? 'Computing…' : 'Compute impact'}
            </button>
          </div>
        )}

        {error && <PageError error={error} />}
      </StudioCard>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* PR info */}
          {result.pr && (
            <StudioCard className="p-4">
              <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-2">Pull Request</p>
              <a
                href={result.pr.url}
                target="_blank"
                rel="noreferrer"
                className="text-[14px] font-medium text-[#2563EB] hover:underline"
              >
                {result.pr.owner}/{result.pr.repo} #{result.pr.number}
              </a>
              <p className="text-[13px] text-[#374151] mt-1">{result.pr.title}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                {result.pr.changedFileCount} file(s) in PR · {result.changedFiles.length} matched in repo
                {result.pr.state !== 'open' && ` · ${result.pr.state}`}
              </p>
            </StudioCard>
          )}

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Changed',  val: result.changedFiles.length,       cls: 'text-[#111827]' },
              { label: 'Direct',   val: result.directDependents.length,   cls: 'text-[#111827]' },
              { label: 'Indirect', val: result.indirectDependents.length, cls: 'text-[#111827]' },
              { label: 'Risk',     val: result.riskLevel,                 cls: '', badge: RISK_BADGE[result.riskLevel] },
            ].map(({ label, val, cls, badge }) => (
              <StudioCard key={label} className="px-4 py-3">
                <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em]">{label}</p>
                {badge
                  ? <span className={`${badge} mt-2 inline-block`}>{val}</span>
                  : <p className={`text-[22px] font-medium tabular-nums mt-1 ${cls}`}>{val}</p>
                }
              </StudioCard>
            ))}
          </div>

          {/* Risk reasons */}
          {result.riskReasons.length > 0 && (
            <StudioCard className="p-4">
              <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-3">Why this risk level</p>
              <ul className="space-y-2">
                {result.riskReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-[#374151]">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#9CA3AF]" />
                    {r}
                  </li>
                ))}
              </ul>
            </StudioCard>
          )}

          {/* File lists */}
          {[
            { title: 'Matched Changed Files', items: result.changedFiles.slice(0, 100), keyFn: (s: string) => s, renderFn: (s: string) => s },
            { title: 'Unmatched PR Files',    items: result.unmatchedFiles?.slice(0, 30) ?? [],    keyFn: (s: string) => s, renderFn: (s: string) => s },
          ].map(({ title, items }) => items.length > 0 && (
            <StudioCard key={title} className="overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8F9FB]">
                <p className="text-[12px] font-medium text-[#374151]">{title} ({items.length})</p>
              </div>
              <ul>
                {items.map((p) => (
                  <li key={p} className="px-4 py-2 border-b border-[#E4E7EC]/60 last:border-0 text-[11px] font-mono text-[#374151]">
                    {p}
                  </li>
                ))}
              </ul>
            </StudioCard>
          ))}

          {/* Affected endpoints */}
          {result.affectedEndpoints.length > 0 && (
            <StudioCard className="overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8F9FB]">
                <p className="text-[12px] font-medium text-[#374151]">
                  Affected Endpoints ({result.affectedEndpoints.length})
                </p>
              </div>
              <ul>
                {result.affectedEndpoints.slice(0, 50).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E4E7EC]/60 last:border-0 text-[12px]">
                    <span className="font-medium text-[#2563EB] w-14 shrink-0">{e.method}</span>
                    <span className="font-mono text-[#374151]">{e.path}</span>
                    <span className="ml-auto text-[11px] text-[#9CA3AF] truncate max-w-[200px]">{e.routeFile}</span>
                  </li>
                ))}
              </ul>
            </StudioCard>
          )}

          {/* Direct dependents */}
          {result.directDependents.length > 0 && (
            <StudioCard className="overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E4E7EC] bg-[#F8F9FB]">
                <p className="text-[12px] font-medium text-[#374151]">
                  Direct Dependents ({result.directDependents.length})
                </p>
              </div>
              <ul>
                {result.directDependents.slice(0, 100).map((d) => (
                  <li key={d.fileId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E4E7EC]/60 last:border-0 text-[12px]">
                    <span className="text-[10px] font-medium text-[#9CA3AF] uppercase w-20 shrink-0">{d.layer}</span>
                    <span className="font-mono text-[#374151]">{d.path}</span>
                  </li>
                ))}
              </ul>
            </StudioCard>
          )}
        </div>
      )}
    </PageShell>
  );
}

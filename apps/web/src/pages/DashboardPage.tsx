import { Link } from 'react-router-dom';
import {
  FileCode, Layers, Workflow, Flame, Trash2, AlertTriangle,
  CircleDashed, Activity, Plus,
} from 'lucide-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useRepository, useRepositories, useDeleteRepository } from '@/hooks/useRepository';
import { PageShell, NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';
import { formatBytes, formatRelativeTime } from '@nodemap/shared';
import { cn } from '@/lib/utils';
import type { RepoAnalysis } from '@nodemap/types';

function StatCard({
  label, value, hint, accent, to,
}: {
  label: string; value: string | number; hint?: string;
  accent?: 'primary' | 'critical' | 'warn' | 'muted';
  to?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary',
    critical: 'text-risk-critical',
    warn: 'text-risk-medium',
    muted: 'text-foreground',
  };
  const body = (
    <div className="border border-border rounded-sm px-4 py-3 hover:border-primary/30 transition-colors bg-secondary/10">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={cn('text-2xl font-mono font-bold mt-0.5', colorMap[accent ?? 'muted'])}>{value}</p>
      {hint && <p className="text-[11px] font-mono text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function HealthRing({ score }: { score: number }) {
  const color = score >= 80 ? '#00ff87' : score >= 60 ? '#fbbf24' : score >= 40 ? '#fb923c' : '#ef4444';
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r="36" stroke="#222" strokeWidth="6" fill="none" />
        <circle
          cx="40" cy="40" r="36"
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-mono font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[9px] font-mono uppercase text-muted-foreground/60 tracking-widest">health</span>
      </div>
    </div>
  );
}

function MethodBar({ counts }: { counts: RepoAnalysis['endpointsByMethod'] }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground font-mono">No endpoints detected</p>;
  const colors: Record<string, string> = {
    GET: 'bg-blue-500/70', POST: 'bg-green-500/70', PUT: 'bg-yellow-500/70',
    PATCH: 'bg-orange-500/70', DELETE: 'bg-red-500/70', OPTIONS: 'bg-purple-500/70', HEAD: 'bg-gray-500/70',
  };
  return (
    <div className="space-y-2">
      {Object.entries(counts).map(([method, count]) => count > 0 && (
        <div key={method} className="flex items-center gap-2 text-xs font-mono">
          <span className="w-14 text-muted-foreground">{method}</span>
          <div className="flex-1 h-1.5 rounded-sm bg-secondary/40 overflow-hidden">
            <div className={cn('h-full', colors[method] ?? 'bg-primary/60')} style={{ width: `${(count / total) * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums text-foreground">{count}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardForRepo({ analysis }: { analysis: RepoAnalysis }) {
  const topRisk = analysis.riskScores.slice(0, 5);
  const topConn = analysis.topConnected.slice(0, 5);
  const cycleCount = analysis.dependencies.circular.length;
  const deadHigh = analysis.deadCodeCandidates.filter((c) => c.confidence === 'high').length;

  return (
    <div className="space-y-6">
      {/* Top row: identity + health */}
      <div className="flex flex-col md:flex-row items-stretch gap-4">
        <div className="flex-1 border border-border rounded-sm px-5 py-4 flex items-center gap-5">
          <HealthRing score={analysis.healthScore} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Repository</p>
            <h2 className="text-lg font-mono font-bold truncate">{analysis.repoName}</h2>
            <div className="flex items-center gap-3 mt-2 text-xs font-mono text-muted-foreground">
              {analysis.framework && <span className="px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary">{analysis.framework}</span>}
              {analysis.languages.slice(0, 3).map((l) => (
                <span key={l}>{l}</span>
              ))}
              <span>{formatBytes(analysis.totalSize)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Files" value={analysis.fileCount} hint={`${analysis.folderCount} folders`} />
        <StatCard label="Dependencies" value={analysis.dependencies.total} hint={`${analysis.dependencies.internal} internal · ${analysis.dependencies.external} external`} to="/dependency-graph" />
        <StatCard label="Endpoints" value={analysis.endpoints.length} hint="HTTP routes detected" to="/endpoint-map" />
        <StatCard label="High-risk files" value={analysis.highRiskCount} accent={analysis.highRiskCount > 0 ? 'critical' : 'muted'} to="/risk-map" />
        <StatCard label="Circular deps" value={cycleCount} accent={cycleCount > 0 ? 'critical' : 'muted'} />
        <StatCard label="Dead code candidates" value={analysis.deadCodeCandidates.length} hint={`${deadHigh} high confidence`} to="/dead-code" />
        <StatCard label="Medium risk" value={analysis.mediumRiskCount} accent={analysis.mediumRiskCount > 0 ? 'warn' : 'muted'} />
        <StatCard label="Languages" value={analysis.languages.length} hint={analysis.languages.slice(0, 2).join(', ') || '—'} />
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-border rounded-sm p-4 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-3.5 h-3.5 text-risk-critical" />
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground/80">Top risky files</h3>
          </div>
          {topRisk.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No risky files detected</p>
          ) : (
            <ul className="space-y-1.5">
              {topRisk.map((r) => (
                <li key={r.fileId} className="flex items-center justify-between text-xs font-mono gap-2">
                  <Link to="/risk-map" className="truncate hover:text-primary">{r.path.split('/').slice(-2).join('/')}</Link>
                  <span className={cn('shrink-0 tabular-nums px-1.5 py-0.5 rounded-sm', r.level === 'critical' ? 'bg-risk-critical/15 text-risk-critical' : r.level === 'high' ? 'bg-risk-high/15 text-risk-high' : 'bg-risk-medium/15 text-risk-medium')}>{r.score}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-border rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground/80">Most connected files</h3>
          </div>
          {topConn.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No dependency data</p>
          ) : (
            <ul className="space-y-1.5">
              {topConn.map((c) => (
                <li key={c.fileId} className="flex items-center justify-between text-xs font-mono gap-2">
                  <Link to="/dependency-graph" className="truncate hover:text-primary">{c.path.split('/').slice(-2).join('/')}</Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{c.connectionCount} ←</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-border rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Workflow className="w-3.5 h-3.5 text-primary" />
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground/80">Endpoints by method</h3>
          </div>
          <MethodBar counts={analysis.endpointsByMethod} />
        </div>
      </div>

      {/* Dependency health summary */}
      <div className="border border-border rounded-sm p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <CircleDashed className="w-3.5 h-3.5 text-primary" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground/80">Dependency health</h3>
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          {analysis.dependencies.internal} internal · {analysis.dependencies.external} external imports
        </p>
        {cycleCount > 0 ? (
          <p className="text-xs font-mono text-risk-critical">
            ⚠ {cycleCount} circular dependency group{cycleCount > 1 ? 's' : ''} — break these to make refactors safer.
          </p>
        ) : (
          <p className="text-xs font-mono text-primary">✓ No circular dependencies detected</p>
        )}
      </div>
    </div>
  );
}

function RepoList() {
  const { data, isLoading, error } = useRepositories();
  const { mutate: deleteRepo } = useDeleteRepository();
  const repos = data?.items ?? [];

  if (isLoading) return <PageLoading />;
  if (error) return <PageError error={error} />;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">All repositories</h2>
      <div className="border border-border rounded-sm overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest border-b border-border bg-secondary/20">
          <span className="flex-1">name</span>
          <span className="w-20 text-right">files</span>
          <span className="w-20 text-right">size</span>
          <span className="w-24 text-right">updated</span>
          <span className="w-20 text-right">status</span>
        </div>
        {repos.length === 0 && (
          <div className="py-10 flex flex-col items-center gap-3">
            <p className="text-xs font-mono text-muted-foreground">no repositories yet</p>
            <Link to="/upload" className="text-xs font-mono px-3 py-1.5 rounded-sm border border-primary/30 text-primary hover:bg-primary/8">
              <Plus className="w-3 h-3 inline mr-1" /> analyze a repository
            </Link>
          </div>
        )}
        {repos.map((r) => {
          const isReady = r.status === 'ready';
          return (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 text-xs font-mono">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isReady ? 'bg-primary' : r.status === 'processing' ? 'bg-yellow-400 animate-pulse' : r.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground')} />
              <span className="flex-1 truncate text-foreground">{r.name}</span>
              <span className="w-20 text-right text-muted-foreground tabular-nums">{r.fileCount.toLocaleString()}</span>
              <span className="w-20 text-right text-muted-foreground tabular-nums">{formatBytes(r.totalSize)}</span>
              <span className="w-24 text-right text-muted-foreground">{formatRelativeTime(r.updatedAt)}</span>
              <span className="w-20 text-right text-muted-foreground">{r.status}</span>
              <button onClick={() => deleteRepo(r.id)} className="p-1 text-muted-foreground/60 hover:text-destructive" title="delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { repoId } = useActiveRepo();
  const { data: repo } = useRepository(repoId ?? undefined);
  const { data: analysis, isLoading, error } = useAnalysis(repoId ?? undefined);

  return (
    <PageShell
      title="Dashboard"
      subtitle="High-level intelligence summary"
      actions={
        <Link to="/upload" className="text-xs font-mono px-3 py-1.5 rounded-sm border border-primary/30 text-primary hover:bg-primary/8 flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> new analysis
        </Link>
      }
    >
      {!repoId && (
        <div className="border border-border rounded-sm p-6">
          <NoRepoState
            title="No repository selected"
            subtitle="Analyze a repo to see its architecture intelligence here."
          />
        </div>
      )}

      {repoId && isLoading && <PageLoading label="Building analysis…" />}
      {repoId && error && <PageError error={error} />}
      {repoId && analysis && repo && <DashboardForRepo analysis={analysis} />}

      <div className="pt-2">
        <RepoList />
      </div>
    </PageShell>
  );
}

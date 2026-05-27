import { Link } from 'react-router-dom';
import {
  Activity, FileCode, Layers, Trash2, Plus,
  AlertTriangle, GitBranch,
} from 'lucide-react';
import {
  IconFlame, IconRoute, IconRefresh, IconExternalLink,
  IconChevronRight,
} from '@tabler/icons-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useRepository, useRepositories, useDeleteRepository } from '@/hooks/useRepository';
import { PageShell, NoRepoState, PageError, PageLoading, StudioCard } from '@/components/layout/PageShell';
import { formatBytes, formatRelativeTime } from '@nodemap/shared';
import { cn } from '@/lib/utils';
import type { RepoAnalysis } from '@nodemap/types';


function riskBadgeClass(level: string) {
  const m: Record<string, string> = {
    critical: 'badge-critical',
    high:     'badge-high',
    medium:   'badge-medium',
    low:      'badge-low',
  };
  return m[level] ?? 'badge-low';
}

// Health Ring
function HealthRing({ score }: { score: number }) {
  const strokeColor = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626';
  const circumference = 2 * Math.PI * 34;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-[80px] h-[80px] shrink-0">
      <svg viewBox="0 0 76 76" className="-rotate-90 w-full h-full">
        <circle cx="38" cy="38" r="34" stroke="#E4E7EC" strokeWidth="6" fill="none" />
        <circle
          cx="38" cy="38" r="34"
          stroke={strokeColor}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-semibold tabular-nums text-[#111827]" style={{ color: strokeColor }}>
          {score}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-[#9CA3AF] leading-none mt-0.5">health</span>
      </div>
    </div>
  );
}

// KPI Card
interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  color?: 'blue' | 'red' | 'amber' | 'neutral';
  to?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
}

function KpiCard({ label, value, hint, color = 'neutral', to, icon: Icon }: KpiCardProps) {
  const colorMap = {
    blue:    { icon: 'text-[#2563EB]', num: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]' },
    red:     { icon: 'text-[#DC2626]', num: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]' },
    amber:   { icon: 'text-[#D97706]', num: 'text-[#D97706]', bg: 'bg-[#FFFBEB]' },
    neutral: { icon: 'text-[#6B7280]', num: 'text-[#111827]', bg: 'bg-[#F3F4F6]' },
  }[color];

  const inner = (
    <div className="bg-white border border-[#E4E7EC] rounded-lg px-4 py-4 hover:border-[#BFDBFE] transition-colors group">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.06em]">{label}</p>
        <div className={`w-7 h-7 rounded-lg ${colorMap.bg} flex items-center justify-center`}>
          <Icon size={14} className={colorMap.icon} />
        </div>
      </div>
      <p className={`text-[22px] font-medium tabular-nums ${colorMap.num}`}>{value}</p>
      {hint && <p className="text-[11px] text-[#9CA3AF] mt-1">{hint}</p>}
    </div>
  );

  return to ? (
    <Link to={to} className="block">{inner}</Link>
  ) : inner;
}

// Risk Distribution
function RiskDistribution({ analysis }: { analysis: RepoAnalysis }) {
  const total = analysis.riskScores.length;
  const counts = {
    critical: analysis.riskScores.filter((r) => r.level === 'critical').length,
    high:     analysis.riskScores.filter((r) => r.level === 'high').length,
    medium:   analysis.riskScores.filter((r) => r.level === 'medium').length,
    low:      analysis.riskScores.filter((r) => r.level === 'low').length,
  };
  const bars = [
    { label: 'Critical', count: counts.critical, color: '#DC2626', fill: 'bg-[#DC2626]' },
    { label: 'High',     count: counts.high,     color: '#D97706', fill: 'bg-[#D97706]' },
    { label: 'Medium',   count: counts.medium,   color: '#2563EB', fill: 'bg-[#2563EB]' },
    { label: 'Low',      count: counts.low,       color: '#059669', fill: 'bg-[#059669]' },
  ];

  return (
    <div className="space-y-3 p-4">
      {bars.map(({ label, count, fill }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] text-[#374151]">{label}</span>
            <span className="text-[12px] font-medium text-[#111827] tabular-nums">{count}</span>
          </div>
          <div className="h-[5px] rounded-[3px] bg-[#F3F4F6] overflow-hidden">
            <div
              className={`h-full rounded-[3px] transition-all ${fill}`}
              style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Endpoint method bar
function MethodBar({ counts }: { counts: RepoAnalysis['endpointsByMethod'] }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return <p className="text-[12px] text-[#9CA3AF] px-4 py-3">No endpoints detected</p>;
  }
  const METHOD_FILL: Record<string, string> = {
    GET: 'bg-[#059669]', POST: 'bg-[#D97706]', PUT: 'bg-[#2563EB]',
    PATCH: 'bg-[#7C3AED]', DELETE: 'bg-[#DC2626]',
    OPTIONS: 'bg-[#7C3AED]', HEAD: 'bg-[#6B7280]',
  };
  return (
    <div className="px-4 py-3 space-y-2.5">
      {Object.entries(counts).filter(([, c]) => c > 0).map(([method, count]) => (
        <div key={method} className="flex items-center gap-2.5">
          <span className="w-14 text-[11px] font-mono text-[#6B7280]">{method}</span>
          <div className="flex-1 h-[5px] rounded-[3px] bg-[#F3F4F6] overflow-hidden">
            <div
              className={cn('h-full rounded-[3px]', METHOD_FILL[method] ?? 'bg-[#2563EB]')}
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
          <span className="w-7 text-right text-[11px] tabular-nums text-[#374151]">{count}</span>
        </div>
      ))}
    </div>
  );
}

// Main dashboard for a loaded repo
function DashboardForRepo({ analysis }: { analysis: RepoAnalysis }) {
  const topRisk = analysis.riskScores.slice(0, 6);
  const cycleCount = analysis.dependencies.circular.length;
  const deadHigh = analysis.deadCodeCandidates.filter((c) => c.confidence === 'high').length;

  return (
    <div className="space-y-5">
      {/* Repo identity header */}
      <StudioCard className="p-4 flex items-center gap-5">
        <HealthRing score={analysis.healthScore} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em]">
            Active Repository
          </p>
          <h2 className="text-[16px] font-semibold text-[#111827] mt-0.5 truncate">
            {analysis.repoName}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {analysis.framework && (
              <span className="px-2 py-0.5 text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] rounded-[4px]">
                {analysis.framework}
              </span>
            )}
            {analysis.languages.slice(0, 3).map((l) => (
              <span key={l} className="text-[12px] text-[#6B7280]">{l}</span>
            ))}
            <span className="text-[12px] text-[#9CA3AF]">{formatBytes(analysis.totalSize)}</span>
          </div>
        </div>
      </StudioCard>

      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Total Files"    value={analysis.fileCount}               hint={`${analysis.folderCount} folders`}                              color="blue"    icon={FileCode}      />
        <KpiCard label="High Risk Files" value={analysis.highRiskCount}           hint={`${analysis.riskScores.filter(r=>r.level==='critical').length} critical`}  color="red"     icon={IconFlame}     to="/risk-map" />
        <KpiCard label="Endpoints"       value={analysis.endpoints.length}        hint="HTTP routes detected"                                           color="neutral" icon={IconRoute}     to="/endpoint-map" />
        <KpiCard label="Dead Candidates" value={analysis.deadCodeCandidates.length} hint={`${deadHigh} high confidence`}                               color="amber"   icon={Trash2}        to="/dead-code" />
      </div>

      {/* Second row of cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Dependencies"   value={analysis.dependencies.total}      hint={`${analysis.dependencies.internal} internal`}                  color="neutral" icon={Layers}        to="/dependency-graph" />
        <KpiCard label="Circular Deps"  value={cycleCount}                        hint="dependency cycles"                                              color={cycleCount > 0 ? 'red' : 'neutral'} icon={Activity} />
        <KpiCard label="Medium Risk"    value={analysis.mediumRiskCount}          hint="files"                                                          color="neutral" icon={AlertTriangle} />
        <KpiCard label="Languages"      value={analysis.languages.length}         hint={analysis.languages.slice(0, 2).join(', ') || 'None detected'}  color="neutral" icon={FileCode}      />
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top risk files */}
        <StudioCard className="lg:col-span-1">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E7EC]">
            <p className="text-[13px] font-medium text-[#111827]">Top Risk Files</p>
            <Link to="/risk-map" className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-0.5">
              View all <IconChevronRight size={11} />
            </Link>
          </div>
          <div className="p-1">
            {topRisk.length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF] px-3 py-4">No risky files detected</p>
            ) : (
              <ul>
                {topRisk.map((r) => (
                  <li key={r.fileId} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#F8F9FB] rounded-md transition-colors">
                    <Link to="/risk-map" className="flex items-center gap-2 min-w-0 flex-1">
                      <FileCode className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                      <span className="text-[12px] font-mono text-[#374151] truncate">
                        {r.path.split('/').slice(-2).join('/')}
                      </span>
                    </Link>
                    <span className={riskBadgeClass(r.level)}>{r.level}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </StudioCard>

        {/* Risk distribution */}
        <StudioCard>
          <div className="px-4 py-3 border-b border-[#E4E7EC]">
            <p className="text-[13px] font-medium text-[#111827]">Risk Distribution</p>
          </div>
          <RiskDistribution analysis={analysis} />
        </StudioCard>

        {/* Endpoints by method */}
        <StudioCard>
          <div className="px-4 py-3 border-b border-[#E4E7EC]">
            <p className="text-[13px] font-medium text-[#111827]">HTTP Methods</p>
          </div>
          <MethodBar counts={analysis.endpointsByMethod} />
        </StudioCard>
      </div>

      {/* Dependency health banner */}
      {cycleCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
          <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
          <p className="text-[13px] text-[#991B1B]">
            <strong>{cycleCount}</strong> circular dependency group{cycleCount > 1 ? 's' : ''} detected.{' '}
            <Link to="/dependency-graph" className="underline">View in Dependency Graph</Link> to resolve them.
          </p>
        </div>
      )}
    </div>
  );
}

// Repo list
function RepoList() {
  const { data, isLoading, error } = useRepositories();
  const { mutate: deleteRepo } = useDeleteRepository();
  const repos = data?.items ?? [];

  if (isLoading) return <PageLoading />;
  if (error) return <PageError error={error} />;

  return (
    <StudioCard>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E7EC]">
        <p className="text-[13px] font-medium text-[#111827]">All Repositories</p>
        <Link
          to="/upload"
          className="flex items-center gap-1 text-[12px] text-[#2563EB] hover:underline"
        >
          <Plus className="w-3 h-3" /> New
        </Link>
      </div>

      {repos.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-[#2563EB]" />
          </div>
          <p className="text-[13px] text-[#6B7280]">No repositories yet</p>
          <Link
            to="/upload"
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Analyze your first repo
          </Link>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_80px_100px_80px_32px] px-4 py-2 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] border-b border-[#E4E7EC] bg-[#F8F9FB]">
            <span>Name</span>
            <span className="text-right">Files</span>
            <span className="text-right">Size</span>
            <span className="text-right">Updated</span>
            <span className="text-right">Status</span>
            <span />
          </div>
          <ul>
            {repos.map((r) => {
              const isReady = r.status === 'ready';
              const statusColor =
                isReady          ? 'bg-[#059669]'
                : r.status === 'processing' ? 'bg-[#D97706] animate-pulse'
                : r.status === 'error'      ? 'bg-[#DC2626]'
                :                              'bg-[#9CA3AF]';
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_80px_80px_100px_80px_32px] px-4 py-3 text-[12px] border-b border-[#E4E7EC] last:border-0 hover:bg-[#F8F9FB] transition-colors items-center"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
                    <span className="truncate font-medium text-[#111827]">{r.name}</span>
                  </div>
                  <span className="text-right tabular-nums text-[#6B7280]">{r.fileCount.toLocaleString()}</span>
                  <span className="text-right tabular-nums text-[#6B7280]">{formatBytes(r.totalSize)}</span>
                  <span className="text-right text-[#9CA3AF]">{formatRelativeTime(r.updatedAt)}</span>
                  <span className="text-right text-[#9CA3AF]">{r.status}</span>
                  <button
                    onClick={() => deleteRepo(r.id)}
                    className="flex items-center justify-center w-7 h-7 rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                    title="Delete repository"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </StudioCard>
  );
}

// Page
export function DashboardPage() {
  const { repoId } = useActiveRepo();
  const { data: repo } = useRepository(repoId ?? undefined);
  const { data: analysis, isLoading, error } = useAnalysis(repoId ?? undefined);

  return (
    <PageShell>
      {!repoId && (
        <NoRepoState />
      )}

      {repoId && isLoading && <PageLoading label="Building analysis…" />}
      {repoId && error && <PageError error={error} />}
      {repoId && analysis && repo && <DashboardForRepo analysis={analysis} />}

      <RepoList />
    </PageShell>
  );
}

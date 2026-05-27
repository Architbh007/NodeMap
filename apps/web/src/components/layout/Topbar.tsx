import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronDown, Check, GitBranch, Plus } from 'lucide-react';
import { useRepositories } from '@/hooks/useRepository';
import { useActiveRepo } from '@/store/activeRepoStore';
import { cn } from '@/lib/utils';

/** Map routes → readable breadcrumb labels */
const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':        'Dashboard',
  '/repo-graph':       'Repo Graph',
  '/dependency-graph': 'Dependency Graph',
  '/endpoint-map':     'Endpoint Map',
  '/risk-map':         'Risk Map',
  '/pr-impact':        'PR Impact',
  '/dead-code':        'Dead Code',
  '/tunner':           'Tunner AI',
  '/reports':          'Reports',
  '/settings':         'Settings',
  '/upload':           'New Analysis',
};

interface TopbarProps {
  /** Extra action buttons rendered on the right */
  actions?: React.ReactNode;
}

export function Topbar({ actions }: TopbarProps) {
  const { pathname } = useLocation();
  const { data } = useRepositories();
  const repos = (data?.items ?? []).filter((r) => r.status === 'ready');
  const { repoId, setRepoId } = useActiveRepo();
  const active = repos.find((r) => r.id === repoId) ?? null;
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-select first ready repo
  useEffect(() => {
    if (!repoId && repos.length > 0) setRepoId(repos[0].id);
    if (repoId && !repos.find((r) => r.id === repoId) && repos.length > 0) {
      setRepoId(repos[0].id);
    }
  }, [repoId, repos, setRepoId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pageLabel = ROUTE_LABELS[pathname] ?? 'NodeMap';
  const repoName = active?.name ?? null;

  return (
    <header className="fixed top-0 left-[200px] right-0 h-[44px] bg-white border-b border-[#E4E7EC] z-30 flex items-center px-5 gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] min-w-0">
        {repoName ? (
          <>
            <span className="text-[#9CA3AF] truncate max-w-[140px]">{repoName}</span>
            <span className="text-[#D1D5DB]">/</span>
          </>
        ) : null}
        <span className="font-medium text-[#111827]">{pageLabel}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Repo selector */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={repos.length === 0}
          className={cn(
            'flex items-center gap-2 h-7 px-2.5 rounded-md text-[12px] border transition-colors',
            repos.length === 0
              ? 'border-[#E4E7EC] text-[#9CA3AF] cursor-not-allowed'
              : 'border-[#E4E7EC] text-[#374151] hover:border-[#BFDBFE] hover:bg-[#F8F9FB] cursor-pointer',
          )}
        >
          <GitBranch className="w-3 h-3 text-[#2563EB] shrink-0" />
          <span className="max-w-[180px] truncate">
            {active ? active.name : repos.length === 0 ? 'No repos — upload one' : 'Select repository'}
          </span>
          <ChevronDown className="w-3 h-3 text-[#9CA3AF] ml-0.5 shrink-0" />
        </button>

        {open && repos.length > 0 && (
          <div className="absolute top-full right-0 mt-1.5 w-64 bg-white border border-[#E4E7EC] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-[#E4E7EC]">
              <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em]">
                Repositories
              </p>
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {repos.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => { setRepoId(r.id); setOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors',
                      r.id === repoId
                        ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                        : 'text-[#374151] hover:bg-[#F8F9FB]',
                    )}
                  >
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-[11px] text-[#9CA3AF] tabular-nums shrink-0">
                      {r.fileCount.toLocaleString()} files
                    </span>
                    {r.id === repoId && <Check className="w-3 h-3 text-[#2563EB] shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#E4E7EC] px-2 py-2">
              <Link
                to="/upload"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] text-[#2563EB] font-medium hover:bg-[#EFF6FF] rounded-md transition-colors"
              >
                <Plus className="w-3 h-3" />
                Analyze new repo
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Extra actions from pages */}
      {actions}
    </header>
  );
}

/** Action button for topbar — exported for pages to use */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TopbarAction({
  onClick,
  icon: Icon,
  label,
  variant = 'secondary',
  disabled,
}: {
  onClick?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white border-transparent'
          : 'bg-white hover:bg-[#F8F9FB] text-[#374151] border-[#E4E7EC]',
      )}
    >
      <Icon size={13} className="shrink-0" />
      {label}
    </button>
  );
}

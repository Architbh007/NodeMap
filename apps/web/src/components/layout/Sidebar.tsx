import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderTree, Network, Workflow,
  Flame, GitPullRequest, Trash2, Sparkles, FileText, Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveRepo } from '@/store/activeRepoStore';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  needsRepo: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',        label: 'Dashboard',        Icon: LayoutDashboard, needsRepo: false },
  { to: '/repo-graph',       label: 'Repo Graph',       Icon: FolderTree,      needsRepo: true  },
  { to: '/dependency-graph', label: 'Dependency Graph', Icon: Network,         needsRepo: true  },
  { to: '/endpoint-map',     label: 'Endpoint Map',     Icon: Workflow,        needsRepo: true  },
  { to: '/risk-map',         label: 'Risk Map',         Icon: Flame,           needsRepo: true  },
  { to: '/pr-impact',        label: 'PR Impact',        Icon: GitPullRequest,  needsRepo: true  },
  { to: '/dead-code',        label: 'Dead Code',        Icon: Trash2,          needsRepo: true  },
  { to: '/tunner',           label: 'Tunner',           Icon: Sparkles,        needsRepo: true  },
  { to: '/reports',          label: 'Reports',          Icon: FileText,        needsRepo: true  },
  { to: '/settings',         label: 'Settings',         Icon: SettingsIcon,    needsRepo: false },
];

function NetworkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="3.5" r="2" fill="currentColor" />
      <circle cx="3" cy="14" r="1.5" fill="currentColor" opacity="0.7" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" opacity="0.7" />
      <line x1="9" y1="5.5" x2="3.8" y2="12.6" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <line x1="9" y1="5.5" x2="14.2" y2="12.6" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <line x1="4.5" y1="14" x2="13.5" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const { repoId } = useActiveRepo();

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-56 border-r border-border bg-background/95 backdrop-blur-sm flex flex-col z-40">
      <Link
        to="/dashboard"
        className="h-12 flex items-center gap-2 px-4 border-b border-border text-primary hover:opacity-80 transition-opacity shrink-0"
      >
        <NetworkIcon />
        <span className="font-mono font-semibold text-sm text-foreground tracking-tight">
          node<span className="text-primary">map</span>
          <span className="animate-cursor-blink text-primary select-none">_</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, Icon, needsRepo }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          const disabled = needsRepo && !repoId;
          const className = cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-xs font-mono transition-colors',
            active
              ? 'text-primary bg-primary/8'
              : disabled
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
          );
          if (disabled) {
            return (
              <div key={to} className={className} title="Select a repository first">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </div>
            );
          }
          return (
            <Link key={to} to={to} className={className}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
              {active && <span className="ml-auto text-primary/60">›</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-2 shrink-0">
        <Link
          to="/upload"
          className="block text-center text-[11px] font-mono py-1.5 rounded-sm border border-primary/25 text-primary hover:bg-primary/8 hover:border-primary/50 transition-colors"
        >
          + new analysis
        </Link>
      </div>
    </aside>
  );
}

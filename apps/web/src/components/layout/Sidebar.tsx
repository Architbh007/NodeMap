import { Link, useLocation } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconHierarchy2,
  IconTopologyStar,
  IconRoute,
  IconFlame,
  IconGitPullRequest,
  IconCodeOff,
  IconSparkles,
  IconFileExport,
  IconSettings,
  IconPlus,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useActiveRepo } from '@/store/activeRepoStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIconComponent = React.ComponentType<any>;

interface NavItem {
  to: string;
  label: string;
  icon: AnyIconComponent;
  needsRepo: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard',        label: 'Dashboard',        icon: IconLayoutDashboard, needsRepo: false },
      { to: '/repo-graph',       label: 'Repo Graph',       icon: IconHierarchy2,      needsRepo: true  },
      { to: '/dependency-graph', label: 'Dependency Graph', icon: IconTopologyStar,    needsRepo: true  },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { to: '/endpoint-map', label: 'Endpoint Map', icon: IconRoute,           needsRepo: true },
      { to: '/risk-map',     label: 'Risk Map',     icon: IconFlame,           needsRepo: true },
      { to: '/pr-impact',    label: 'PR Impact',    icon: IconGitPullRequest,  needsRepo: true },
      { to: '/dead-code',    label: 'Dead Code',    icon: IconCodeOff,         needsRepo: true },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/tunner',   label: 'Tunner AI', icon: IconSparkles,    needsRepo: true  },
      { to: '/reports',  label: 'Reports',   icon: IconFileExport,  needsRepo: true  },
      { to: '/settings', label: 'Settings',  icon: IconSettings,    needsRepo: false },
    ],
  },
];

/** NodeMap logo mark – a small square with "N" */
function LogoIcon() {
  return (
    <div className="w-6 h-6 rounded-[5px] bg-[#2563EB] flex items-center justify-center shrink-0">
      <span className="text-white font-bold text-[11px] leading-none select-none">N</span>
    </div>
  );
}


export function Sidebar() {
  const { pathname } = useLocation();
  const { repoId } = useActiveRepo();

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 w-[200px] bg-white border-r border-[#E4E7EC] flex flex-col z-40"
      aria-label="Main navigation"
    >
      {/* Logo bar */}
      <Link
        to="/dashboard"
        className="h-[44px] flex items-center gap-2.5 px-4 border-b border-[#E4E7EC] shrink-0 hover:bg-[#F8F9FB] transition-colors"
      >
        <LogoIcon />
        <span className="font-semibold text-[14px] text-[#111827] tracking-tight">
          NodeMap
        </span>
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {/* Group label */}
            <p className="px-2 mb-1 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em]">
              {group.label}
            </p>

            {/* Nav items */}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, needsRepo }) => {
                const isActive = pathname === to || pathname.startsWith(`${to}/`);
                const isDisabled = needsRepo && !repoId;

                if (isDisabled) {
                  return (
                    <li key={to}>
                      <div
                        title="Select a repository first"
                        className="flex items-center gap-2.5 h-8 px-2.5 text-[13px] text-[#9CA3AF] rounded-lg cursor-not-allowed select-none"
                      >
                        <Icon size={15} className="shrink-0" />
                        <span>{label}</span>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={cn(
                        'flex items-center gap-2.5 h-8 px-2.5 text-[13px] rounded-lg transition-all',
                        isActive
                          ? 'bg-[#EFF6FF] text-[#1D4ED8] font-medium border-l-2 border-[#2563EB] pl-[9px] rounded-l-none'
                          : 'text-[#6B7280] hover:bg-[#F8F9FB] hover:text-[#111827]',
                      )}
                    >
                      <Icon
                        size={15}
                        className={cn('shrink-0', isActive ? 'text-[#2563EB]' : '')}
                      />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* New analysis CTA */}
      <div className="px-2.5 pb-2 pt-1 border-t border-[#E4E7EC]">
        <Link
          to="/upload"
          className="flex items-center justify-center gap-1.5 h-8 w-full rounded-lg text-[13px] font-medium text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition-colors"
        >
          <IconPlus size={14} />
          New Analysis
        </Link>
      </div>

      {/* Footer */}
      <div className="px-3.5 py-3 border-t border-[#E4E7EC] shrink-0">
        <p className="text-[10px] text-[#C4C9D4]">NodeMap · open source</p>
      </div>
    </aside>
  );
}

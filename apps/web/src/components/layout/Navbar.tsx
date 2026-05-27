import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/dashboard', label: 'repos' },
  { to: '/upload', label: 'analyze' },
];

function NetworkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="3.5" r="2" fill="currentColor" />
      <circle cx="3" cy="14" r="1.5" fill="currentColor" opacity="0.7" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" opacity="0.7" />
      <line x1="9" y1="5.5" x2="3.8" y2="12.6" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <line x1="9" y1="5.5" x2="14.2" y2="12.6" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <line x1="4.5" y1="14" x2="13.5" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function Navbar() {
  const { pathname } = useLocation();

  return (
    <header className="h-12 border-b border-border bg-background/95 backdrop-blur-sm fixed top-0 left-0 right-0 z-50 flex items-center px-6 gap-6">
      {/* Brand */}
      <Link
        to="/"
        className="flex items-center gap-2 shrink-0 text-primary hover:opacity-80 transition-opacity"
      >
        <NetworkIcon />
        <span className="font-semibold text-sm text-foreground tracking-tight">
          Node<span className="text-primary">Map</span>
        </span>
      </Link>

      <div className="w-px h-4 bg-border shrink-0" />

      {/* Nav */}
      <nav className="flex items-center gap-5">
        {NAV_LINKS.map(({ to, label }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative text-sm font-mono transition-colors pb-[2px]',
                active
                  ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[1px] after:bg-primary/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && <span className="opacity-60 mr-0.5">›</span>}
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <Link to="/upload">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 font-mono text-xs border-primary/25 text-primary hover:bg-primary/8 hover:text-primary hover:border-primary/50"
        >
          <Plus className="w-3 h-3" />
          new analysis
        </Button>
      </Link>
    </header>
  );
}

import { Link } from 'react-router-dom';
import { GitBranch, AlertCircle, Loader2 } from 'lucide-react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Full-bleed: don't constrain children to max width. */
  fullBleed?: boolean;
}

export function PageShell({ title, subtitle, actions, children, fullBleed = false }: PageShellProps) {
  return (
    <div className={fullBleed ? '' : 'max-w-7xl mx-auto px-6 py-6 space-y-5'}>
      {!fullBleed && (
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function NoRepoState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
      <GitBranch className="w-8 h-8 text-muted-foreground/40" />
      <h2 className="font-mono text-sm text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground font-mono max-w-md">{subtitle}</p>}
      <Link to="/upload" className="mt-2 text-sm px-4 py-2 rounded-md border border-primary/30 text-primary hover:bg-primary/8 transition-colors">
        + analyze a repository
      </Link>
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  return (
    <div className="flex items-center gap-3 px-4 py-6 border border-destructive/30 rounded-sm bg-destructive/5">
      <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
      <div className="space-y-0.5">
        <p className="text-sm font-mono text-destructive">Something went wrong</p>
        <p className="text-xs text-muted-foreground font-mono">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    </div>
  );
}

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono py-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

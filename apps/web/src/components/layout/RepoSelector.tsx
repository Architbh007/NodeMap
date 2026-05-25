import { useEffect, useRef, useState } from 'react';
import { ChevronDown, GitBranch, Check } from 'lucide-react';
import { useRepositories } from '@/hooks/useRepository';
import { useActiveRepo } from '@/store/activeRepoStore';
import { cn } from '@/lib/utils';

/**
 * Top bar showing the active repository.
 * Persisted in localStorage so the sidebar pages share one repo context.
 */
export function RepoSelector() {
  const { data } = useRepositories();
  const repos = (data?.items ?? []).filter((r) => r.status === 'ready');
  const { repoId, setRepoId } = useActiveRepo();
  const active = repos.find((r) => r.id === repoId) ?? null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Auto-select first ready repo if nothing chosen yet
  useEffect(() => {
    if (!repoId && repos.length > 0) setRepoId(repos[0].id);
    if (repoId && !repos.find((r) => r.id === repoId) && repos.length > 0) {
      setRepoId(repos[0].id);
    }
  }, [repoId, repos, setRepoId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="h-12 border-b border-border bg-background/95 backdrop-blur-sm fixed top-0 left-56 right-0 z-30 flex items-center px-4 gap-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">repository</span>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={repos.length === 0}
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-xs font-mono border',
            repos.length === 0
              ? 'border-border/40 text-muted-foreground/40 cursor-not-allowed'
              : 'border-border hover:border-primary/40 text-foreground hover:bg-secondary/40 transition-colors',
          )}
        >
          <GitBranch className="w-3 h-3 text-primary" />
          {active ? (
            <span className="max-w-[280px] truncate">{active.name}</span>
          ) : repos.length === 0 ? (
            <span className="text-muted-foreground">no repos — upload one</span>
          ) : (
            <span>Select repository</span>
          )}
          <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
        </button>

        {open && repos.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto bg-background border border-border rounded-sm shadow-lg z-50">
            {repos.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRepoId(r.id); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-left',
                  r.id === repoId
                    ? 'bg-primary/8 text-primary'
                    : 'text-foreground hover:bg-secondary/50',
                )}
              >
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{r.fileCount} files</span>
                {r.id === repoId && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />
    </header>
  );
}

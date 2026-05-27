import { useMemo, useState } from 'react';
import { Trash2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { PageShell, NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   'border-risk-high/30 text-risk-high bg-risk-high/10',
  medium: 'border-risk-medium/30 text-risk-medium bg-risk-medium/10',
  low:    'border-muted-foreground/30 text-muted-foreground bg-secondary/40',
};

export function DeadCodePage() {
  const { repoId } = useActiveRepo();
  const { data: analysis, isLoading, error } = useAnalysis(repoId ?? undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const candidates = useMemo(() => {
    if (!analysis) return [];
    if (filter === 'all') return analysis.deadCodeCandidates;
    return analysis.deadCodeCandidates.filter((c) => c.confidence === filter);
  }, [analysis, filter]);

  if (!repoId) return <PageShell title="Dead Code Candidates"><NoRepoState title="No repository selected" /></PageShell>;
  if (isLoading) return <PageLoading label="Looking for unreferenced files…" />;
  if (error) return <PageShell title="Dead Code Candidates"><PageError error={error} /></PageShell>;
  if (!analysis) return null;

  const counts = {
    high: analysis.deadCodeCandidates.filter((c) => c.confidence === 'high').length,
    medium: analysis.deadCodeCandidates.filter((c) => c.confidence === 'medium').length,
    low: analysis.deadCodeCandidates.filter((c) => c.confidence === 'low').length,
  };

  return (
    <PageShell title="Dead Code Candidates" subtitle="Files that look unused. Verify before deleting.">
      <div className="border border-border rounded-sm p-3 bg-secondary/10 flex items-start gap-2 text-xs font-mono">
        <AlertTriangle className="w-4 h-4 text-risk-medium shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          These are <span className="text-foreground">candidates</span>, not confirmed dead code. Files used by
          test runners, dynamic imports, or external tooling may show up here. Always verify before deleting.
        </p>
      </div>

      <div className="flex gap-2">
        {(['all', 'high', 'medium', 'low'] as const).map((f) => {
          const total = f === 'all' ? analysis.deadCodeCandidates.length : counts[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'text-xs font-mono px-3 py-1.5 rounded-sm border',
                active ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {f} ({total})
            </button>
          );
        })}
      </div>

      {candidates.length === 0 ? (
        <div className="border border-border rounded-sm py-12 text-center space-y-2">
          <Trash2 className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-mono text-foreground">No dead code candidates found</p>
          <p className="text-xs font-mono text-muted-foreground">All source files appear to be reachable.</p>
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-hidden">
          {candidates.map((c) => {
            const open = openId === c.fileId;
            return (
              <div key={c.fileId} className="border-b border-border last:border-0">
                <button
                  onClick={() => setOpenId(open ? null : c.fileId)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-mono text-left hover:bg-secondary/30"
                >
                  {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span className={cn('px-1.5 py-0.5 rounded-sm border text-[10px] uppercase', CONFIDENCE_COLOR[c.confidence])}>
                    {c.confidence}
                  </span>
                  <span className="flex-1 truncate text-foreground">{c.path}</span>
                </button>
                {open && (
                  <div className="px-9 pb-3 space-y-2 text-xs font-mono">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">Why it may be unused</p>
                      <ul className="space-y-0.5">
                        {c.reasons.map((r, i) => (
                          <li key={i} className="text-foreground/80">· {r}</li>
                        ))}
                      </ul>
                    </div>
                    {c.falsePositiveReasons.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">Why it may be a false positive</p>
                        <ul className="space-y-0.5">
                          {c.falsePositiveReasons.map((r, i) => (
                            <li key={i} className="text-muted-foreground">· {r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

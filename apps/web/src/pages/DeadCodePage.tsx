import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { IconCodeOff } from '@tabler/icons-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { PageShell, NoRepoState, PageError, PageLoading, StudioCard } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';

const CONFIDENCE_META: Record<string, { badge: string; label: string }> = {
  high:   { badge: 'badge-high',   label: 'High confidence' },
  medium: { badge: 'badge-medium', label: 'Medium confidence' },
  low:    { badge: 'badge-low',    label: 'Low confidence' },
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

  if (!repoId) return <PageShell title="Dead Code"><NoRepoState /></PageShell>;
  if (isLoading) return <PageLoading label="Looking for unreferenced files…" />;
  if (error) return <PageShell title="Dead Code"><PageError error={error} /></PageShell>;
  if (!analysis) return null;

  const counts = {
    high:   analysis.deadCodeCandidates.filter((c) => c.confidence === 'high').length,
    medium: analysis.deadCodeCandidates.filter((c) => c.confidence === 'medium').length,
    low:    analysis.deadCodeCandidates.filter((c) => c.confidence === 'low').length,
  };
  const total = analysis.deadCodeCandidates.length;

  return (
    <PageShell title="Dead Code" subtitle="Files that look unused. Verify before deleting.">
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
        <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#92400E] leading-relaxed">
          These are <strong>candidates</strong>, not confirmed dead code. Files used by test runners,
          dynamic imports, or external tooling may appear here. Always verify before deleting.
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'high', 'medium', 'low'] as const).map((f) => {
          const count = f === 'all' ? total : counts[f];
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium border transition-colors',
                isActive
                  ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]'
                  : 'bg-white border-[#E4E7EC] text-[#6B7280] hover:text-[#111827]',
              )}
            >
              <span className="capitalize">{f}</span>
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                isActive ? 'bg-[#BFDBFE] text-[#1D4ED8]' : 'bg-[#F3F4F6] text-[#6B7280]',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {candidates.length === 0 ? (
        <StudioCard className="py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] flex items-center justify-center">
            <IconCodeOff size={20} className="text-[#059669]" />
          </div>
          <p className="text-[14px] font-medium text-[#111827]">No dead code candidates found</p>
          <p className="text-[12px] text-[#9CA3AF]">All source files appear to be reachable.</p>
        </StudioCard>
      ) : (
        <StudioCard className="overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[24px_1fr_120px] px-4 py-2.5 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] border-b border-[#E4E7EC] bg-[#F8F9FB]">
            <span />
            <span>File path</span>
            <span className="text-right">Confidence</span>
          </div>
          <div className="divide-y divide-[#E4E7EC]/60">
            {candidates.map((c) => {
              const isOpen = openId === c.fileId;
              const meta = CONFIDENCE_META[c.confidence] ?? CONFIDENCE_META.low;
              return (
                <div key={c.fileId}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : c.fileId)}
                    className="w-full grid grid-cols-[24px_1fr_120px] items-center px-4 py-3 hover:bg-[#F8F9FB] transition-colors text-left"
                  >
                    <span className="text-[#9CA3AF]">
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />
                      }
                    </span>
                    <span className="text-[12px] font-mono text-[#374151] truncate pr-4">{c.path}</span>
                    <span className={cn('justify-self-end', meta.badge)}>{c.confidence}</span>
                  </button>

                  {isOpen && (
                    <div className="px-10 pb-4 pt-1 space-y-3 bg-[#F8F9FB] border-t border-[#E4E7EC]">
                      <div>
                        <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                          Why it may be unused
                        </p>
                        <ul className="space-y-1">
                          {c.reasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-[#374151]">
                              <span className="shrink-0 w-1 h-1 rounded-full bg-[#9CA3AF] mt-[6px]" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {c.falsePositiveReasons.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-[0.06em] mb-1.5">
                            Why it may be a false positive
                          </p>
                          <ul className="space-y-1">
                            {c.falsePositiveReasons.map((r, i) => (
                              <li key={i} className="flex items-start gap-2 text-[12px] text-[#6B7280]">
                                <span className="shrink-0 w-1 h-1 rounded-full bg-[#D1D5DB] mt-[6px]" />
                                {r}
                              </li>
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
        </StudioCard>
      )}
    </PageShell>
  );
}

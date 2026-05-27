import { useState } from 'react';
import { FileDown, FileJson, FileText } from 'lucide-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { reportsApi } from '@/api/client';
import { PageShell, NoRepoState } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { ReportSection, ReportFormat } from '@nodemap/types';

const SECTIONS: { id: ReportSection; label: string; description: string }[] = [
  { id: 'overview', label: 'Overview', description: 'Repo metadata, file counts, health' },
  { id: 'architecture', label: 'Architecture', description: 'Layer breakdown, most-connected files' },
  { id: 'endpoints', label: 'Endpoints', description: 'All detected HTTP endpoints' },
  { id: 'dependencies', label: 'Dependencies', description: 'Internal & external dependency counts' },
  { id: 'risk', label: 'Risk', description: 'Risk-scored files with reasons' },
  { id: 'circular', label: 'Circular deps', description: 'Cycle groups and members' },
  { id: 'deadcode', label: 'Dead code', description: 'Unused-file candidates' },
  { id: 'recommendations', label: 'Recommendations', description: 'Suggested next steps' },
];

export function ReportsPage() {
  const { repoId } = useActiveRepo();
  const [picked, setPicked] = useState<Set<ReportSection>>(new Set(['overview', 'architecture', 'endpoints', 'risk', 'circular', 'deadcode', 'recommendations']));
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(s: ReportSection) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  async function download(format: ReportFormat) {
    if (!repoId) return;
    setBusy(format); setError(null);
    try {
      await reportsApi.download(repoId, format, [...picked]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!repoId) return <PageShell title="Reports"><NoRepoState title="No repository selected" /></PageShell>;

  return (
    <PageShell title="Reports" subtitle="Export architecture intelligence">
      <div className="border border-border rounded-sm p-4 space-y-3">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Sections to include</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SECTIONS.map((s) => {
            const on = picked.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={cn(
                  'border rounded-sm px-3 py-2 text-left transition-colors',
                  on ? 'border-primary/50 bg-primary/8' : 'border-border hover:border-foreground/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-foreground">{s.label}</span>
                  <span className={cn('w-3 h-3 rounded-sm border', on ? 'bg-primary border-primary' : 'border-muted-foreground/30')} />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{s.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy !== null || picked.size === 0}
          onClick={() => download('markdown')}
          className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <FileText className="w-3 h-3" />
          {busy === 'markdown' ? 'preparing…' : 'Download Markdown'}
        </button>
        <button
          disabled={busy !== null || picked.size === 0}
          onClick={() => download('json')}
          className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-sm border border-border text-foreground hover:bg-secondary/40 disabled:opacity-40"
        >
          <FileJson className="w-3 h-3" />
          {busy === 'json' ? 'preparing…' : 'Download JSON'}
        </button>
        <span className="text-[10px] font-mono text-muted-foreground self-center ml-auto flex items-center gap-1">
          <FileDown className="w-3 h-3" /> reports are generated locally. No data leaves the server.
        </span>
      </div>

      {error && (
        <p className="text-xs font-mono text-destructive">{error}</p>
      )}
    </PageShell>
  );
}

import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { IconFileExport, IconMarkdown, IconJson, IconCheck } from '@tabler/icons-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { reportsApi } from '@/api/client';
import { PageShell, NoRepoState, StudioCard } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { ReportSection, ReportFormat } from '@nodemap/types';

const SECTIONS: { id: ReportSection; label: string; description: string }[] = [
  { id: 'overview',         label: 'Overview',        description: 'Repo metadata, file counts, health score' },
  { id: 'architecture',     label: 'Architecture',    description: 'Layer breakdown, most-connected files' },
  { id: 'endpoints',        label: 'Endpoints',       description: 'All detected HTTP endpoints' },
  { id: 'dependencies',     label: 'Dependencies',    description: 'Internal & external dependency counts' },
  { id: 'risk',             label: 'Risk',            description: 'Risk-scored files with reasons' },
  { id: 'circular',         label: 'Circular Deps',   description: 'Cycle groups and members' },
  { id: 'deadcode',         label: 'Dead Code',       description: 'Unused-file candidates with confidence' },
  { id: 'recommendations',  label: 'Recommendations', description: 'Suggested next steps' },
];

export function ReportsPage() {
  const { repoId } = useActiveRepo();
  const [picked, setPicked] = useState<Set<ReportSection>>(
    new Set(['overview', 'architecture', 'endpoints', 'risk', 'circular', 'deadcode', 'recommendations']),
  );
  const [busy, setBusy]   = useState<ReportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(s: ReportSection) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function selectAll() {
    setPicked(new Set(SECTIONS.map((s) => s.id)));
  }

  function clearAll() {
    setPicked(new Set());
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
    <PageShell title="Reports" subtitle="Export architecture intelligence as Markdown or JSON">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* Section picker */}
        <StudioCard>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E7EC]">
            <p className="text-[13px] font-medium text-[#111827]">Sections to include</p>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-[11px] text-[#2563EB] hover:underline">All</button>
              <span className="text-[#D1D5DB]">·</span>
              <button onClick={clearAll}  className="text-[11px] text-[#6B7280] hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-4">
            {SECTIONS.map((s) => {
              const isOn = picked.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                    isOn
                      ? 'border-[#BFDBFE] bg-[#EFF6FF]'
                      : 'border-[#E4E7EC] bg-white hover:border-[#BFDBFE] hover:bg-[#F8F9FB]',
                  )}
                >
                  {/* Checkbox */}
                  <div className={cn(
                    'w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border transition-colors',
                    isOn ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[#D1D5DB] bg-white',
                  )}>
                    {isOn && <IconCheck size={10} className="text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-[13px] font-medium', isOn ? 'text-[#1D4ED8]' : 'text-[#111827]')}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">{s.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </StudioCard>

        {/* Export panel */}
        <div className="space-y-3">
          <StudioCard className="p-4 space-y-3">
            <p className="text-[13px] font-medium text-[#111827]">Export</p>
            <p className="text-[12px] text-[#6B7280]">
              {picked.size} of {SECTIONS.length} sections selected
            </p>

            {/* Markdown */}
            <button
              disabled={busy !== null || picked.size === 0}
              onClick={() => download('markdown')}
              className="w-full flex items-center gap-2.5 h-10 px-4 rounded-lg text-[13px] font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <IconMarkdown size={16} />
              {busy === 'markdown' ? 'Preparing…' : 'Download Markdown'}
            </button>

            {/* JSON */}
            <button
              disabled={busy !== null || picked.size === 0}
              onClick={() => download('json')}
              className="w-full flex items-center gap-2.5 h-10 px-4 rounded-lg text-[13px] font-medium text-[#374151] bg-white border border-[#E4E7EC] hover:bg-[#F8F9FB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <IconJson size={16} className="text-[#6B7280]" />
              {busy === 'json' ? 'Preparing…' : 'Download JSON'}
            </button>

            {error && (
              <p className="text-[11px] text-[#DC2626] mt-1">{error}</p>
            )}
          </StudioCard>

          {/* Privacy notice */}
          <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FB] border border-[#E4E7EC] rounded-lg">
            <FileDown className="w-4 h-4 text-[#9CA3AF] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              Reports are generated locally. No data leaves the server. Files are downloaded directly to your browser.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

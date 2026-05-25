import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, Search, Settings as SettingsIcon, AlertTriangle, FileCode } from 'lucide-react';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useAnalysis } from '@/hooks/useAnalysis';
import { aiApi } from '@/api/client';
import { PageShell, NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { AiNodeExplain, AiRepoBrief } from '@nodemap/types';
import { TUNNER } from '@/constants/tunner';

export function AIExplainerPage() {
  const { repoId } = useActiveRepo();
  const { data: analysis, isLoading, error } = useAnalysis(repoId ?? undefined);
  const { data: statusRes } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.status(),
    staleTime: 1000 * 30,
  });

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explain, setExplain] = useState<AiNodeExplain | null>(null);
  const [brief, setBrief] = useState<AiRepoBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [errStr, setErrStr] = useState<string | null>(null);

  const files = useMemo(() => {
    if (!analysis) return [];
    if (!query.trim()) return analysis.layers.slice(0, 50);
    const q = query.toLowerCase();
    return analysis.layers.filter((l) => l.path.toLowerCase().includes(q)).slice(0, 100);
  }, [analysis, query]);

  const aiOn = statusRes?.data?.configured === true;

  async function runExplain(fileId: string) {
    if (!repoId) return;
    setSelectedId(fileId); setBusy(true); setErrStr(null); setExplain(null);
    try {
      const res = await aiApi.explain(repoId, fileId);
      if (!res.data) throw new Error(res.error ?? 'Empty response');
      setExplain(res.data);
    } catch (e) {
      setErrStr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function runBrief() {
    if (!repoId) return;
    setBusy(true); setErrStr(null); setBrief(null);
    try {
      const res = await aiApi.briefRepo(repoId);
      if (!res.data) throw new Error(res.error ?? 'Empty response');
      setBrief(res.data);
    } catch (e) {
      setErrStr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (!repoId) return <PageShell title={TUNNER.name}><NoRepoState title="No repository selected" /></PageShell>;
  if (isLoading) return <PageLoading label="Loading analysis…" />;
  if (error) return <PageShell title={TUNNER.name}><PageError error={error} /></PageShell>;

  return (
    <PageShell title={TUNNER.name} subtitle={TUNNER.tagline}>
      {!aiOn && (
        <div className="border border-risk-medium/30 bg-risk-medium/5 rounded-sm p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-risk-medium shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs font-mono">
            <p className="text-foreground">{TUNNER.notConfigured}</p>
            <p className="text-muted-foreground">{TUNNER.configureHint}</p>
            <Link to="/settings" className="text-primary inline-flex items-center gap-1 mt-1 hover:underline">
              <SettingsIcon className="w-3 h-3" /> Open settings
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4">
        <div className="space-y-3">
          <button
            disabled={!aiOn || busy}
            onClick={runBrief}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-mono py-2 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3 h-3" />
            {TUNNER.briefAction}
          </button>

          <div className="border border-border rounded-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search files / folders"
                className="w-full bg-transparent border-b border-border pl-7 pr-2 py-2 text-xs font-mono focus:outline-none focus:border-primary/40"
              />
            </div>
            <div className="max-h-[calc(100vh-21rem)] overflow-y-auto">
              {files.map((f) => (
                <button
                  key={f.fileId}
                  onClick={() => runExplain(f.fileId)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-left border-b border-border/30 last:border-0',
                    selectedId === f.fileId ? 'bg-primary/8 text-primary' : 'text-foreground hover:bg-secondary/40',
                  )}
                >
                  <FileCode className="w-3 h-3 shrink-0 text-muted-foreground/60" />
                  <span className="truncate">{f.path}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase">{f.layer}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-border rounded-sm p-4 min-h-[300px]">
          {brief ? (
            <div className="space-y-4 font-mono text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Repo summary</p>
                <p className="text-foreground/90 whitespace-pre-wrap">{brief.summary}</p>
              </div>
              {brief.entryPoints.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Entry points</p>
                  <ul className="space-y-0.5">
                    {brief.entryPoints.map((p, i) => <li key={i}>· {p}</li>)}
                  </ul>
                </div>
              )}
              {brief.risks.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Risks</p>
                  <ul className="space-y-0.5 text-foreground/80">
                    {brief.risks.map((r, i) => <li key={i}>· {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : explain ? (
            <div className="space-y-4 font-mono text-xs">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Explanation for {explain.path}</p>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Summary</p>
                <p className="text-foreground/90">{explain.summary}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Role</p>
                <p className="text-foreground/90">{explain.role}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Impact</p>
                <p className="text-foreground/90">{explain.impact}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Safe to change</p>
                <p className="text-foreground/90">{explain.safeToChange}</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div className="space-y-1">
                <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-mono text-foreground">{busy ? TUNNER.thinking : TUNNER.chooseFile}</p>
                {errStr && <p className="text-[10px] font-mono text-destructive mt-2">{errStr}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Download, FileJson, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/store/graphStore';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { graphData } = useGraphStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function downloadBlob(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function exportJson() {
    if (!graphData) return;
    downloadBlob(
      JSON.stringify(graphData, null, 2),
      'nodemap-graph.json',
      'application/json',
    );
  }

  function exportCsv() {
    if (!graphData) return;
    const header = 'source,target,type,isCircular';
    const rows = graphData.edges
      .filter((e) => e.type !== 'contains')
      .map((e) => `"${e.source}","${e.target}","${e.type}","${e.data?.isCircular ?? false}"`)
      .join('\n');
    downloadBlob(`${header}\n${rows}`, 'nodemap-edges.csv', 'text/csv');
  }

  function exportNodesCsv() {
    if (!graphData) return;
    const header = 'id,path,type,language,riskLevel,importCount,importedByCount,isDeadCode';
    const rows = graphData.nodes
      .filter((n) => n.type === 'file')
      .map((n) => {
        const d = n.data;
        return [
          `"${n.id}"`,
          `"${d.path ?? ''}"`,
          `"${n.type}"`,
          `"${d.language ?? ''}"`,
          `"${d.riskLevel ?? 'low'}"`,
          d.metrics?.importCount ?? 0,
          d.metrics?.importedByCount ?? 0,
          d.isDeadCode ?? false,
        ].join(',');
      })
      .join('\n');
    downloadBlob(`${header}\n${rows}`, 'nodemap-nodes.csv', 'text/csv');
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Export graph"
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-all',
          open
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
        )}
      >
        <Download className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 glass border border-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[160px] animate-fade-in">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
            <span className="text-[10px] font-mono text-muted-foreground">Export as…</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
          {[
            { icon: <FileJson className="w-3.5 h-3.5" />, label: 'Full graph (JSON)', action: exportJson },
            { icon: <FileText className="w-3.5 h-3.5" />, label: 'Edges (CSV)',       action: exportCsv },
            { icon: <FileText className="w-3.5 h-3.5" />, label: 'Nodes (CSV)',       action: exportNodesCsv },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              disabled={!graphData}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-secondary/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-muted-foreground">{item.icon}</span>
              <span className="text-foreground font-mono">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

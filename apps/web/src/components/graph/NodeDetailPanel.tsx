import { useMemo, useState } from 'react';
import { X, FileCode, GitMerge, ArrowDownToLine, ArrowUpFromLine, Code2, AlertTriangle, Skull, Activity, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/store/graphStore';
import { AiExplainBlock } from './AiExplainBlock';
import type { RiskLevel } from '@nodemap/types';

const RISK_BADGE: Record<RiskLevel, 'success' | 'warning' | 'danger' | 'critical'> = {
  low: 'success', medium: 'warning', high: 'danger', critical: 'critical',
};

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left group"
      >
        {open
          ? <ChevronDown className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
        }
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
      </button>
      {open && children}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-mono font-medium', highlight ? 'text-primary' : 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

export function NodeDetailPanel() {
  const { selectedNode, selectNode, graphData, setHighlightedNodes, clearHighlight, expandNodeToVisible } = useGraphStore();
  const [impactExpanded, setImpactExpanded] = useState(false);

  // ── Phase 7: transitive impact (reverse BFS on importedBy) ───
  const impactIds = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const queue = [selectedNode.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const node = nodeMap.get(cur);
      for (const dep of (node?.data.importedBy ?? [])) {
        if (!visited.has(dep.fileId)) queue.push(dep.fileId);
      }
    }
    visited.delete(selectedNode.id);
    return [...visited];
  }, [selectedNode, graphData]);

  if (!selectedNode) return null;

  const d = selectedNode.data;
  const riskLevel = d.riskLevel ?? 'low';
  const risk = RISK_BADGE[riskLevel];
  const imports = d.imports ?? [];
  const importedBy = d.importedBy ?? [];
  const functions = d.functions ?? [];
  const classes = d.classes ?? [];
  const circulars = d.circularDependencies ?? [];

  const impactNodes = impactIds
    .map((id) => graphData?.nodes.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <aside className="absolute right-0 top-0 bottom-0 w-72 glass border-l border-border flex flex-col z-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-node-file/15 text-node-file flex items-center justify-center shrink-0 mt-0.5">
            <FileCode className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">
              {d.path?.split('/').pop() ?? selectedNode.label}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">{d.path}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { selectNode(null); clearHighlight(); }}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            {d.language && <Badge variant="cyan">{d.language}</Badge>}
            <Badge variant={risk}>Risk: {riskLevel}</Badge>
            {d.isDeadCode && <Badge variant="secondary"><Skull className="w-2.5 h-2.5 mr-1" />Dead code</Badge>}
            {circulars.length > 0 && <Badge variant="critical"><AlertTriangle className="w-2.5 h-2.5 mr-1" />Circular</Badge>}
          </div>

          <Separator />

          {selectedNode.type === 'file' && (
            <>
              <AiExplainBlock key={selectedNode.id} node={selectedNode} />
              <Separator />
            </>
          )}

          {/* Metrics */}
          <Section title="Metrics">
            <div className="rounded-md border border-border divide-y divide-border">
              {d.metrics ? (
                <>
                  <Metric label="Imports"     value={d.metrics.importCount}    highlight={d.metrics.importCount > 10} />
                  <Metric label="Imported by" value={d.metrics.importedByCount} highlight={d.metrics.importedByCount > 10} />
                  <Metric label="Functions"   value={d.metrics.functionCount} />
                  <Metric label="Classes"     value={d.metrics.classCount} />
                  <Metric label="Lines"       value={d.metrics.lineCount} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground p-2">No metrics available</p>
              )}
            </div>
          </Section>

          {/* Impact Analysis — Phase 7 */}
          {impactIds.length > 0 && (
            <Section title={`Impact (${impactIds.length} affected)`} defaultOpen={false}>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Changing this file could break{' '}
                  <span className="text-foreground font-mono">{impactIds.length}</span>{' '}
                  file{impactIds.length !== 1 ? 's' : ''} transitively.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1 text-[11px] font-mono text-primary hover:text-primary/80 transition-colors"
                    onClick={() => setHighlightedNodes(impactIds)}
                  >
                    <Zap className="w-3 h-3" /> highlight affected
                  </button>
                  <span className="text-muted-foreground/30">·</span>
                  <button
                    className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                    onClick={clearHighlight}
                  >
                    clear
                  </button>
                </div>
                <div className="space-y-0.5">
                  {(impactExpanded ? impactNodes : impactNodes.slice(0, 5)).map((node) =>
                    node ? (
                      <button
                        key={node.id}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/50 transition-colors group text-left"
                        onClick={() => {
                          expandNodeToVisible(node.id);
                          selectNode(node.id);
                        }}
                      >
                        <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                        <span className="text-[11px] font-mono text-foreground/70 group-hover:text-foreground truncate">
                          {node.data.path?.split('/').pop()}
                        </span>
                      </button>
                    ) : null,
                  )}
                  {impactNodes.length > 5 && (
                    <button
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5"
                      onClick={() => setImpactExpanded((e) => !e)}
                    >
                      {impactExpanded ? '↑ show less' : `+${impactNodes.length - 5} more`}
                    </button>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Circular deps */}
          {circulars.length > 0 && (
            <Section title={`Circular (${circulars.length})`}>
              <div className="space-y-1">
                {circulars.map((dep) => (
                  <div key={dep} className="flex items-center gap-2 px-2 py-1.5 rounded bg-risk-critical/10 border border-risk-critical/20">
                    <GitMerge className="w-3 h-3 text-risk-critical shrink-0" />
                    <span className="text-[11px] font-mono text-risk-critical truncate">{dep}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Imports */}
          {imports.length > 0 && (
            <Section title={`Imports (${imports.length})`} defaultOpen={false}>
              <div className="space-y-1">
                {imports.slice(0, 8).map((imp) => (
                  <div key={imp.fileId} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/50 cursor-pointer group">
                    <ArrowDownToLine className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground truncate">{imp.path}</span>
                  </div>
                ))}
                {imports.length > 8 && (
                  <p className="text-[10px] text-muted-foreground px-2">+{imports.length - 8} more</p>
                )}
              </div>
            </Section>
          )}

          {/* Imported by */}
          {importedBy.length > 0 && (
            <Section title={`Imported by (${importedBy.length})`} defaultOpen={false}>
              <div className="space-y-1">
                {importedBy.slice(0, 8).map((dep) => (
                  <div key={dep.fileId} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/50 cursor-pointer group">
                    <ArrowUpFromLine className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground truncate">{dep.path}</span>
                  </div>
                ))}
                {importedBy.length > 8 && (
                  <p className="text-[10px] text-muted-foreground px-2">+{importedBy.length - 8} more</p>
                )}
              </div>
            </Section>
          )}

          {/* Functions */}
          {functions.length > 0 && (
            <Section title={`Functions (${functions.length})`} defaultOpen={false}>
              <div className="space-y-1">
                {functions.slice(0, 8).map((fn) => (
                  <div key={fn.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/30">
                    <Code2 className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[11px] font-mono text-foreground truncate">{fn.name}</span>
                    {fn.isAsync && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">async</Badge>}
                    {fn.isExported && <Badge variant="default" className="text-[9px] px-1 py-0 h-3.5">export</Badge>}
                  </div>
                ))}
                {functions.length > 8 && (
                  <p className="text-[10px] text-muted-foreground px-2">+{functions.length - 8} more</p>
                )}
              </div>
            </Section>
          )}

          {/* Classes */}
          {classes.length > 0 && (
            <Section title={`Classes (${classes.length})`} defaultOpen={false}>
              <div className="space-y-1">
                {classes.map((cls) => (
                  <div key={cls.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-node-service/10 border border-node-service/20">
                    <Activity className="w-3 h-3 text-node-service shrink-0" />
                    <span className="text-[11px] font-mono text-foreground truncate">{cls.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{cls.methods.length}m</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

import { useMemo } from 'react';
import { GitMerge, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGraphStore } from '@/store/graphStore';

export function CircularDepsPanel() {
  const { graphData, setHighlightedNodes, expandNodeToVisible, selectNode } = useGraphStore();

  const cycles = useMemo(() => {
    if (!graphData) return [];

    const circularEdges = graphData.edges.filter(
      (e) => e.type === 'circular' || e.data?.isCircular,
    );

    // Union-find grouping: merge node sets that share members
    const groups: Set<string>[] = [];
    for (const edge of circularEdges) {
      const touching: number[] = [];
      groups.forEach((g, i) => {
        if (g.has(edge.source) || g.has(edge.target)) touching.push(i);
      });

      if (touching.length === 0) {
        groups.push(new Set([edge.source, edge.target]));
      } else {
        const base = groups[touching[0]];
        base.add(edge.source);
        base.add(edge.target);
        // merge remaining touching groups into base
        for (let i = touching.length - 1; i >= 1; i--) {
          for (const id of groups[touching[i]]) base.add(id);
          groups.splice(touching[i], 1);
        }
      }
    }

    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    return groups.map((group) => {
      const ids = [...group];
      return {
        ids,
        files: ids.map((id) => ({
          id,
          name: nodeMap.get(id)?.data.path?.split('/').pop() ?? id,
          path: nodeMap.get(id)?.data.path ?? id,
        })),
      };
    });
  }, [graphData]);

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center p-6">
        <GitMerge className="w-6 h-6 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">No circular dependencies detected</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground pb-1">
          {cycles.length} cycle{cycles.length !== 1 ? 's' : ''} detected
        </p>

        {cycles.map((cycle, i) => (
          <div
            key={i}
            className="rounded border border-risk-critical/20 bg-risk-critical/5 overflow-hidden"
          >
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-risk-critical/15 bg-risk-critical/8">
              <span className="text-[10px] font-mono text-risk-critical">
                cycle #{i + 1} · {cycle.files.length} files
              </span>
              <button
                className="text-[9px] font-mono text-risk-critical/70 hover:text-risk-critical transition-colors"
                onClick={() => setHighlightedNodes(cycle.ids)}
              >
                highlight
              </button>
            </div>
            <div className="p-1.5 space-y-0.5">
              {cycle.files.map((file) => (
                <button
                  key={file.id}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left hover:bg-risk-critical/10 transition-colors group"
                  onClick={() => {
                    expandNodeToVisible(file.id);
                    selectNode(file.id);
                    setHighlightedNodes(cycle.ids);
                  }}
                >
                  <ChevronRight className="w-2.5 h-2.5 text-risk-critical/50 group-hover:text-risk-critical shrink-0" />
                  <span className="text-[10px] font-mono text-foreground/80 truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

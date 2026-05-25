import { useMemo } from 'react';
import { Skull } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGraphStore } from '@/store/graphStore';

export function DeadCodePanel() {
  const { graphData, setHighlightedNodes, expandNodeToVisible, selectNode } = useGraphStore();

  const deadNodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes.filter(
      (n) => n.type === 'file' &&
        (n.data.isDeadCode || (n.data.metrics?.importedByCount ?? 1) === 0),
    );
  }, [graphData]);

  if (deadNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center p-6">
        <Skull className="w-6 h-6 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">No dead code found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between pb-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">
            {deadNodes.length} unreferenced file{deadNodes.length !== 1 ? 's' : ''}
          </span>
          <button
            className="text-[9px] font-mono text-primary/70 hover:text-primary transition-colors"
            onClick={() => setHighlightedNodes(deadNodes.map((n) => n.id))}
          >
            highlight all
          </button>
        </div>

        {deadNodes.map((node) => (
          <button
            key={node.id}
            className="w-full flex items-center gap-2 px-2 py-2 rounded text-left hover:bg-secondary/50 transition-colors group"
            onClick={() => {
              expandNodeToVisible(node.id);
              selectNode(node.id);
              setHighlightedNodes([node.id]);
            }}
          >
            <Skull className="w-3 h-3 text-muted-foreground/50 group-hover:text-foreground shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-mono text-foreground truncate">
                {node.data.path?.split('/').pop()}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/50 truncate">
                {node.data.path}
              </span>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

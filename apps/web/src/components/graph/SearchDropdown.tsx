import { FileCode, ChevronRight } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import type { GraphNode } from '@nodemap/types';

interface Props {
  graphNodes: GraphNode[];
}

export function SearchDropdown({ graphNodes }: Props) {
  const { searchQuery, selectNode, expandNodeToVisible, setSearchQuery, setHighlightedNodes } = useGraphStore();

  const q = searchQuery.trim().toLowerCase();
  if (!q) return null;

  const matches = graphNodes
    .filter((n) => n.type !== 'folder' && n.type !== 'group' && (
      (n.data.path ?? '').toLowerCase().includes(q) ||
      (n.data.functions ?? []).some((f) => f.name.toLowerCase().includes(q)) ||
      (n.data.classes ?? []).some((c) => c.name.toLowerCase().includes(q))
    ))
    .slice(0, 8);

  if (matches.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 glass border border-border rounded-lg shadow-xl z-50 overflow-hidden">
        <div className="px-3 py-2.5 text-[11px] font-mono text-muted-foreground">
          no results for <span className="text-foreground">"{q}"</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-1 glass border border-border rounded-lg shadow-xl z-50 overflow-hidden">
      {matches.map((node) => (
        <button
          key={node.id}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary/60 transition-colors border-b border-border/40 last:border-0"
          onClick={() => {
            expandNodeToVisible(node.id);
            selectNode(node.id);
            setHighlightedNodes([node.id]);
            setSearchQuery('');
          }}
        >
          <FileCode className="w-3.5 h-3.5 text-node-file shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-mono text-foreground truncate">
              {node.data.path?.split('/').pop()}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/50 truncate">
              {node.data.path}
            </span>
          </div>
          <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0 ml-auto" />
        </button>
      ))}
      <div className="px-3 py-1.5 bg-secondary/20">
        <p className="text-[9px] font-mono text-muted-foreground">
          {matches.length} result{matches.length !== 1 ? 's' : ''} · click to jump · Esc to clear
        </p>
      </div>
    </div>
  );
}

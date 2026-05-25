import { useEffect, useRef } from 'react';
import { Copy, ExternalLink, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/store/graphStore';
import type { GraphNode } from '@nodemap/types';

interface Props {
  node: GraphNode;
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ node, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { setHighlightedNodes, selectNode, graphData, repoSourceUrl } = useGraphStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Transitive impact computation
  const impactIds = (() => {
    if (!graphData) return [];
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const queue = [node.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const n = nodeMap.get(cur);
      for (const dep of (n?.data.importedBy ?? [])) {
        if (!visited.has(dep.fileId)) queue.push(dep.fileId);
      }
    }
    visited.delete(node.id);
    return [...visited];
  })();

  // Build GitHub URL from source URL
  const githubUrl = (() => {
    if (!repoSourceUrl || !node.data.path) return null;
    try {
      const u = new URL(repoSourceUrl);
      // Works for github.com, gitlab.com, bitbucket.org
      return `${u.origin}${u.pathname.replace(/\.git$/, '')}/blob/HEAD/${node.data.path}`;
    } catch { return null; }
  })();

  const items = [
    {
      icon: <Copy className="w-3.5 h-3.5" />,
      label: 'Copy path',
      action: () => { navigator.clipboard.writeText(node.data.path ?? node.id).catch(() => {}); onClose(); },
    },
    githubUrl && {
      icon: <ExternalLink className="w-3.5 h-3.5 text-primary" />,
      label: 'Open in browser',
      action: () => { window.open(githubUrl, '_blank', 'noopener'); onClose(); },
    },
    impactIds.length > 0 && {
      icon: <Zap className="w-3.5 h-3.5 text-primary" />,
      label: `Show impact (${impactIds.length})`,
      action: () => { setHighlightedNodes(impactIds); selectNode(node.id); onClose(); },
    },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; action: () => void }>;

  // Position to stay inside viewport
  const MENU_W = 200;
  const MENU_H = items.length * 36 + 56;
  const left = Math.min(x, window.innerWidth  - MENU_W - 8);
  const top  = Math.min(y, window.innerHeight - MENU_H - 8);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9999, minWidth: MENU_W }}
      className="glass border border-border rounded-lg shadow-2xl py-1 animate-fade-in"
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border mb-0.5">
        <p className="text-[10px] font-mono text-muted-foreground truncate flex-1">
          {node.data.path?.split('/').pop() ?? node.id}
        </p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-2">
          <X className="w-3 h-3" />
        </button>
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.action}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left',
            'hover:bg-secondary/60 text-foreground',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

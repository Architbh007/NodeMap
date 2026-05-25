import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Folder, FolderOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/store/graphStore';
import type { NodeData } from '@nodemap/types';

export const FolderNode = memo(({ id, data, selected }: NodeProps) => {
  const d          = data as NodeData;
  const { expandedNodes } = useGraphStore();
  const isExpanded = expandedNodes.has(id);
  const childCount = d.childCount ?? 0;
  const name       = String(d.path ?? 'folder').split('/').filter(Boolean).pop() ?? 'folder';

  return (
    <>
      <Handle type="target" position={Position.Top}
        className="!bg-node-folder !border-node-folder/40 !w-2 !h-2 !-top-1" />

      <div
        className={cn(
          'group relative flex items-stretch rounded-lg border transition-all duration-200 cursor-pointer overflow-hidden w-[220px]',
          'bg-card border-border',
          'hover:border-node-folder/60 hover:shadow-lg hover:shadow-node-folder/10',
          selected    && 'border-node-folder/80 shadow-lg shadow-node-folder/20 ring-1 ring-node-folder/20',
          isExpanded  && 'border-node-folder/35 bg-node-folder/[0.04]',
        )}
      >
        {/* Left accent bar */}
        <div className={cn(
          'w-[3px] shrink-0 rounded-l-lg transition-opacity duration-200',
          'bg-node-folder',
          isExpanded ? 'opacity-80' : 'opacity-40',
        )} />

        <div className="flex items-center gap-2.5 px-3 py-3 flex-1 min-w-0">
          {/* Folder icon */}
          <div className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md shrink-0 transition-colors duration-200',
            isExpanded ? 'bg-node-folder/20 text-node-folder' : 'bg-node-folder/10 text-node-folder/70',
          )}>
            {isExpanded
              ? <FolderOpen className="w-3.5 h-3.5" />
              : <Folder     className="w-3.5 h-3.5" />
            }
          </div>

          {/* Name + count */}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[13px] font-semibold text-foreground truncate leading-none tracking-tight">
              {name}/
            </span>
            {childCount > 0 && (
              <span className="text-[10px] text-muted-foreground/60 leading-none mt-0.5 font-mono">
                {childCount} {childCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>

          {/* Chevron */}
          {childCount > 0 && (
            <ChevronRight className={cn(
              'w-4 h-4 text-muted-foreground/50 transition-transform duration-250 shrink-0 group-hover:text-muted-foreground',
              isExpanded && 'rotate-90 text-node-folder/60',
            )} />
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom}
        className="!bg-node-folder !border-node-folder/40 !w-2 !h-2 !-bottom-1" />
    </>
  );
});

FolderNode.displayName = 'FolderNode';

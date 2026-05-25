import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeData } from '@nodemap/types';

export const ModuleNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-node-module !border-node-module/50 !w-2 !h-2" />
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed transition-all duration-200 cursor-pointer min-w-[140px]',
          'bg-card/50 border-node-module/30',
          'hover:border-node-module/60 hover:bg-node-module/5',
          selected && 'border-node-module bg-node-module/10',
        )}
      >
        <Package className="w-3.5 h-3.5 text-node-module shrink-0" />
        <span className="text-xs text-muted-foreground truncate">{String(nodeData.path ?? 'module')}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-node-module !border-node-module/50 !w-2 !h-2" />
    </>
  );
});

ModuleNode.displayName = 'ModuleNode';

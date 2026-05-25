import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Layers, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeData } from '@nodemap/types';

export const ServiceNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeData;
  const routeCount = nodeData.routes?.length ?? 0;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-node-service !border-node-service/50 !w-2 !h-2" />
      <div
        className={cn(
          'group flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border transition-all duration-200 cursor-pointer min-w-[170px]',
          'bg-card border-border',
          'hover:border-node-service/50 hover:bg-node-service/5',
          selected && 'border-node-service bg-node-service/10 node-selected',
        )}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-node-service/15 text-node-service shrink-0">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-foreground truncate">{String(nodeData.path ?? 'service')}</span>
          {routeCount > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> {routeCount} routes
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-node-service !border-node-service/50 !w-2 !h-2" />
    </>
  );
});

ServiceNode.displayName = 'ServiceNode';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FolderOpen } from 'lucide-react';

interface FolderBgData {
  label: string;
  width: number;
  height: number;
}

export const FolderBgNode = memo(({ data }: NodeProps) => {
  const { label, width, height } = data as unknown as FolderBgData;

  return (
    <div
      style={{ width, height }}
      className="rounded-xl border border-node-folder/30 bg-node-folder/5 relative cursor-pointer"
    >
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5 select-none">
        <FolderOpen className="w-3 h-3 text-node-folder/50" />
        <span className="text-[11px] font-medium text-node-folder/50">{label}</span>
      </div>
    </div>
  );
});

FolderBgNode.displayName = 'FolderBgNode';

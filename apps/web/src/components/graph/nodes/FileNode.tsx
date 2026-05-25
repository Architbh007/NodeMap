import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileCode, FileJson, FileText, Settings, AlertTriangle, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeData, RiskLevel } from '@nodemap/types';

const RISK_ACCENT: Record<RiskLevel, string> = {
  low:      'bg-emerald-500',
  medium:   'bg-amber-500',
  high:     'bg-orange-500',
  critical: 'bg-red-500',
};

const RISK_GLOW: Record<RiskLevel, string> = {
  low:      '',
  medium:   '',
  high:     'shadow-orange-500/15',
  critical: 'shadow-red-500/20',
};

function fileGlowStyle(importedBy: number): React.CSSProperties | undefined {
  if (importedBy >= 10) return { boxShadow: '0 0 0 1.5px rgb(0 255 135 / 0.8), 0 0 18px rgb(0 255 135 / 0.35)' };
  if (importedBy >= 5)  return { boxShadow: '0 0 0 1px rgb(0 255 135 / 0.5), 0 0 10px rgb(0 255 135 / 0.2)' };
  if (importedBy >= 2)  return { boxShadow: '0 0 0 1px rgb(0 255 135 / 0.25)' };
  return undefined;
}

function FileIcon({ extension }: { extension?: string }) {
  if (!extension) return <FileText className="w-3.5 h-3.5" />;
  if (extension === '.json' || extension === '.yaml' || extension === '.yml') return <FileJson className="w-3.5 h-3.5" />;
  if (extension === '.config' || extension === '.env') return <Settings className="w-3.5 h-3.5" />;
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c'].includes(extension))
    return <FileCode className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

export const FileNode = memo(({ data, selected }: NodeProps) => {
  const d           = data as NodeData;
  const riskLevel   = d.riskLevel   ?? 'low';
  const isDeadCode  = d.isDeadCode  ?? false;
  const hasCircular = (d.circularDependencies?.length ?? 0) > 0;
  const importedBy  = d.metrics?.importedByCount ?? 0;
  const importCount = (d.imports    as string[] | undefined)?.length ?? 0;
  const funcCount   = (d.functions  as Array<unknown> | undefined)?.length ?? 0;
  const name        = d.path?.split('/').pop() ?? 'file';
  const ext         = name.includes('.') ? `.${name.split('.').pop()}` : undefined;

  return (
    <>
      <Handle type="target" position={Position.Top}
        className="!bg-node-file !border-node-file/40 !w-2 !h-2 !-top-1" />

      <div
        style={fileGlowStyle(importedBy)}
        className={cn(
          'group relative flex items-stretch rounded-lg border transition-all duration-200 cursor-pointer overflow-hidden',
          'bg-card border-border w-[220px]',
          'hover:border-node-file/50 hover:shadow-lg hover:shadow-node-file/10',
          selected && 'border-node-file/80 shadow-lg shadow-node-file/20 ring-1 ring-node-file/20',
          (riskLevel === 'high' || riskLevel === 'critical') && !selected && RISK_GLOW[riskLevel] && 'shadow-md',
          isDeadCode && 'opacity-35',
        )}
      >
        {/* Left risk accent bar */}
        <div className={cn('w-[3px] shrink-0 rounded-l-lg', RISK_ACCENT[riskLevel], 'opacity-75')} />

        <div className="flex flex-col flex-1 px-3 py-2.5 gap-1 min-w-0">
          {/* Row 1: icon + name + warnings */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-node-file/70 shrink-0">
              <FileIcon extension={ext} />
            </span>
            <span className="text-[13px] font-semibold text-foreground truncate flex-1 leading-none tracking-tight">
              {name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {hasCircular && (
                <span title="Circular dependency"><AlertTriangle className="w-3 h-3 text-risk-critical" /></span>
              )}
              {isDeadCode && (
                <span title="Dead code"><Skull className="w-3 h-3 text-muted-foreground/60" /></span>
              )}
            </div>
          </div>

          {/* Row 2: language */}
          {d.language && (
            <span className="text-[10px] text-muted-foreground/70 leading-none font-mono">
              {d.language}
            </span>
          )}

          {/* Row 3: metrics */}
          {(importCount > 0 || importedBy > 0 || funcCount > 0) && (
            <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground/60 mt-0.5">
              {importCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="text-indigo-400/60">→</span>{importCount}
                </span>
              )}
              {importedBy > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="text-primary/50">←</span>{importedBy}
                </span>
              )}
              {funcCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="text-purple-400/60 font-mono text-[9px]">ƒ</span>{funcCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom}
        className="!bg-node-file !border-node-file/40 !w-2 !h-2 !-bottom-1" />
    </>
  );
});

FileNode.displayName = 'FileNode';

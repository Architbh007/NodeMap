import { Folder, FileCode, Layers, Package, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/store/graphStore';

const LEGEND = [
  { icon: <Folder className="w-3 h-3" />,   color: 'text-node-folder',  bg: 'bg-node-folder/15',  label: 'Folder' },
  { icon: <FileCode className="w-3 h-3" />, color: 'text-node-file',    bg: 'bg-node-file/15',    label: 'File' },
  { icon: <Layers className="w-3 h-3" />,   color: 'text-node-service', bg: 'bg-node-service/15', label: 'Service' },
  { icon: <Globe className="w-3 h-3" />,    color: 'text-node-route',   bg: 'bg-node-route/15',   label: 'Route' },
  { icon: <Package className="w-3 h-3" />,  color: 'text-node-module',  bg: 'bg-node-module/15',  label: 'Module' },
];

const EDGE_LEGEND = [
  { stroke: 'rgba(99,102,241,0.5)',  label: 'Tree',      dashed: false },
  { stroke: '#6366f1',               label: 'Imports',   dashed: false },
  { stroke: '#10b981',               label: 'API flow',  dashed: false },
  { stroke: '#8b5cf6',               label: 'Services',  dashed: false },
  { stroke: '#ef4444',               label: 'Circular',  dashed: true },
];

const RISK_LABELS = [
  { color: 'bg-risk-low',      label: 'Low' },
  { color: 'bg-risk-medium',   label: 'Med' },
  { color: 'bg-risk-high',     label: 'High' },
  { color: 'bg-risk-critical', label: 'Crit' },
];

export function GraphLegend() {
  const { activePanel } = useGraphStore();

  return (
    <div
      className={cn(
        'absolute bottom-3 z-10 glass rounded-lg p-3 space-y-2.5 shadow-lg text-[11px] transition-all duration-200',
        activePanel ? 'left-[15.5rem]' : 'left-3',
      )}
    >
      <p className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">Nodes</p>
      <div className="space-y-1.5">
        {LEGEND.map(({ icon, color, bg, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn('w-5 h-5 rounded flex items-center justify-center', bg, color)}>
              {icon}
            </div>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-2.5">
        <p className="text-muted-foreground font-mono uppercase tracking-wider text-[10px] mb-1.5">Flow rows</p>
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed mb-2">
          Imports / API / All stack nodes by architecture (entry → pages → components → services).
        </p>
        <p className="text-muted-foreground font-mono uppercase tracking-wider text-[10px] mb-1.5">Lines</p>
        <div className="space-y-1.5">
          {EDGE_LEGEND.map(({ stroke, label, dashed }) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="20" height="8" className="shrink-0">
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  stroke={stroke}
                  strokeWidth="2"
                  strokeDasharray={dashed ? '4 2' : undefined}
                />
              </svg>
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-2.5">
        <p className="text-muted-foreground font-mono uppercase tracking-wider text-[10px] mb-1.5">Risk</p>
        <div className="flex items-center gap-2">
          {RISK_LABELS.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('w-2 h-2 rounded-full', color)} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

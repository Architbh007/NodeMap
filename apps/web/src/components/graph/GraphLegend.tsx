import { useState } from 'react';
import { Folder, FileCode, Layers, Package, Globe, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGraphStore } from '@/store/graphStore';
import { usesFlowLayout } from '@/lib/graphLayout';

const LEGEND = [
  { icon: <Folder className="w-2.5 h-2.5" />,   color: 'text-node-folder',  bg: 'bg-node-folder/15',  label: 'Folder' },
  { icon: <FileCode className="w-2.5 h-2.5" />, color: 'text-node-file',    bg: 'bg-node-file/15',    label: 'File' },
  { icon: <Layers className="w-2.5 h-2.5" />,   color: 'text-node-service', bg: 'bg-node-service/15', label: 'Service' },
  { icon: <Globe className="w-2.5 h-2.5" />,    color: 'text-node-route',   bg: 'bg-node-route/15',   label: 'Route' },
  { icon: <Package className="w-2.5 h-2.5" />,  color: 'text-node-module',  bg: 'bg-node-module/15',  label: 'Module' },
];

const EDGE_LEGEND = [
  { stroke: 'rgba(99,102,241,0.5)', label: 'Tree',     dashed: false },
  { stroke: '#6366f1',               label: 'Imports',  dashed: false },
  { stroke: '#10b981',               label: 'API flow', dashed: false },
  { stroke: '#8b5cf6',               label: 'Services', dashed: false },
  { stroke: '#ef4444',               label: 'Circular', dashed: true },
];

const RISK_LABELS = [
  { color: 'bg-risk-low',      label: 'Low' },
  { color: 'bg-risk-medium',   label: 'Med' },
  { color: 'bg-risk-high',     label: 'High' },
  { color: 'bg-risk-critical', label: 'Crit' },
];

export function GraphLegend() {
  const { activePanel, selectedNodeId, edgeView } = useGraphStore();
  const [expanded, setExpanded] = useState(false);
  const showFlowHint = usesFlowLayout(edgeView);

  return (
    <div
      className={cn(
        'absolute bottom-3 z-10 flex flex-col items-center pointer-events-none transition-all duration-200',
        activePanel && selectedNodeId && 'left-[15.5rem] right-[18.5rem]',
        activePanel && !selectedNodeId && 'left-[15.5rem] right-14',
        !activePanel && selectedNodeId && 'left-3 right-[18.5rem]',
        !activePanel && !selectedNodeId && 'left-14 right-14',
      )}
    >
      <div className="pointer-events-auto glass rounded-lg shadow-lg text-[10px] max-w-full">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 px-2.5 py-1.5 w-full text-left hover:bg-secondary/30 rounded-lg transition-colors"
          aria-expanded={expanded}
        >
          <span className="font-mono uppercase tracking-wider text-muted-foreground/70 text-[9px]">Legend</span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 flex-1 min-w-0">
            {EDGE_LEGEND.slice(0, 3).map(({ stroke, label, dashed }) => (
              <span key={label} className="inline-flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                <svg width="14" height="6" className="shrink-0" aria-hidden>
                  <line
                    x1="0"
                    y1="3"
                    x2="14"
                    y2="3"
                    stroke={stroke}
                    strokeWidth="2"
                    strokeDasharray={dashed ? '3 2' : undefined}
                  />
                </svg>
                {label}
              </span>
            ))}
            <span className="text-muted-foreground/40">·</span>
            {RISK_LABELS.map(({ color, label }) => (
              <span key={label} className="inline-flex items-center gap-0.5 text-muted-foreground whitespace-nowrap">
                <span className={cn('w-1.5 h-1.5 rounded-full', color)} />
                {label}
              </span>
            ))}
          </div>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border px-2.5 py-2 space-y-2">
            <div>
              <p className="text-muted-foreground font-mono uppercase tracking-wider text-[9px] mb-1">Nodes</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {LEGEND.map(({ icon, color, bg, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={cn('w-4 h-4 rounded flex items-center justify-center', bg, color)}>
                      {icon}
                    </div>
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-muted-foreground font-mono uppercase tracking-wider text-[9px] mb-1">Lines</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {EDGE_LEGEND.map(({ stroke, label, dashed }) => (
                  <div key={label} className="flex items-center gap-1">
                    <svg width="14" height="6" className="shrink-0" aria-hidden>
                      <line
                        x1="0"
                        y1="3"
                        x2="14"
                        y2="3"
                        stroke={stroke}
                        strokeWidth="2"
                        strokeDasharray={dashed ? '3 2' : undefined}
                      />
                    </svg>
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {showFlowHint && (
              <p className="text-[9px] font-mono text-muted-foreground/60 leading-snug">
                Flow rows: entry → pages → components → services (top to bottom).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { type RefObject, useCallback } from 'react';
import { useReactFlow, type Node, type ReactFlowInstance } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, Crosshair, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NODE_W, NODE_H } from './GraphCanvas';

interface GraphControlsProps {
  rfInstance: RefObject<ReactFlowInstance | null>;
  selectedNodeId: string | null;
  nodes: Node[];
}

interface ControlBtnProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ControlBtn({ icon: Icon, label, onClick, disabled }: ControlBtnProps) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-md border transition-all duration-150',
        'bg-card/95 border-border text-muted-foreground',
        'hover:border-primary/50 hover:text-primary hover:bg-primary/5',
        disabled && 'opacity-30 pointer-events-none',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

export function GraphControls({ rfInstance, selectedNodeId, nodes }: GraphControlsProps) {
  const { fitView, zoomIn, zoomOut, setCenter, getZoom, setViewport } = useReactFlow();

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.14, duration: 500, maxZoom: 1.2 });
  }, [fitView]);

  const handleZoomIn  = useCallback(() => zoomIn({ duration: 200 }),  [zoomIn]);
  const handleZoomOut = useCallback(() => zoomOut({ duration: 200 }), [zoomOut]);

  const handleCenterSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    setCenter(
      node.position.x + NODE_W / 2,
      node.position.y + NODE_H / 2,
      { zoom: getZoom(), duration: 420 },
    );
  }, [selectedNodeId, nodes, setCenter, getZoom]);

  const handleResetView = useCallback(() => {
    setViewport({ x: 80, y: 80, zoom: 0.85 }, { duration: 400 });
  }, [setViewport]);

  return (
    <div className="flex flex-col gap-1 p-1 mb-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-xl shadow-black/40">
      <ControlBtn icon={ZoomIn}    label="Zoom in"          onClick={handleZoomIn} />
      <ControlBtn icon={ZoomOut}   label="Zoom out"         onClick={handleZoomOut} />
      <div className="border-t border-border/60 my-0.5" />
      <ControlBtn icon={Maximize2} label="Fit to screen (F)" onClick={handleFitView} />
      <ControlBtn
        icon={Crosshair}
        label="Center selected node"
        onClick={handleCenterSelected}
        disabled={!selectedNodeId}
      />
      <div className="border-t border-border/60 my-0.5" />
      <ControlBtn icon={RotateCcw} label="Reset view"       onClick={handleResetView} />
    </div>
  );
}

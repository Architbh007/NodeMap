import { useMemo, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  Position,
  MarkerType,
  Handle,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { RepoAnalysis, ArchitectureLayer } from '@nodemap/types';

const LAYER_COLORS: Record<ArchitectureLayer, string> = {
  route:      '#60a5fa',
  controller: '#a78bfa',
  service:    '#34d399',
  repository: '#fbbf24',
  middleware: '#f472b6',
  util:       '#94a3b8',
  config:     '#6b7280',
  model:      '#fb923c',
  view:       '#22d3ee',
  test:       '#475569',
  entry:      '#00ff87',
  unknown:    '#525252',
};

const NODE_W = 200;
const NODE_GAP_X = 240;
const ROW_GAP_Y = 180;
const ROW_START_X = 40;
const ROW_START_Y = 40;

/** Display row: splits frontend pages vs components; backend uses architecture layer. */
function displayRow(path: string, layer: ArchitectureLayer): number {
  const p = path.replace(/\\/g, '/');
  if (/\/pages\//i.test(p)) return 2;
  if (/\/components\//i.test(p)) return 3;
  if (/\/context\//i.test(p)) return 4;

  const order: ArchitectureLayer[] = [
    'entry', 'middleware', 'route', 'controller', 'service', 'repository', 'model', 'util', 'view', 'config', 'test', 'unknown',
  ];
  const idx = order.indexOf(layer);
  return idx >= 0 ? idx : 10;
}

const ROW_LABELS: Record<number, string> = {
  0: 'Entry',
  1: 'Middleware',
  2: 'Pages / routes',
  3: 'Components / UI',
  4: 'Services / context',
  5: 'Repository',
  6: 'Model',
  7: 'Util / HTTP',
  8: 'View (other)',
  9: 'Config',
  10: 'Other',
};

function DepFileNode({ data, selected }: NodeProps) {
  const color = LAYER_COLORS[(data.layer as ArchitectureLayer) ?? 'unknown'] ?? '#525252';
  return (
    <div
      className="font-mono text-[11px] rounded px-2 py-2"
      style={{
        width: NODE_W,
        border: `1px solid ${selected ? '#00ff87' : color}`,
        background: selected ? `${color}22` : '#0a0a0a',
        color: '#e4e4e7',
        boxShadow: selected ? `0 0 0 2px #00ff87` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <div className="truncate font-semibold">{String(data.label ?? '')}</div>
      <div className="truncate text-[9px] text-muted-foreground mt-0.5">{String(data.path ?? '')}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { depFile: DepFileNode };

interface CanvasInnerProps {
  analysis: RepoAnalysis;
  deps: Array<{ source: string; target: string }>;
  selectedFileId?: string;
  onSelect?: (fileId: string) => void;
  layerFilter?: ArchitectureLayer | null;
}

function DependencyGraphCanvasInner({
  analysis,
  deps,
  selectedFileId,
  onSelect,
  layerFilter,
}: CanvasInnerProps) {
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const layerByFile = new Map(analysis.layers.map((l) => [l.fileId, l]));
    const incoming = new Map<string, number>();
    for (const d of deps) incoming.set(d.target, (incoming.get(d.target) ?? 0) + 1);

    const visibleSet = new Set<string>();
    for (const r of analysis.riskScores) {
      const info = layerByFile.get(r.fileId);
      if (layerFilter && info?.layer !== layerFilter) continue;
      visibleSet.add(r.fileId);
    }
    for (const l of analysis.layers) {
      if (layerFilter && l.layer !== layerFilter) continue;
      visibleSet.add(l.fileId);
    }

    const buckets = new Map<number, string[]>();
    for (const id of visibleSet) {
      const info = layerByFile.get(id);
      if (!info) continue;
      const row = displayRow(info.path, info.layer);
      if (!buckets.has(row)) buckets.set(row, []);
      buckets.get(row)!.push(id);
    }

    for (const arr of buckets.values()) {
      arr.sort((a, b) => {
        const pa = layerByFile.get(a)?.path ?? '';
        const pb = layerByFile.get(b)?.path ?? '';
        return pa.localeCompare(pb);
      });
    }

    const sortedRows = [...buckets.keys()].sort((a, b) => a - b);
    const rfNodes: RFNode[] = [];

    sortedRows.forEach((row, rowIdx) => {
      const ids = buckets.get(row)!;
      const rowWidth = ids.length * NODE_GAP_X;
      ids.forEach((id, i) => {
        const info = layerByFile.get(id)!;
        const risk = analysis.riskScores.find((r) => r.fileId === id);
        const path = info.path;
        const name = path.split('/').pop() ?? path;
        const layer = info.layer;
        const isSelected = selectedFileId === id;

        rfNodes.push({
          id,
          type: 'depFile',
          position: {
            x: ROW_START_X + i * NODE_GAP_X - rowWidth / 2 + NODE_GAP_X / 2,
            y: ROW_START_Y + rowIdx * ROW_GAP_Y,
          },
          data: { label: name, path, layer, inc: incoming.get(id) ?? 0, risk: risk?.level },
          selected: isSelected,
        });
      });
    });

    const rfEdges: RFEdge[] = deps
      .filter((d) => visibleSet.has(d.source) && visibleSet.has(d.target))
      .map((d, i) => ({
        id: `e_${i}_${d.source}_${d.target}`,
        source: d.source,
        target: d.target,
        type: 'smoothstep',
        style: { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: '#6366f1' },
      }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [analysis, deps, selectedFileId, layerFilter]);

  const onFit = useCallback(() => {
    if (nodes.length === 0) return;
    setTimeout(() => fitView({ padding: 0.15, duration: 300, maxZoom: 1 }), 50);
  }, [nodes.length, fitView]);

  useEffect(() => {
    onFit();
  }, [onFit, nodes.length, layerFilter]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, n) => onSelect?.(n.id)}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 120, y: 40, zoom: 0.55 }}
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
      >
        <Background gap={28} color="#1f1f1f" />
        <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.7)" />
        <Controls showInteractive={false} onFitView={onFit} />
        <Panel position="top-right" className="!m-3 glass border border-border rounded-sm px-3 py-2 text-[10px] font-mono text-muted-foreground">
          {nodes.length} files · {edges.length} dependencies
        </Panel>
        <Panel position="bottom-left" className="!m-3 glass border border-border rounded-sm px-3 py-2 text-[10px] font-mono max-w-lg">
          <p className="text-muted-foreground mb-2">Top → bottom: entry → pages → components → services → utils</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(LAYER_COLORS).map(([layer, color]) => (
              <div key={layer} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                <span className="capitalize">{layer}</span>
              </div>
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

interface Props {
  analysis: RepoAnalysis;
  deps: Array<{ source: string; target: string }>;
  selectedFileId?: string;
  onSelect?: (fileId: string) => void;
  layerFilter?: ArchitectureLayer | null;
}

export function DependencyGraphCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <DependencyGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

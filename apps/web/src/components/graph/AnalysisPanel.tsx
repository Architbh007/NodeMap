import { useMemo } from 'react';
import { GitMerge, Skull, BarChart2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGraphStore, type AnalysisPanel as PanelId } from '@/store/graphStore';
import { CircularDepsPanel } from './panels/CircularDepsPanel';
import { DeadCodePanel } from './panels/DeadCodePanel';
import { StatsPanel } from './panels/StatsPanel';
import { AiPanel } from './panels/AiPanel';

interface Tab {
  id: PanelId;
  label: string;
  icon: React.ReactNode;
  count?: number;
  countColor?: string;
}

export function AnalysisPanel() {
  const { activePanel, setActivePanel, graphData } = useGraphStore();

  const counts = useMemo(() => {
    if (!graphData) return { circular: 0, dead: 0 };
    return {
      circular: graphData.metadata.circularDependencyCount,
      dead: graphData.metadata.deadCodeCount,
    };
  }, [graphData]);

  if (!activePanel) return null;

  const TABS: Tab[] = [
    {
      id: 'circular',
      label: 'Cycles',
      icon: <GitMerge className="w-3 h-3" />,
      count: counts.circular,
      countColor: 'bg-risk-critical/20 text-risk-critical',
    },
    {
      id: 'deadcode',
      label: 'Dead',
      icon: <Skull className="w-3 h-3" />,
      count: counts.dead,
      countColor: 'bg-secondary text-muted-foreground',
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: <BarChart2 className="w-3 h-3" />,
    },
    {
      id: 'ai',
      label: 'Tunner',
      icon: <Sparkles className="w-3 h-3" />,
    },
  ];

  return (
    <aside className="absolute left-0 top-0 bottom-0 w-60 glass border-r border-border flex flex-col z-10 animate-fade-in">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-0.5 flex-1 min-w-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all whitespace-nowrap',
                activePanel === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={cn('rounded px-1 text-[9px] leading-tight', tab.countColor)}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => setActivePanel(null)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activePanel === 'circular' && <CircularDepsPanel />}
        {activePanel === 'deadcode' && <DeadCodePanel />}
        {activePanel === 'stats'    && <StatsPanel />}
        {activePanel === 'ai'       && <AiPanel />}
      </div>
    </aside>
  );
}

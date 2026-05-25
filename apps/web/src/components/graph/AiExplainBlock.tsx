import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { aiApi } from '@/api/client';
import type { GraphNode } from '@nodemap/types';
import { TUNNER } from '@/constants/tunner';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

export function AiExplainBlock({ node }: { node: GraphNode }) {
  const { id: repoId } = useParams<{ id: string }>();
  const [expanded, setExpanded] = useState(false);

  const { data: statusRes } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.status(),
    staleTime: 60_000,
  });

  const explainMutation = useMutation({
    mutationFn: (refresh: boolean) => aiApi.explain(repoId!, node.id, refresh),
  });

  const configured = statusRes?.data?.configured ?? false;
  const explain = explainMutation.data?.data;

  if (!configured) return null;

  return (
    <Section title={TUNNER.name}>
      {!expanded && !explain && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => {
            setExpanded(true);
            explainMutation.mutate(false);
          }}
          disabled={explainMutation.isPending}
        >
          {explainMutation.isPending
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Sparkles className="w-3 h-3 text-primary" />
          }
          {TUNNER.ask}
        </Button>
      )}

      {(expanded || explain) && (
        <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
          {explainMutation.isPending && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-[10px] font-mono text-muted-foreground">Analyzing…</span>
            </div>
          )}

          {explainMutation.isError && (
            <p className="text-[10px] text-destructive">
              {explainMutation.error instanceof Error ? explainMutation.error.message : 'Failed'}
            </p>
          )}

          {explain && (
            <div className="space-y-2">
              <p className="text-[11px] text-foreground/90 leading-relaxed">{explain.summary}</p>
              <div className="space-y-1 text-[10px]">
                <p><span className="text-muted-foreground">Role: </span>{explain.role}</p>
                <p><span className="text-muted-foreground">Impact: </span>{explain.impact}</p>
                <p>
                  <span className="text-muted-foreground">Safe to change: </span>
                  <span className={cn(
                    'font-mono capitalize',
                    explain.safeToChange.toLowerCase().includes('high') && 'text-risk-critical',
                    explain.safeToChange.toLowerCase().includes('low') && 'text-risk-low',
                  )}>
                    {explain.safeToChange}
                  </span>
                </p>
              </div>
            </div>
          )}

          {explain && (
            <button
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors"
              onClick={() => explainMutation.mutate(true)}
              disabled={explainMutation.isPending}
            >
              <RefreshCw className={cn('w-2.5 h-2.5', explainMutation.isPending && 'animate-spin')} />
              Regenerate
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

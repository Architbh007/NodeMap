import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, RefreshCw, Loader2, AlertCircle, BookOpen, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { aiApi } from '@/api/client';
import { useGraphStore } from '@/store/graphStore';
import { TUNNER } from '@/constants/tunner';

export function AiPanel() {
  const { id: repoId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { expandNodeToVisible, selectNode, graphData } = useGraphStore();

  const { data: statusRes } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.status(),
    staleTime: 60_000,
  });

  const { data: briefRes, isLoading, error } = useQuery({
    queryKey: ['ai-brief', repoId],
    queryFn: () => aiApi.briefRepo(repoId!),
    enabled: !!repoId && statusRes?.data?.configured === true,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => aiApi.briefRepo(repoId!, true),
    onSuccess: (res) => {
      if (res.data) queryClient.setQueryData(['ai-brief', repoId], res);
    },
  });

  const configured = statusRes?.data?.configured ?? false;
  const brief = briefRes?.data;

  function jumpToPath(filePath: string) {
    const node = graphData?.nodes.find((n) => n.data.path === filePath);
    if (!node) return;
    expandNodeToVisible(node.id);
    if (node.type === 'file') selectNode(node.id);
  }

  if (!configured) {
    return (
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-mono font-semibold">{TUNNER.name}</span>
          </div>
          <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Add <code className="text-primary/80">OPENAI_API_KEY</code> to{' '}
              <code className="text-foreground/70">apps/api/.env</code> and restart the API server.
            </p>
            <p className="text-[10px] text-muted-foreground/60 font-mono">
              Copy from apps/api/.env.example
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 p-6">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <p className="text-[11px] font-mono text-muted-foreground">Generating brief…</p>
      </div>
    );
  }

  if (error || briefRes?.success === false) {
    return (
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-mono">Generation failed</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {error instanceof Error ? error.message : briefRes?.error ?? 'Unknown error'}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', refreshMutation.isPending && 'animate-spin')} />
            Retry
          </Button>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Architecture Brief
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Regenerate brief"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={cn('w-3 h-3', refreshMutation.isPending && 'animate-spin')} />
          </Button>
        </div>

        {brief && (
          <>
            <div className="space-y-2">
              <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {brief.summary}
              </p>
              <p className="text-[9px] font-mono text-muted-foreground/50">
                {new Date(brief.generatedAt).toLocaleString()}
              </p>
            </div>

            {brief.entryPoints.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-primary/70" />
                  <h4 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Start here
                  </h4>
                </div>
                <div className="space-y-0.5">
                  {brief.entryPoints.map((p) => (
                    <button
                      key={p}
                      onClick={() => jumpToPath(p)}
                      className="w-full text-left px-2 py-1 rounded text-[10px] font-mono text-foreground/70 hover:text-primary hover:bg-secondary/50 truncate transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {brief.risks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-risk-critical/80" />
                  <h4 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Risks
                  </h4>
                </div>
                <ul className="space-y-1.5">
                  {brief.risks.map((risk, i) => (
                    <li
                      key={i}
                      className="text-[10px] text-muted-foreground leading-relaxed px-2 py-1.5 rounded bg-risk-critical/5 border border-risk-critical/10"
                    >
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

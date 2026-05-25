import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, AlertTriangle, Loader2, FileCode,
  Layers, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useRepository } from '@/hooks/useRepository';
import { graphApi } from '@/api/client';
import { useGraphStore } from '@/store/graphStore';
import { useActiveRepo } from '@/store/activeRepoStore';

export function GraphExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const { setGraphData, setRepoSourceUrl, reset } = useGraphStore();
  const { setRepoId } = useActiveRepo();
  useEffect(() => { if (id) setRepoId(id); }, [id, setRepoId]);

  const { data: repo, isLoading: repoLoading, error: repoError } = useRepository(id);

  const {
    data: graphResponse,
    isLoading: graphLoading,
    error: graphError,
    refetch,
  } = useQuery({
    queryKey: ['graph', id],
    queryFn: () => graphApi.get(id!),
    enabled: !!id && repo?.status === 'ready',
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = repoLoading || (repo?.status === 'ready' && graphLoading);

  useEffect(() => {
    if (graphResponse?.data) setGraphData(graphResponse.data);
  }, [graphResponse?.data, setGraphData]);

  useEffect(() => {
    if (repo?.sourceUrl) setRepoSourceUrl(repo.sourceUrl);
  }, [repo?.sourceUrl, setRepoSourceUrl]);

  // Reset store when leaving the page
  useEffect(() => () => { reset(); }, [reset]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading graph…</p>
        </div>
      </div>
    );
  }

  if (repoError || !repo) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-foreground font-medium">Repository not found</p>
          <p className="text-xs text-muted-foreground">It may have been deleted or the API is not running.</p>
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 mt-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (repo.status !== 'ready') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-sm text-foreground font-medium">Repository is being processed…</p>
          <p className="text-xs text-muted-foreground">Status: {repo.status}</p>
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 mt-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (graphError || !graphResponse?.data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-foreground font-medium">Failed to load graph</p>
          <p className="text-xs text-muted-foreground">
            {graphError instanceof Error ? graphError.message : 'Unknown error'}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const graphData = graphResponse.data;
  const meta = graphData.metadata;
  const fileCount = graphData.nodes.filter((n) => n.type === 'file').length || 1;
  const criticalHighCount = graphData.nodes.filter((n) => n.type === 'file' && (n.data.riskLevel === 'critical' || n.data.riskLevel === 'high')).length;
  const healthScore = Math.max(0, Math.round(
    100
    - Math.min(50, meta.circularDependencyCount * 5)
    - Math.round((meta.deadCodeCount / fileCount) * 30)
    - Math.round((criticalHighCount / fileCount) * 40),
  ));
  const healthColor = healthScore >= 80 ? 'text-risk-low' : healthScore >= 60 ? 'text-risk-medium' : healthScore >= 40 ? 'text-risk-high' : 'text-risk-critical';

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-primary font-mono text-xs opacity-60">›</span>
          <span className="text-sm font-mono font-medium text-foreground">{repo.name}</span>
          <Badge variant="success" className="text-[10px] font-mono rounded-sm px-1.5">ready</Badge>
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileCode className="w-3 h-3" />{meta.totalNodes} nodes
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="w-3 h-3" />{meta.totalEdges} edges
          </span>
          {meta.circularDependencyCount > 0 && (
            <span className="flex items-center gap-1.5 text-risk-critical">
              <AlertTriangle className="w-3 h-3" />{meta.circularDependencyCount} circular
            </span>
          )}
          {meta.frameworks.length > 0 && (
            <span className="text-muted-foreground/60">{meta.frameworks.join(', ')}</span>
          )}
          {meta.languages.slice(0, 3).map((lang) => (
            <span key={lang} className="text-muted-foreground/40">{lang}</span>
          ))}
        </div>

        <div className="flex-1" />

        <span className={`text-xs font-mono font-bold tabular-nums ${healthColor}`} title="Repo health score">
          {healthScore}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => refetch()}
          title="Refresh graph"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative overflow-hidden">
        <ErrorBoundary>
          <GraphCanvas
            graphNodes={graphData.nodes}
            graphEdges={graphData.edges}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

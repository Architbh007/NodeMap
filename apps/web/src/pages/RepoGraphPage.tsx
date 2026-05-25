import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveRepo } from '@/store/activeRepoStore';
import { useRepository } from '@/hooks/useRepository';
import { graphApi } from '@/api/client';
import { useGraphStore } from '@/store/graphStore';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NoRepoState, PageError, PageLoading } from '@/components/layout/PageShell';

/**
 * Repo Graph — folder/file structure view.
 * Re-uses the existing GraphCanvas. Pages live under /repo-graph (no :id segment).
 * Repo is taken from the active-repo store.
 */
export function RepoGraphPage() {
  const { repoId } = useActiveRepo();
  const { setGraphData, setRepoSourceUrl, reset } = useGraphStore();
  const { data: repo } = useRepository(repoId ?? undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ['graph', repoId],
    queryFn: () => graphApi.get(repoId!),
    enabled: !!repoId && repo?.status === 'ready',
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data?.data) setGraphData(data.data);
  }, [data?.data, setGraphData]);

  useEffect(() => {
    if (repo?.sourceUrl) setRepoSourceUrl(repo.sourceUrl);
  }, [repo?.sourceUrl, setRepoSourceUrl]);

  useEffect(() => () => { reset(); }, [reset]);

  if (!repoId) {
    return <div className="px-6 py-6"><NoRepoState title="No repository selected" subtitle="Pick a repository in the top bar to explore its structure." /></div>;
  }
  if (isLoading) return <PageLoading label="Loading graph…" />;
  if (error) return <div className="px-6 py-6"><PageError error={error} /></div>;
  if (!data?.data) return null;

  return (
    <div className="h-[calc(100vh-3rem)] relative overflow-hidden">
      <ErrorBoundary>
        <GraphCanvas graphNodes={data.data.nodes} graphEdges={data.data.edges} />
      </ErrorBoundary>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { graphApi } from '@/api/client';
import { useGraphStore } from '@/store/graphStore';
import { useEffect } from 'react';

export function useGraph(repoId: string | undefined) {
  const { setGraphData, setLoading, setError } = useGraphStore();

  const query = useQuery({
    queryKey: ['graph', repoId],
    queryFn: async () => {
      const res = await graphApi.get(repoId!);
      return res.data!;
    },
    enabled: !!repoId,
  });

  useEffect(() => {
    setLoading(query.isLoading);
    if (query.data) setGraphData(query.data);
    if (query.error) setError((query.error as Error).message);
  }, [query.data, query.error, query.isLoading, setGraphData, setLoading, setError]);

  return query;
}

import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/api/client';

export function useAnalysis(repoId: string | undefined) {
  return useQuery({
    queryKey: ['analysis', repoId],
    queryFn: async () => {
      const res = await analysisApi.get(repoId!);
      return res.data!;
    },
    enabled: !!repoId,
    staleTime: 1000 * 60 * 5,
  });
}

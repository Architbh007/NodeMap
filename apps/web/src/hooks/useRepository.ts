import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repoApi } from '@/api/client';
import type { CreateRepositoryInput } from '@nodemap/types';

export function useRepositories(page = 1) {
  return useQuery({
    queryKey: ['repositories', page],
    queryFn: async () => {
      const res = await repoApi.list(page);
      return res.data!;
    },
  });
}

export function useRepository(id: string | undefined) {
  return useQuery({
    queryKey: ['repository', id],
    queryFn: async () => {
      const res = await repoApi.get(id!);
      return res.data!;
    },
    enabled: !!id,
  });
}

export function useCreateRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRepositoryInput) => {
      const res = await repoApi.create(input);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repositories'] }),
  });
}

export function useDeleteRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repoApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repositories'] }),
  });
}

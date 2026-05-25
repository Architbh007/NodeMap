import { create } from 'zustand';
import type { Repository } from '@nodemap/types';

interface RepoState {
  repositories: Repository[];
  selectedRepo: Repository | null;
  isLoading: boolean;
  error: string | null;

  setRepositories: (repos: Repository[]) => void;
  addRepository: (repo: Repository) => void;
  removeRepository: (id: string) => void;
  updateRepository: (repo: Repository) => void;
  selectRepository: (repo: Repository | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRepoStore = create<RepoState>((set) => ({
  repositories: [],
  selectedRepo: null,
  isLoading: false,
  error: null,

  setRepositories: (repositories) => set({ repositories }),
  addRepository: (repo) => set((s) => ({ repositories: [repo, ...s.repositories] })),
  removeRepository: (id) => set((s) => ({ repositories: s.repositories.filter((r) => r.id !== id) })),
  updateRepository: (repo) =>
    set((s) => ({ repositories: s.repositories.map((r) => (r.id === repo.id ? repo : r)) })),
  selectRepository: (selectedRepo) => set({ selectedRepo }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

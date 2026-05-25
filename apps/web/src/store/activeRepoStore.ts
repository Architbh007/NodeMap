import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveRepoState {
  repoId: string | null;
  setRepoId: (id: string | null) => void;
}

export const useActiveRepo = create<ActiveRepoState>()(
  persist(
    (set) => ({
      repoId: null,
      setRepoId: (repoId) => set({ repoId }),
    }),
    { name: 'nodemap.activeRepo' },
  ),
);

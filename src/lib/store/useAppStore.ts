import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentFileEntry {
  name: string;
  size: number;
  toolId: string;
  toolName: string;
  timestamp: number;
}

interface AppState {
  theme: 'light' | 'dark';
  favorites: string[];
  recentFiles: RecentFileEntry[];
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  toggleFavorite: (toolId: string) => void;
  addRecentFile: (entry: Omit<RecentFileEntry, 'timestamp'>) => void;
  clearRecentFiles: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      favorites: ['merge-pdf', 'split-pdf', 'compress-pdf', 'edit-pdf', 'sign-pdf'],
      recentFiles: [],
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      toggleFavorite: (toolId) =>
        set((state) => ({
          favorites: state.favorites.includes(toolId)
            ? state.favorites.filter((id) => id !== toolId)
            : [...state.favorites, toolId],
        })),
      addRecentFile: (entry) =>
        set((state) => ({
          recentFiles: [
            { ...entry, timestamp: Date.now() },
            ...state.recentFiles.filter((f) => f.name !== entry.name),
          ].slice(0, 10),
        })),
      clearRecentFiles: () => set({ recentFiles: [] }),
    }),
    {
      name: 'pdfcraft-app-store',
    }
  )
);

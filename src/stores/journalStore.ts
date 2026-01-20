import { create } from 'zustand';
import type { Journal } from '@/types/journal';

interface JournalState {
  journals: Journal[];
  isLoading: boolean;
  error: string | null;
}

interface JournalActions {
  setJournals: (journals: Journal[]) => void;
  addJournal: (journal: Journal) => void;
  updateJournal: (id: string, journal: Partial<Journal>) => void;
  deleteJournal: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

type JournalStore = JournalState & JournalActions;

const initialState: JournalState = {
  journals: [],
  isLoading: false,
  error: null,
};

export const useJournalStore = create<JournalStore>((set) => ({
  ...initialState,

  setJournals: (journals) => set({ journals }),

  addJournal: (journal) =>
    set((state) => ({ journals: [...state.journals, journal] })),

  updateJournal: (id, updates) =>
    set((state) => ({
      journals: state.journals.map((journal) =>
        journal.id === id ? { ...journal, ...updates, updatedAt: new Date() } : journal
      ),
    })),

  deleteJournal: (id) =>
    set((state) => ({
      journals: state.journals.filter((journal) => journal.id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));


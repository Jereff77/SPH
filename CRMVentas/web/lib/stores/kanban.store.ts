import { create } from 'zustand'

interface KanbanFilters {
  uidRC: string
  tipoOperacion: string
}

interface KanbanStore {
  filters: KanbanFilters
  setFilter: (key: keyof KanbanFilters, value: string) => void
  clearFilters: () => void
}

const DEFAULT: KanbanFilters = { uidRC: '', tipoOperacion: '' }

export const useKanbanStore = create<KanbanStore>(set => ({
  filters: DEFAULT,
  setFilter: (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () => set({ filters: DEFAULT }),
}))

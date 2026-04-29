import { create } from 'zustand'

interface UiStore {
  mobileSidebarOpen: boolean
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void
}

export const useUiStore = create<UiStore>()(set => ({
  mobileSidebarOpen: false,
  toggleMobileSidebar: () => set(s => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
}))

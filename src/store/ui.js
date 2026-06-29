import { create } from 'zustand'

export const useUIStore = create((set) => ({
  sidebarOpen: false,
  aiOpen: false,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:  () => set({ sidebarOpen: false }),
  toggleAI:      () => set(s => ({ aiOpen: !s.aiOpen })),
  closeAI:       () => set({ aiOpen: false }),
}))

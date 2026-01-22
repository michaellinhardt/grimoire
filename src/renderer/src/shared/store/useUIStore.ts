import { create } from 'zustand'

interface UIState {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  activeTabId: string | null
  setLeftPanelOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  setActiveTab: (tabId: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTabId: null,
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setActiveTab: (tabId) => set({ activeTabId: tabId })
}))

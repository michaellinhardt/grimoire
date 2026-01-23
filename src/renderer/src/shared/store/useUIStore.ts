import { create } from 'zustand'
import type { SubAgentBlock } from '@renderer/features/sessions/components/types'

export type SessionState = 'idle' | 'working' | 'error'

export interface Tab {
  id: string
  type: 'session' | 'subagent' | 'file'
  title: string
  sessionId: string | null // null for unsaved sessions
  sessionState: SessionState // for status indicators
}

// Input type for addTab - sessionId and sessionState are optional with defaults
export type AddTabInput = Omit<Tab, 'sessionId' | 'sessionState'> &
  Partial<Pick<Tab, 'sessionId' | 'sessionState'>>

interface UIState {
  // Panel state (RENAMED from leftPanelOpen/rightPanelOpen - inverted logic)
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean

  // Tab state
  tabs: Tab[]
  activeTabId: string | null

  // Section state
  activeSection: 'sessions' | 'settings'

  // Session list state (Story 2a.3)
  showArchived: boolean

  // Scroll positions per session for tab switching persistence (Story 2b.1)
  scrollPositions: Map<string, number>

  // Actions
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  setActiveSection: (section: 'sessions' | 'settings') => void
  setShowArchived: (show: boolean) => void
  addTab: (tab: AddTabInput) => void
  closeTab: (id: string) => void
  setActiveTabId: (id: string | null) => void
  findTabBySessionId: (sessionId: string) => Tab | undefined
  focusOrOpenSession: (sessionId: string, title: string) => void
  updateTabSessionState: (tabId: string, sessionState: SessionState) => void
  updateTabTitle: (tabId: string, title: string) => void
  setScrollPosition: (sessionId: string, position: number) => void
  getScrollPosition: (sessionId: string) => number
  clearScrollPosition: (sessionId: string) => void
  openSubAgentTab: (subAgent: SubAgentBlock) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  tabs: [],
  activeTabId: null,
  activeSection: 'sessions',
  showArchived: false,
  scrollPositions: new Map(),

  // Actions
  setLeftPanelCollapsed: (collapsed) => set({ leftPanelCollapsed: collapsed }),
  setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
  setActiveSection: (section) => set({ activeSection: section }),
  setShowArchived: (show) => set({ showArchived: show }),

  addTab: (tab) =>
    set((state) => {
      const newTab: Tab = {
        ...tab,
        sessionId: tab.sessionId ?? null,
        sessionState: tab.sessionState ?? 'idle'
      }
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id
      }
    }),

  closeTab: (id) =>
    set((state) => {
      const closingTab = state.tabs.find((t) => t.id === id)
      const index = state.tabs.findIndex((t) => t.id === id)
      const newTabs = state.tabs.filter((t) => t.id !== id)

      // Select previous tab, or next if closing first, or null if empty
      let newActiveId: string | null = null
      if (newTabs.length > 0) {
        if (state.activeTabId === id) {
          newActiveId = index > 0 ? newTabs[index - 1].id : newTabs[0].id
        } else {
          newActiveId = state.activeTabId
        }
      }

      // Clear scroll position for closed session tab
      const newScrollPositions = new Map(state.scrollPositions)
      if (closingTab?.sessionId) {
        newScrollPositions.delete(closingTab.sessionId)
      }

      return { tabs: newTabs, activeTabId: newActiveId, scrollPositions: newScrollPositions }
    }),

  setActiveTabId: (id) => set({ activeTabId: id }),

  findTabBySessionId: (sessionId) => {
    return get().tabs.find((t) => t.sessionId === sessionId)
  },

  focusOrOpenSession: (sessionId, title) =>
    set((state) => {
      const existingTab = state.tabs.find((t) => t.sessionId === sessionId)
      if (existingTab) {
        return { activeTabId: existingTab.id }
      }
      const newTab: Tab = {
        id: crypto.randomUUID(),
        type: 'session',
        title,
        sessionId,
        sessionState: 'idle'
      }
      return { tabs: [...state.tabs, newTab], activeTabId: newTab.id }
    }),

  updateTabSessionState: (tabId, sessionState) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, sessionState } : t))
    })),

  updateTabTitle: (tabId, title) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
    })),

  setScrollPosition: (sessionId, position) =>
    set((state) => ({
      scrollPositions: new Map(state.scrollPositions).set(sessionId, position)
    })),

  getScrollPosition: (sessionId) => get().scrollPositions.get(sessionId) ?? 0,

  clearScrollPosition: (sessionId) =>
    set((state) => {
      const newMap = new Map(state.scrollPositions)
      newMap.delete(sessionId)
      return { scrollPositions: newMap }
    }),

  openSubAgentTab: (subAgent) =>
    set((state) => {
      // Check if sub-agent tab already open
      const existing = state.tabs.find((t) => t.type === 'subagent' && t.sessionId === subAgent.id)
      if (existing) {
        return { activeTabId: existing.id }
      }

      // Create new sub-agent tab
      const shortId = subAgent.id.slice(-4)
      const title = `${subAgent.agentType}-${shortId}` // e.g., "Explore-a8b2"

      const newTab: Tab = {
        id: `subagent-${subAgent.id}`,
        type: 'subagent',
        title,
        sessionId: subAgent.id,
        sessionState:
          subAgent.status === 'running' ? 'working' : subAgent.status === 'error' ? 'error' : 'idle'
      }

      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id
      }
    })
}))

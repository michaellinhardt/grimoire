import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore, Tab } from './useUIStore'
import type { SubAgentBlock } from '@renderer/features/sessions/components/types'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUIStore.setState({
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      rightPanelActiveTab: 'info',
      tabs: [],
      activeTabId: null,
      activeSection: 'sessions',
      showArchived: false,
      scrollPositions: new Map(),
      // Story 2c-3: Timeline scroll sync
      activeTimelineEventUuid: null,
      scrollToConversationEvent: null
    })
  })

  // Helper to create full Tab objects with defaults for new properties
  const createTab = (
    partial: Partial<Tab> & { id: string; type: Tab['type']; title: string }
  ): Tab => ({
    sessionId: null,
    sessionState: 'idle',
    ...partial
  })

  it('has correct initial state', () => {
    const state = useUIStore.getState()
    expect(state.leftPanelCollapsed).toBe(false)
    expect(state.rightPanelCollapsed).toBe(false)
    expect(state.rightPanelActiveTab).toBe('info')
    expect(state.tabs).toEqual([])
    expect(state.activeTabId).toBe(null)
    expect(state.activeSection).toBe('sessions')
    // Story 2c-3
    expect(state.activeTimelineEventUuid).toBe(null)
    expect(state.scrollToConversationEvent).toBe(null)
  })

  describe('panel state', () => {
    it('setLeftPanelCollapsed updates left panel state', () => {
      const { setLeftPanelCollapsed } = useUIStore.getState()

      setLeftPanelCollapsed(true)
      expect(useUIStore.getState().leftPanelCollapsed).toBe(true)

      setLeftPanelCollapsed(false)
      expect(useUIStore.getState().leftPanelCollapsed).toBe(false)
    })

    it('setRightPanelCollapsed updates right panel state', () => {
      const { setRightPanelCollapsed } = useUIStore.getState()

      setRightPanelCollapsed(true)
      expect(useUIStore.getState().rightPanelCollapsed).toBe(true)

      setRightPanelCollapsed(false)
      expect(useUIStore.getState().rightPanelCollapsed).toBe(false)
    })
  })

  describe('right panel tab state (Story 2c.1)', () => {
    it('has default rightPanelActiveTab as info', () => {
      const state = useUIStore.getState()
      expect(state.rightPanelActiveTab).toBe('info')
    })

    it('setRightPanelActiveTab updates active tab', () => {
      const { setRightPanelActiveTab } = useUIStore.getState()

      setRightPanelActiveTab('events')
      expect(useUIStore.getState().rightPanelActiveTab).toBe('events')

      setRightPanelActiveTab('files')
      expect(useUIStore.getState().rightPanelActiveTab).toBe('files')

      setRightPanelActiveTab('info')
      expect(useUIStore.getState().rightPanelActiveTab).toBe('info')
    })

    it('rightPanelActiveTab is independent from rightPanelCollapsed', () => {
      const { setRightPanelCollapsed, setRightPanelActiveTab } = useUIStore.getState()

      setRightPanelActiveTab('events')
      setRightPanelCollapsed(true)

      const state = useUIStore.getState()
      expect(state.rightPanelActiveTab).toBe('events')
      expect(state.rightPanelCollapsed).toBe(true)
    })
  })

  describe('section state', () => {
    it('setActiveSection updates active section', () => {
      const { setActiveSection } = useUIStore.getState()

      setActiveSection('settings')
      expect(useUIStore.getState().activeSection).toBe('settings')

      setActiveSection('sessions')
      expect(useUIStore.getState().activeSection).toBe('sessions')
    })
  })

  describe('tab management', () => {
    const mockTab1: Tab = createTab({ id: 'tab-1', type: 'session', title: 'Session 1' })
    const mockTab2: Tab = createTab({ id: 'tab-2', type: 'session', title: 'Session 2' })
    const mockTab3: Tab = createTab({ id: 'tab-3', type: 'subagent', title: 'Sub Agent' })

    it('setActiveTabId updates active tab', () => {
      const { setActiveTabId } = useUIStore.getState()

      setActiveTabId('tab-1')
      expect(useUIStore.getState().activeTabId).toBe('tab-1')

      setActiveTabId('tab-2')
      expect(useUIStore.getState().activeTabId).toBe('tab-2')

      setActiveTabId(null)
      expect(useUIStore.getState().activeTabId).toBe(null)
    })

    it('addTab adds tab and sets it as active', () => {
      const { addTab } = useUIStore.getState()

      addTab(mockTab1)
      expect(useUIStore.getState().tabs).toEqual([mockTab1])
      expect(useUIStore.getState().activeTabId).toBe('tab-1')

      addTab(mockTab2)
      expect(useUIStore.getState().tabs).toEqual([mockTab1, mockTab2])
      expect(useUIStore.getState().activeTabId).toBe('tab-2')
    })

    it('closeTab removes tab and selects previous tab', () => {
      // Setup: add 3 tabs, active is tab-3
      useUIStore.setState({
        tabs: [mockTab1, mockTab2, mockTab3],
        activeTabId: 'tab-3'
      })

      const { closeTab } = useUIStore.getState()

      // Close active tab (tab-3), should select previous (tab-2)
      closeTab('tab-3')
      expect(useUIStore.getState().tabs).toEqual([mockTab1, mockTab2])
      expect(useUIStore.getState().activeTabId).toBe('tab-2')
    })

    it('closeTab selects next tab when closing first tab', () => {
      useUIStore.setState({
        tabs: [mockTab1, mockTab2],
        activeTabId: 'tab-1'
      })

      const { closeTab } = useUIStore.getState()

      // Close first tab, should select next (tab-2)
      closeTab('tab-1')
      expect(useUIStore.getState().tabs).toEqual([mockTab2])
      expect(useUIStore.getState().activeTabId).toBe('tab-2')
    })

    it('closeTab sets activeTabId to null when closing last tab', () => {
      useUIStore.setState({
        tabs: [mockTab1],
        activeTabId: 'tab-1'
      })

      const { closeTab } = useUIStore.getState()

      closeTab('tab-1')
      expect(useUIStore.getState().tabs).toEqual([])
      expect(useUIStore.getState().activeTabId).toBe(null)
    })

    it('closeTab keeps current active when closing non-active tab', () => {
      useUIStore.setState({
        tabs: [mockTab1, mockTab2, mockTab3],
        activeTabId: 'tab-1'
      })

      const { closeTab } = useUIStore.getState()

      // Close tab-2 (not active), active should remain tab-1
      closeTab('tab-2')
      expect(useUIStore.getState().tabs).toEqual([mockTab1, mockTab3])
      expect(useUIStore.getState().activeTabId).toBe('tab-1')
    })
  })

  it('state updates are immutable (do not affect other properties)', () => {
    const { setLeftPanelCollapsed, setActiveTabId } = useUIStore.getState()

    setActiveTabId('my-tab')
    setLeftPanelCollapsed(true)

    const state = useUIStore.getState()
    expect(state.leftPanelCollapsed).toBe(true)
    expect(state.activeTabId).toBe('my-tab')
    expect(state.rightPanelCollapsed).toBe(false)
    expect(state.activeSection).toBe('sessions')
  })

  describe('session-tab binding (Story 1.3)', () => {
    const sessionId1 = '550e8400-e29b-41d4-a716-446655440001'
    const sessionId2 = '550e8400-e29b-41d4-a716-446655440002'

    it('addTab without sessionId/sessionState uses defaults', () => {
      const { addTab } = useUIStore.getState()

      // Add tab without new properties (backward compatibility)
      addTab({ id: 'tab-1', type: 'session', title: 'Test Session' })

      const tab = useUIStore.getState().tabs[0]
      expect(tab.sessionId).toBe(null)
      expect(tab.sessionState).toBe('idle')
    })

    it('addTab with sessionId/sessionState preserves values', () => {
      const { addTab } = useUIStore.getState()

      addTab({
        id: 'tab-1',
        type: 'session',
        title: 'Test Session',
        sessionId: sessionId1,
        sessionState: 'working'
      })

      const tab = useUIStore.getState().tabs[0]
      expect(tab.sessionId).toBe(sessionId1)
      expect(tab.sessionState).toBe('working')
    })

    it('findTabBySessionId returns undefined when no tab has that sessionId', () => {
      const { findTabBySessionId, addTab } = useUIStore.getState()

      addTab({ id: 'tab-1', type: 'session', title: 'Session 1' })

      const result = findTabBySessionId(sessionId1)
      expect(result).toBeUndefined()
    })

    it('findTabBySessionId returns correct tab when sessionId exists', () => {
      const { findTabBySessionId, addTab } = useUIStore.getState()

      addTab({ id: 'tab-1', type: 'session', title: 'Session 1', sessionId: sessionId1 })
      addTab({ id: 'tab-2', type: 'session', title: 'Session 2', sessionId: sessionId2 })

      const result = findTabBySessionId(sessionId1)
      expect(result).toBeDefined()
      expect(result?.id).toBe('tab-1')
      expect(result?.sessionId).toBe(sessionId1)
    })

    it('focusOrOpenSession with new session creates tab with correct properties', () => {
      const { focusOrOpenSession } = useUIStore.getState()

      focusOrOpenSession(sessionId1, 'My Session')

      const state = useUIStore.getState()
      expect(state.tabs.length).toBe(1)
      expect(state.tabs[0].sessionId).toBe(sessionId1)
      expect(state.tabs[0].title).toBe('My Session')
      expect(state.tabs[0].type).toBe('session')
      expect(state.tabs[0].sessionState).toBe('idle')
      expect(state.activeTabId).toBe(state.tabs[0].id)
    })

    it('focusOrOpenSession with existing session focuses tab (returns existing tab ID)', () => {
      const { focusOrOpenSession, addTab } = useUIStore.getState()

      // Add initial tab
      addTab({ id: 'tab-1', type: 'session', title: 'Session 1', sessionId: sessionId1 })
      addTab({ id: 'tab-2', type: 'session', title: 'Session 2', sessionId: sessionId2 })

      // activeTabId is now tab-2
      expect(useUIStore.getState().activeTabId).toBe('tab-2')

      // Open session1 again - should focus existing tab
      focusOrOpenSession(sessionId1, 'Session 1 Updated')

      const state = useUIStore.getState()
      expect(state.tabs.length).toBe(2) // No new tab created
      expect(state.activeTabId).toBe('tab-1') // Focused existing tab
    })

    it('updateTabSessionState updates only specified tab', () => {
      const { updateTabSessionState, addTab } = useUIStore.getState()

      addTab({ id: 'tab-1', type: 'session', title: 'Session 1', sessionState: 'idle' })
      addTab({ id: 'tab-2', type: 'session', title: 'Session 2', sessionState: 'idle' })

      updateTabSessionState('tab-1', 'working')

      const state = useUIStore.getState()
      expect(state.tabs[0].sessionState).toBe('working')
      expect(state.tabs[1].sessionState).toBe('idle')
    })

    it('updateTabTitle updates only specified tab', () => {
      const { updateTabTitle, addTab } = useUIStore.getState()

      addTab({ id: 'tab-1', type: 'session', title: 'Original Title' })
      addTab({ id: 'tab-2', type: 'session', title: 'Other Tab' })

      updateTabTitle('tab-1', 'Updated Title')

      const state = useUIStore.getState()
      expect(state.tabs[0].title).toBe('Updated Title')
      expect(state.tabs[1].title).toBe('Other Tab')
    })

    describe('updateTabSessionId (Story 3a.2)', () => {
      it('updates sessionId for specified tab', () => {
        const newSessionId = '550e8400-e29b-41d4-a716-446655440099'
        const { addTab, updateTabSessionId } = useUIStore.getState()

        addTab({
          id: 'tab-1',
          type: 'session',
          title: 'New Session',
          sessionId: null
        })

        updateTabSessionId('tab-1', newSessionId)

        const state = useUIStore.getState()
        expect(state.tabs[0].sessionId).toBe(newSessionId)
      })

      it('does not affect other tabs', () => {
        const { addTab, updateTabSessionId } = useUIStore.getState()

        addTab({
          id: 'tab-1',
          type: 'session',
          title: 'Session 1',
          sessionId: null
        })
        addTab({
          id: 'tab-2',
          type: 'session',
          title: 'Session 2',
          sessionId: 'existing-session-id'
        })

        updateTabSessionId('tab-1', 'new-session-id')

        const state = useUIStore.getState()
        expect(state.tabs[0].sessionId).toBe('new-session-id')
        expect(state.tabs[1].sessionId).toBe('existing-session-id')
      })

      it('handles non-existent tab gracefully', () => {
        const { updateTabSessionId } = useUIStore.getState()

        // Should not throw
        expect(() => updateTabSessionId('non-existent', 'session-id')).not.toThrow()
      })
    })

    it('closeTab removes correct tab (existing tests should still pass)', () => {
      const tab1 = createTab({
        id: 'tab-1',
        type: 'session',
        title: 'Session 1',
        sessionId: sessionId1,
        sessionState: 'working'
      })
      const tab2 = createTab({
        id: 'tab-2',
        type: 'session',
        title: 'Session 2',
        sessionId: sessionId2,
        sessionState: 'idle'
      })

      useUIStore.setState({
        tabs: [tab1, tab2],
        activeTabId: 'tab-2'
      })

      const { closeTab } = useUIStore.getState()
      closeTab('tab-1')

      const state = useUIStore.getState()
      expect(state.tabs.length).toBe(1)
      expect(state.tabs[0].id).toBe('tab-2')
      expect(state.activeTabId).toBe('tab-2')
    })

    it('Tab interface includes new fields (sessionId, sessionState)', () => {
      const { addTab } = useUIStore.getState()

      addTab({
        id: 'test-tab',
        type: 'session',
        title: 'Test',
        sessionId: sessionId1,
        sessionState: 'error'
      })

      const tab = useUIStore.getState().tabs[0]
      // TypeScript would catch if these properties don't exist
      expect('sessionId' in tab).toBe(true)
      expect('sessionState' in tab).toBe(true)
      expect(tab.sessionId).toBe(sessionId1)
      expect(tab.sessionState).toBe('error')
    })

    it('session state transitions update tab state', () => {
      const { addTab, updateTabSessionState } = useUIStore.getState()

      addTab({ id: 'tab-1', type: 'session', title: 'Session', sessionState: 'idle' })

      // Idle -> Working
      updateTabSessionState('tab-1', 'working')
      expect(useUIStore.getState().tabs[0].sessionState).toBe('working')

      // Working -> Error
      updateTabSessionState('tab-1', 'error')
      expect(useUIStore.getState().tabs[0].sessionState).toBe('error')

      // Error -> Working (retry)
      updateTabSessionState('tab-1', 'working')
      expect(useUIStore.getState().tabs[0].sessionState).toBe('working')

      // Working -> Idle (complete)
      updateTabSessionState('tab-1', 'idle')
      expect(useUIStore.getState().tabs[0].sessionState).toBe('idle')
    })

    it('tab state persists across switches', () => {
      const { addTab, setActiveTabId, updateTabSessionState } = useUIStore.getState()

      addTab({ id: 'tab-1', type: 'session', title: 'Session 1', sessionState: 'working' })
      addTab({ id: 'tab-2', type: 'session', title: 'Session 2', sessionState: 'idle' })

      // Switch to tab-1
      setActiveTabId('tab-1')
      expect(useUIStore.getState().tabs[0].sessionState).toBe('working')

      // Switch to tab-2
      setActiveTabId('tab-2')
      expect(useUIStore.getState().tabs[0].sessionState).toBe('working') // tab-1 still working

      // Update tab-1 while tab-2 is active
      updateTabSessionState('tab-1', 'error')

      // Switch back and verify
      setActiveTabId('tab-1')
      expect(useUIStore.getState().tabs[0].sessionState).toBe('error')
    })

    it('closeTab with idle session closes immediately (store level)', () => {
      // Note: UI-level confirmation is tested via TabBar component tests
      // This test verifies store closeTab works for idle sessions
      const idleTab = createTab({
        id: 'idle-tab',
        type: 'session',
        title: 'Idle Session',
        sessionId: sessionId1,
        sessionState: 'idle'
      })
      const workingTab = createTab({
        id: 'working-tab',
        type: 'session',
        title: 'Working Session',
        sessionId: sessionId2,
        sessionState: 'working'
      })

      useUIStore.setState({
        tabs: [idleTab, workingTab],
        activeTabId: 'idle-tab'
      })

      const { closeTab } = useUIStore.getState()

      // Store-level closeTab works regardless of session state
      // UI-level TabBar decides whether to show confirmation
      closeTab('idle-tab')

      const state = useUIStore.getState()
      expect(state.tabs.length).toBe(1)
      expect(state.tabs[0].id).toBe('working-tab')
      expect(state.activeTabId).toBe('working-tab')
    })
  })

  describe('scroll position persistence (Story 2b.1)', () => {
    const sessionId1 = '550e8400-e29b-41d4-a716-446655440001'
    const sessionId2 = '550e8400-e29b-41d4-a716-446655440002'

    it('stores scroll position for session', () => {
      const { setScrollPosition, getScrollPosition } = useUIStore.getState()

      setScrollPosition(sessionId1, 500)

      expect(getScrollPosition(sessionId1)).toBe(500)
    })

    it('returns 0 for unknown session', () => {
      const { getScrollPosition } = useUIStore.getState()
      expect(getScrollPosition('unknown-session')).toBe(0)
    })

    it('clears scroll position for session', () => {
      const { setScrollPosition, clearScrollPosition, getScrollPosition } = useUIStore.getState()

      setScrollPosition(sessionId1, 500)
      expect(getScrollPosition(sessionId1)).toBe(500)

      clearScrollPosition(sessionId1)
      expect(getScrollPosition(sessionId1)).toBe(0)
    })

    it('stores multiple scroll positions independently', () => {
      const { setScrollPosition, getScrollPosition } = useUIStore.getState()

      setScrollPosition(sessionId1, 100)
      setScrollPosition(sessionId2, 200)

      expect(getScrollPosition(sessionId1)).toBe(100)
      expect(getScrollPosition(sessionId2)).toBe(200)
    })

    it('updates existing scroll position', () => {
      const { setScrollPosition, getScrollPosition } = useUIStore.getState()

      setScrollPosition(sessionId1, 100)
      expect(getScrollPosition(sessionId1)).toBe(100)

      setScrollPosition(sessionId1, 300)
      expect(getScrollPosition(sessionId1)).toBe(300)
    })

    it('clears scroll position when closing session tab', () => {
      const { addTab, setScrollPosition, getScrollPosition, closeTab } = useUIStore.getState()

      // Add tab and set scroll position
      addTab({
        id: 'tab-1',
        type: 'session',
        title: 'Test Session',
        sessionId: sessionId1
      })
      setScrollPosition(sessionId1, 500)

      expect(getScrollPosition(sessionId1)).toBe(500)

      // Close the tab
      closeTab('tab-1')

      expect(getScrollPosition(sessionId1)).toBe(0)
    })

    it('does not clear scroll position when closing tab without sessionId', () => {
      const { addTab, setScrollPosition, getScrollPosition, closeTab } = useUIStore.getState()

      // Add session tab with scroll position
      addTab({
        id: 'tab-1',
        type: 'session',
        title: 'Session Tab',
        sessionId: sessionId1
      })
      setScrollPosition(sessionId1, 500)

      // Add new unsaved session tab (no sessionId)
      addTab({
        id: 'tab-2',
        type: 'session',
        title: 'New Session',
        sessionId: null
      })

      // Close the tab without sessionId
      closeTab('tab-2')

      // Session scroll position should remain
      expect(getScrollPosition(sessionId1)).toBe(500)
    })

    it('preserves other scroll positions when clearing one', () => {
      const { setScrollPosition, clearScrollPosition, getScrollPosition } = useUIStore.getState()

      setScrollPosition(sessionId1, 100)
      setScrollPosition(sessionId2, 200)

      clearScrollPosition(sessionId1)

      expect(getScrollPosition(sessionId1)).toBe(0)
      expect(getScrollPosition(sessionId2)).toBe(200)
    })
  })

  describe('openSubAgentTab (Story 2b.3)', () => {
    const mockSubAgent: SubAgentBlock = {
      type: 'sub_agent',
      id: 'subagent-001-a8b2',
      agentType: 'Explore',
      label: 'Code Analysis Agent',
      parentMessageUuid: 'msg-001',
      path: '/.claude/sub-agents/subagent-001-a8b2.jsonl',
      status: 'done',
      messageCount: 8,
      toolCount: 5,
      summary: 'Analyzed authentication module.'
    }

    const mockRunningAgent: SubAgentBlock = {
      ...mockSubAgent,
      id: 'subagent-002-f3c1',
      status: 'running'
    }

    const mockErrorAgent: SubAgentBlock = {
      ...mockSubAgent,
      id: 'subagent-003-d4e5',
      status: 'error'
    }

    it('creates new tab with type "subagent"', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockSubAgent)

      const state = useUIStore.getState()
      expect(state.tabs.length).toBe(1)
      expect(state.tabs[0].type).toBe('subagent')
    })

    it('sets tab title to "{agentType}-{shortId}" format', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockSubAgent)

      const state = useUIStore.getState()
      expect(state.tabs[0].title).toBe('Explore-a8b2') // Last 4 chars of ID
    })

    it('sets sessionId to sub-agent ID', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockSubAgent)

      const state = useUIStore.getState()
      expect(state.tabs[0].sessionId).toBe('subagent-001-a8b2')
    })

    it('sets tab ID with subagent prefix', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockSubAgent)

      const state = useUIStore.getState()
      expect(state.tabs[0].id).toBe('subagent-subagent-001-a8b2')
    })

    it('makes new tab active', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockSubAgent)

      const state = useUIStore.getState()
      expect(state.activeTabId).toBe('subagent-subagent-001-a8b2')
    })

    it('focuses existing tab if sub-agent already open', () => {
      const { openSubAgentTab, addTab } = useUIStore.getState()

      // First, open the sub-agent tab
      openSubAgentTab(mockSubAgent)

      // Add another tab and make it active
      addTab({ id: 'other-tab', type: 'session', title: 'Other' })
      expect(useUIStore.getState().activeTabId).toBe('other-tab')

      // Open the same sub-agent again
      openSubAgentTab(mockSubAgent)

      // Should focus existing tab, not create new one
      const state = useUIStore.getState()
      expect(state.tabs.filter((t) => t.type === 'subagent').length).toBe(1)
      expect(state.activeTabId).toBe('subagent-subagent-001-a8b2')
    })

    it('maps "running" status to "working" sessionState', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockRunningAgent)

      const state = useUIStore.getState()
      expect(state.tabs[0].sessionState).toBe('working')
    })

    it('maps "error" status to "error" sessionState', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockErrorAgent)

      const state = useUIStore.getState()
      expect(state.tabs[0].sessionState).toBe('error')
    })

    it('maps "done" status to "idle" sessionState', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockSubAgent) // status: 'done'

      const state = useUIStore.getState()
      expect(state.tabs[0].sessionState).toBe('idle')
    })

    it('can open multiple different sub-agent tabs', () => {
      const { openSubAgentTab } = useUIStore.getState()

      openSubAgentTab(mockSubAgent)
      openSubAgentTab(mockRunningAgent)
      openSubAgentTab(mockErrorAgent)

      const state = useUIStore.getState()
      expect(state.tabs.length).toBe(3)
      expect(state.tabs.map((t) => t.type)).toEqual(['subagent', 'subagent', 'subagent'])
    })
  })

  describe('timeline scroll sync (Story 2c-3)', () => {
    it('has default activeTimelineEventUuid as null', () => {
      const state = useUIStore.getState()
      expect(state.activeTimelineEventUuid).toBe(null)
    })

    it('setActiveTimelineEventUuid updates active event', () => {
      const { setActiveTimelineEventUuid } = useUIStore.getState()

      setActiveTimelineEventUuid('evt-123')
      expect(useUIStore.getState().activeTimelineEventUuid).toBe('evt-123')

      setActiveTimelineEventUuid('evt-456')
      expect(useUIStore.getState().activeTimelineEventUuid).toBe('evt-456')

      setActiveTimelineEventUuid(null)
      expect(useUIStore.getState().activeTimelineEventUuid).toBe(null)
    })

    it('has default scrollToConversationEvent as null', () => {
      const state = useUIStore.getState()
      expect(state.scrollToConversationEvent).toBe(null)
    })

    it('setScrollToConversationEvent stores function reference', () => {
      const { setScrollToConversationEvent } = useUIStore.getState()
      const mockScrollFn = (uuid: string): void => {
        console.log('scroll to', uuid)
      }

      setScrollToConversationEvent(mockScrollFn)
      expect(useUIStore.getState().scrollToConversationEvent).toBe(mockScrollFn)

      setScrollToConversationEvent(null)
      expect(useUIStore.getState().scrollToConversationEvent).toBe(null)
    })

    it('activeTimelineEventUuid is independent from other state', () => {
      const { setActiveTimelineEventUuid, setRightPanelActiveTab } = useUIStore.getState()

      setActiveTimelineEventUuid('evt-123')
      setRightPanelActiveTab('events')

      const state = useUIStore.getState()
      expect(state.activeTimelineEventUuid).toBe('evt-123')
      expect(state.rightPanelActiveTab).toBe('events')
    })
  })
})

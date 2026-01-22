import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './useUIStore'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUIStore.setState({
      leftPanelOpen: true,
      rightPanelOpen: true,
      activeTabId: null
    })
  })

  it('has correct initial state', () => {
    const state = useUIStore.getState()
    expect(state.leftPanelOpen).toBe(true)
    expect(state.rightPanelOpen).toBe(true)
    expect(state.activeTabId).toBe(null)
  })

  it('setLeftPanelOpen updates left panel state', () => {
    const { setLeftPanelOpen } = useUIStore.getState()

    setLeftPanelOpen(false)
    expect(useUIStore.getState().leftPanelOpen).toBe(false)

    setLeftPanelOpen(true)
    expect(useUIStore.getState().leftPanelOpen).toBe(true)
  })

  it('setRightPanelOpen updates right panel state', () => {
    const { setRightPanelOpen } = useUIStore.getState()

    setRightPanelOpen(false)
    expect(useUIStore.getState().rightPanelOpen).toBe(false)

    setRightPanelOpen(true)
    expect(useUIStore.getState().rightPanelOpen).toBe(true)
  })

  it('setActiveTab updates active tab', () => {
    const { setActiveTab } = useUIStore.getState()

    setActiveTab('tab-1')
    expect(useUIStore.getState().activeTabId).toBe('tab-1')

    setActiveTab('tab-2')
    expect(useUIStore.getState().activeTabId).toBe('tab-2')

    setActiveTab(null)
    expect(useUIStore.getState().activeTabId).toBe(null)
  })

  it('state updates are immutable (do not affect other properties)', () => {
    const { setLeftPanelOpen, setActiveTab } = useUIStore.getState()

    setActiveTab('my-tab')
    setLeftPanelOpen(false)

    const state = useUIStore.getState()
    expect(state.leftPanelOpen).toBe(false)
    expect(state.activeTabId).toBe('my-tab')
    expect(state.rightPanelOpen).toBe(true)
  })
})

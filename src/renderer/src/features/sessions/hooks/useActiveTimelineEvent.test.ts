import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useActiveTimelineEvent } from './useActiveTimelineEvent'
import { useUIStore } from '@renderer/shared/store/useUIStore'

// Mock IntersectionObserver instance type
interface MockObserverInstance {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  observedElements: Set<Element>
  observe: (element: Element) => void
  unobserve: (element: Element) => void
  disconnect: () => void
  simulateIntersection: (entries: Partial<IntersectionObserverEntry>[]) => void
}

describe('useActiveTimelineEvent', () => {
  let mockObserver: MockObserverInstance | null = null

  beforeEach(() => {
    vi.useFakeTimers()

    // Reset store
    useUIStore.setState({
      activeTimelineEventUuid: null,
      scrollToConversationEvent: null
    })

    // Mock IntersectionObserver as a class
    const MockIntersectionObserver = class implements IntersectionObserver {
      root: Element | Document | null = null
      rootMargin: string = ''
      thresholds: readonly number[] = []
      callback: IntersectionObserverCallback
      options: IntersectionObserverInit | undefined
      observedElements: Set<Element> = new Set()

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback
        this.options = options
        this.root = options?.root ?? null
        // Store reference for tests
        mockObserver = this as unknown as MockObserverInstance
      }

      observe(element: Element): void {
        this.observedElements.add(element)
      }

      unobserve(element: Element): void {
        this.observedElements.delete(element)
      }

      disconnect(): void {
        this.observedElements.clear()
      }

      takeRecords(): IntersectionObserverEntry[] {
        return []
      }

      // Helper to simulate intersection entries
      simulateIntersection(entries: Partial<IntersectionObserverEntry>[]): void {
        this.callback(entries as IntersectionObserverEntry[], this)
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    mockObserver = null
  })

  it('handles container ref being null', () => {
    const containerRef = { current: null }
    const messageUuids = ['msg-1', 'msg-2']

    // Should not throw
    const { unmount } = renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    expect(useUIStore.getState().activeTimelineEventUuid).toBe(null)
    unmount()
  })

  it('creates IntersectionObserver with container as root', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const messageUuids = ['msg-1', 'msg-2']

    renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    expect(mockObserver).not.toBeNull()
    expect(mockObserver?.options?.root).toBe(container)
    expect(mockObserver?.options?.threshold).toBe(0.5)
  })

  it('observes message elements with data-message-uuid attribute', () => {
    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    const msg2 = document.createElement('div')
    msg2.setAttribute('data-message-uuid', 'msg-2')
    container.appendChild(msg1)
    container.appendChild(msg2)

    const containerRef = { current: container }
    const messageUuids = ['msg-1', 'msg-2']

    renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    expect(mockObserver?.observedElements.size).toBe(2)
    expect(mockObserver?.observedElements.has(msg1)).toBe(true)
    expect(mockObserver?.observedElements.has(msg2)).toBe(true)
  })

  it('updates activeTimelineEventUuid when message becomes visible', async () => {
    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    container.appendChild(msg1)

    const containerRef = { current: container }
    const messageUuids = ['msg-1']

    renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    // Simulate message becoming visible
    mockObserver?.simulateIntersection([
      {
        target: msg1,
        isIntersecting: true
      }
    ])

    // Wait for debounce - wrap in act() since it triggers state updates
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(useUIStore.getState().activeTimelineEventUuid).toBe('msg-1')
  })

  it('clears activeTimelineEventUuid when no messages visible', async () => {
    // Start with a visible message
    useUIStore.setState({ activeTimelineEventUuid: 'msg-1' })

    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    container.appendChild(msg1)

    const containerRef = { current: container }
    const messageUuids = ['msg-1']

    renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    // Simulate message becoming not visible
    mockObserver?.simulateIntersection([
      {
        target: msg1,
        isIntersecting: false
      }
    ])

    // Wait for debounce - wrap in act() since it triggers state updates
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(useUIStore.getState().activeTimelineEventUuid).toBe(null)
  })

  it('debounces rapid updates (100ms)', async () => {
    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    const msg2 = document.createElement('div')
    msg2.setAttribute('data-message-uuid', 'msg-2')
    container.appendChild(msg1)
    container.appendChild(msg2)

    const containerRef = { current: container }
    const messageUuids = ['msg-1', 'msg-2']

    renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    // Rapid scroll updates
    mockObserver?.simulateIntersection([{ target: msg1, isIntersecting: true }])
    vi.advanceTimersByTime(50)
    mockObserver?.simulateIntersection([{ target: msg2, isIntersecting: true }])
    vi.advanceTimersByTime(50)

    // After 50ms + 50ms = 100ms from last call, debounce fires
    // Wrap in act() since it triggers state updates
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    // Should be msg-1 since it appears first in messageUuids
    expect(useUIStore.getState().activeTimelineEventUuid).toBe('msg-1')
  })

  it('selects topmost visible message in display order', async () => {
    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    const msg2 = document.createElement('div')
    msg2.setAttribute('data-message-uuid', 'msg-2')
    const msg3 = document.createElement('div')
    msg3.setAttribute('data-message-uuid', 'msg-3')
    container.appendChild(msg1)
    container.appendChild(msg2)
    container.appendChild(msg3)

    const containerRef = { current: container }
    // Order in array determines "topmost" (msg-1 is first)
    const messageUuids = ['msg-1', 'msg-2', 'msg-3']

    renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    // Simulate msg-2 and msg-3 visible (but not msg-1)
    mockObserver?.simulateIntersection([
      { target: msg2, isIntersecting: true },
      { target: msg3, isIntersecting: true }
    ])

    // Wrap in act() since it triggers state updates
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Should select msg-2 as it's first in the messageUuids array among visible
    expect(useUIStore.getState().activeTimelineEventUuid).toBe('msg-2')
  })

  it('cleans up observer on unmount', () => {
    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    container.appendChild(msg1)

    const containerRef = { current: container }
    const messageUuids = ['msg-1']

    const { unmount } = renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    expect(mockObserver?.observedElements.size).toBe(1)

    unmount()

    expect(mockObserver?.observedElements.size).toBe(0)
  })

  it('re-observes elements when messageUuids change', () => {
    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    const msg2 = document.createElement('div')
    msg2.setAttribute('data-message-uuid', 'msg-2')
    container.appendChild(msg1)
    container.appendChild(msg2)

    const containerRef = { current: container }

    const { rerender } = renderHook(
      ({ messageUuids }) => useActiveTimelineEvent(containerRef, messageUuids),
      { initialProps: { messageUuids: ['msg-1'] } }
    )

    // Initial observation
    expect(mockObserver?.observedElements.size).toBe(2) // querySelectorAll finds both

    // Rerender with new messageUuids
    rerender({ messageUuids: ['msg-1', 'msg-2', 'msg-3'] })

    // Observer should have been recreated and re-observed elements
    expect(mockObserver).not.toBeNull()
  })

  it('ignores elements without data-message-uuid', async () => {
    const container = document.createElement('div')
    const msg1 = document.createElement('div')
    msg1.setAttribute('data-message-uuid', 'msg-1')
    const noUuidElement = document.createElement('div')
    noUuidElement.className = 'decoration'
    container.appendChild(msg1)
    container.appendChild(noUuidElement)

    const containerRef = { current: container }
    const messageUuids = ['msg-1']

    renderHook(() => useActiveTimelineEvent(containerRef, messageUuids))

    // Simulate non-uuid element becoming visible
    mockObserver?.simulateIntersection([{ target: noUuidElement, isIntersecting: true }])

    // Wrap in act() since it triggers state updates
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Should be null since noUuidElement has no data-message-uuid
    expect(useUIStore.getState().activeTimelineEventUuid).toBe(null)
  })
})

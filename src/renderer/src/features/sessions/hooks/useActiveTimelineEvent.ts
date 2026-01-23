import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'

/** Debounce delay for scroll position updates */
const SCROLL_DEBOUNCE_MS = 100

/** Track observed elements to avoid re-observing */
interface ObserverState {
  observer: IntersectionObserver
  observedElements: Set<Element>
}

/**
 * Hook that tracks the currently visible message in the conversation view.
 * Uses IntersectionObserver to detect which messages are in the viewport,
 * and updates activeTimelineEventUuid in the UI store.
 *
 * @param containerRef - Ref to the scrollable container element
 * @param messageUuids - Array of message UUIDs in display order
 */
export function useActiveTimelineEvent(
  containerRef: React.RefObject<HTMLElement | null>,
  messageUuids: string[]
): void {
  const { setActiveTimelineEventUuid } = useUIStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleMessagesRef = useRef<Set<string>>(new Set())
  const observerRef = useRef<ObserverState | null>(null)

  const updateActiveEvent = useCallback(() => {
    // Find the topmost visible message (first in the messageUuids array that is visible)
    for (const uuid of messageUuids) {
      if (visibleMessagesRef.current.has(uuid)) {
        setActiveTimelineEventUuid(uuid)
        return
      }
    }
    // No visible messages
    setActiveTimelineEventUuid(null)
  }, [messageUuids, setActiveTimelineEventUuid])

  const debouncedUpdate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(updateActiveEvent, SCROLL_DEBOUNCE_MS)
  }, [updateActiveEvent])

  // Single consolidated useEffect that handles observer setup and re-observation
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Cleanup previous observer if exists
    if (observerRef.current) {
      observerRef.current.observer.disconnect()
    }
    visibleMessagesRef.current.clear()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const uuid = entry.target.getAttribute('data-message-uuid')
          if (!uuid) continue

          if (entry.isIntersecting) {
            visibleMessagesRef.current.add(uuid)
          } else {
            visibleMessagesRef.current.delete(uuid)
          }
        }
        debouncedUpdate()
      },
      {
        root: container,
        threshold: 0.5 // Element is "visible" when 50% in view
      }
    )

    const observedElements = new Set<Element>()

    // Helper to observe an element (avoids re-observing)
    const observeElement = (el: Element): void => {
      if (!observedElements.has(el)) {
        observer.observe(el)
        observedElements.add(el)
      }
    }

    // Observe all message elements
    const messageElements = container.querySelectorAll('[data-message-uuid]')
    messageElements.forEach(observeElement)

    // Watch for new message elements being added to DOM
    // This handles the race condition when messages are rapidly added (e.g., AC5 scenario)
    const mutationObserver = new MutationObserver(() => {
      const allElements = container.querySelectorAll('[data-message-uuid]')
      allElements.forEach(observeElement)
    })

    mutationObserver.observe(container, {
      childList: true,
      subtree: true
    })

    observerRef.current = { observer, observedElements }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      observer.disconnect()
      mutationObserver.disconnect()
      observerRef.current = null
      // Clear the set on cleanup - the ref itself doesn't change, just its contents
      // eslint-disable-next-line react-hooks/exhaustive-deps
      visibleMessagesRef.current.clear()
    }
  }, [containerRef, messageUuids, debouncedUpdate])
}

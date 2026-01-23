import { type ReactElement, useCallback, useEffect, useRef, useMemo } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useUIStore, type RightPanelTab } from '@renderer/shared/store/useUIStore'
import { RightPanelTabs } from './RightPanelTabs'
import { EventTimeline } from '@renderer/features/sessions/components/EventTimeline'
import { SessionInfoView } from '@renderer/features/sessions/components/SessionInfoView'
import { useTimelineEvents } from '@renderer/features/sessions/hooks/useTimelineEvents'
import {
  createMockMessages,
  type TimelineEvent
} from '@renderer/features/sessions/components/types'

/**
 * Placeholder component for Files tab content.
 * Will be replaced with FolderTree component in Story 5b.1.
 */
function FilesPlaceholder(): ReactElement {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <p className="text-sm text-[var(--text-muted)]">Folder tree coming in Story 5b.1</p>
    </div>
  )
}

/**
 * Right panel content with tab navigation for Info, Events, and Files views.
 * Uses Radix Tabs for accessibility with Zustand for state management.
 */
export function RightPanelContent(): ReactElement {
  const {
    tabs,
    activeTabId,
    rightPanelActiveTab,
    activeTimelineEventUuid,
    scrollToConversationEvent,
    setRightPanelActiveTab,
    setRightPanelCollapsed,
    openSubAgentTab
  } = useUIStore()

  const activeMiddleTab = tabs.find((t) => t.id === activeTabId)

  // Get the active session ID from the active tab (for SessionInfoView)
  // Only pass sessionId when the active tab is a session tab
  const activeSessionId = activeMiddleTab?.type === 'session' ? activeMiddleTab.sessionId : null

  // Get mock messages (same pattern as MiddlePanelContent - will be replaced with real data in Epic 3b)
  // REFACTORING NOTE for Epic 3b: Replace createMockMessages() with real data from useConversationStore
  // Current pattern: createMockMessages() -> useTimelineEvents() -> EventTimeline
  // Expected pattern: useConversationStore().messages -> useTimelineEvents() -> EventTimeline
  const mockMessages = useMemo(() => createMockMessages(), [])

  // Convert messages to timeline events (Story 2c-3)
  const timelineEvents = useTimelineEvents(mockMessages)

  // Ref for timeline scroll container (wrapper div inside Tabs.Content)
  const timelineContainerRef = useRef<HTMLDivElement>(null)

  // Auto-select Files tab when viewing a file in middle panel
  useEffect(() => {
    if (activeMiddleTab?.type === 'file' && rightPanelActiveTab !== 'files') {
      setRightPanelActiveTab('files')
    }
  }, [activeMiddleTab?.id, activeMiddleTab?.type, rightPanelActiveTab, setRightPanelActiveTab])

  // Auto-scroll timeline to keep active event visible (Story 2c-3)
  useEffect(() => {
    if (!activeTimelineEventUuid || !timelineContainerRef.current) return

    const activeElement = timelineContainerRef.current.querySelector(
      `[data-event-uuid="${activeTimelineEventUuid}"]`
    )
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeTimelineEventUuid])

  // Event handlers for EventTimeline - use scroll function from store (Story 2c-3)
  const handleEventClick = useCallback(
    (eventUuid: string): void => {
      if (scrollToConversationEvent) {
        scrollToConversationEvent(eventUuid)
      }
    },
    [scrollToConversationEvent]
  )

  const handleSubAgentClick = useCallback(
    (event: TimelineEvent): void => {
      // Only handle sub_agent events that have agentType
      if (event.type === 'sub_agent' && event.agentType) {
        // Create a minimal SubAgentBlock for openSubAgentTab
        // Note: For events from timeline, we use event.uuid as the ID and derive status from timeline data
        // Since TimelineEvent doesn't have complete SubAgentBlock data, we use 'done' status
        // In production, this would be replaced with real data from conversation store
        openSubAgentTab({
          type: 'sub_agent',
          id: event.uuid,
          agentType: event.agentType,
          label: `${event.agentType} Agent`,
          parentMessageUuid: '',
          path: '',
          status: 'done'
        })
      }
    },
    [openSubAgentTab]
  )

  return (
    <Tabs.Root
      value={rightPanelActiveTab}
      onValueChange={(value) => setRightPanelActiveTab(value as RightPanelTab)}
      className="h-full flex flex-col bg-[var(--bg-base)]"
    >
      <RightPanelTabs onCollapse={() => setRightPanelCollapsed(true)} />

      <Tabs.Content value="info" className="flex-1 outline-none overflow-hidden">
        <SessionInfoView sessionId={activeSessionId} />
      </Tabs.Content>

      <Tabs.Content value="events" className="flex-1 outline-none overflow-hidden">
        {/* Wrapper div for ref since Tabs.Content doesn't forward refs */}
        <div ref={timelineContainerRef} className="h-full">
          <EventTimeline
            events={timelineEvents}
            onEventClick={handleEventClick}
            onSubAgentClick={handleSubAgentClick}
            activeEventUuid={activeTimelineEventUuid ?? undefined}
          />
        </div>
      </Tabs.Content>

      <Tabs.Content value="files" className="flex-1 outline-none overflow-hidden">
        <FilesPlaceholder />
      </Tabs.Content>
    </Tabs.Root>
  )
}

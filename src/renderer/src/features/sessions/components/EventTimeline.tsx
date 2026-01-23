import { type ReactElement } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { EventTimelineItem } from './EventTimelineItem'
import type { TimelineEvent } from './types'

export interface EventTimelineProps {
  /** Array of timeline events to display */
  events: TimelineEvent[]
  /** Callback when an event is clicked - receives event UUID */
  onEventClick: (eventUuid: string) => void
  /** UUID of the currently active/visible event (for highlight) */
  activeEventUuid?: string
  /** Callback specifically for sub-agent events to open in tab */
  onSubAgentClick?: (event: TimelineEvent) => void
}

/**
 * Scrollable timeline navigation map for conversation events.
 * Renders EventTimelineItem for each event with proper alignment.
 * User events right-aligned, system events left-aligned.
 *
 * @param events - Array of timeline events to display
 * @param onEventClick - Callback when event is clicked (for scroll-to-event)
 * @param activeEventUuid - UUID of currently visible event (for highlight)
 * @param onSubAgentClick - Callback for sub-agent events (opens in tab instead of scrolling)
 * @returns A scrollable timeline component
 */
export function EventTimeline({
  events,
  onEventClick,
  activeEventUuid,
  onSubAgentClick
}: EventTimelineProps): ReactElement {
  const handleEventClick = (event: TimelineEvent): void => {
    // Sub-agent events open in tab instead of scrolling
    if (event.type === 'sub_agent' && onSubAgentClick) {
      onSubAgentClick(event)
    } else {
      onEventClick(event.uuid)
    }
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm p-4">
        Events will appear as conversation progresses.
      </div>
    )
  }

  return (
    <ScrollArea.Root className="h-full w-full">
      <ScrollArea.Viewport className="h-full w-full">
        <div className="flex flex-col space-y-2 p-2">
          {events.map((event) => (
            <EventTimelineItem
              key={event.uuid}
              event={event}
              isActive={event.uuid === activeEventUuid}
              onClick={() => handleEventClick(event)}
            />
          ))}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        aria-label="Timeline scroll"
        className="flex touch-none select-none p-0.5 transition-colors bg-transparent hover:bg-[var(--bg-hover)]"
      >
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--text-muted)] opacity-50 hover:opacity-75" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}

import { type ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'
import { formatTokenCount } from '@renderer/shared/utils/formatTokenCount'
import { formatMessageTimestamp } from '@renderer/shared/utils/formatMessageTimestamp'
import type { TimelineEvent } from './types'

export interface EventTimelineItemProps {
  /** Timeline event data */
  event: TimelineEvent
  /** Whether this event is currently active (in view) */
  isActive?: boolean
  /** Callback when the event is clicked */
  onClick?: () => void
}

/**
 * Renders a single event in the timeline navigation map.
 * User events are right-aligned with accent background.
 * System events (assistant/tool/sub_agent) are left-aligned with elevated background.
 * Text-only display per UX9 specification (no icons).
 *
 * @param event - Timeline event data
 * @param isActive - Whether this event is currently active
 * @param onClick - Callback when the event is clicked
 * @returns A styled timeline event item element
 */
export function EventTimelineItem({
  event,
  isActive = false,
  onClick
}: EventTimelineItemProps): ReactElement {
  const isUserEvent = event.type === 'user'
  const isSubAgent = event.type === 'sub_agent'

  // Format display values
  const tokenDisplay = event.tokenCount != null ? formatTokenCount(event.tokenCount) : null
  const timeDisplay = formatMessageTimestamp(event.timestamp)

  // Display text - for sub-agents show type + short ID
  const displayText =
    isSubAgent && event.agentType && event.agentId
      ? `${event.agentType}-${event.agentId}`
      : event.summary

  return (
    <button
      type="button"
      onClick={onClick}
      data-event-uuid={event.uuid}
      className={cn(
        'w-full flex items-start gap-1 p-2 rounded-md transition-colors',
        'text-left text-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        // Alignment based on event type
        isUserEvent ? 'flex-row-reverse' : 'flex-row',
        // Background colors
        isUserEvent && 'bg-purple-500/20 hover:bg-purple-500/30',
        !isUserEvent && !isSubAgent && 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]',
        isSubAgent && 'bg-purple-500/10 hover:bg-purple-500/20',
        // Active state
        isActive && 'ring-2 ring-[var(--accent)]'
      )}
      aria-label={`Go to ${event.type} event: ${event.summary}`}
    >
      {/* Content - text-only per UX9 spec */}
      <div className={cn('flex-1 min-w-0', isUserEvent && 'text-right')}>
        {/* Summary - truncated to one line */}
        <div className={cn('truncate text-[var(--text-primary)]', isUserEvent && 'text-right')}>
          {displayText}
        </div>

        {/* Token count and timestamp row */}
        <div
          className={cn(
            'flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5',
            isUserEvent ? 'justify-end' : 'justify-start'
          )}
        >
          {tokenDisplay && <span>{tokenDisplay}</span>}
          <span>{timeDisplay}</span>
        </div>
      </div>
    </button>
  )
}

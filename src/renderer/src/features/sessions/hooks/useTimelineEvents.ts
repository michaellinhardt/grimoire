import { useMemo } from 'react'
import type { ConversationMessage, TimelineEvent } from '../components/types'
import { convertToTimelineEvents } from '../components/utils/timelineUtils'

/**
 * Hook that converts conversation messages to timeline events.
 * Memoizes the conversion to prevent unnecessary recalculation.
 *
 * @param messages - Array of conversation messages
 * @returns Memoized array of timeline events
 */
export function useTimelineEvents(messages: ConversationMessage[]): TimelineEvent[] {
  return useMemo(() => convertToTimelineEvents(messages), [messages])
}

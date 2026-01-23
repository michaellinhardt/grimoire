import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTimelineEvents } from './useTimelineEvents'
import type { ConversationMessage } from '../components/types'

describe('useTimelineEvents', () => {
  const mockMessages: ConversationMessage[] = [
    {
      uuid: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: 1737640000000
    },
    {
      uuid: 'msg-2',
      role: 'assistant',
      content: 'Hi there!',
      timestamp: 1737640060000
    }
  ]

  it('returns empty array for empty messages', () => {
    const { result } = renderHook(() => useTimelineEvents([]))

    expect(result.current).toEqual([])
  })

  it('converts messages to timeline events', () => {
    const { result } = renderHook(() => useTimelineEvents(mockMessages))

    expect(result.current).toHaveLength(2)
    expect(result.current[0].type).toBe('user')
    expect(result.current[1].type).toBe('assistant')
  })

  it('memoizes result when messages unchanged', () => {
    const { result, rerender } = renderHook(({ messages }) => useTimelineEvents(messages), {
      initialProps: { messages: mockMessages }
    })

    const firstResult = result.current

    // Rerender with same messages reference
    rerender({ messages: mockMessages })

    // Should be same reference (memoized)
    expect(result.current).toBe(firstResult)
  })

  it('recalculates when messages array changes', () => {
    const { result, rerender } = renderHook(({ messages }) => useTimelineEvents(messages), {
      initialProps: { messages: mockMessages }
    })

    const firstResult = result.current

    // Rerender with new messages array
    const newMessages: ConversationMessage[] = [
      ...mockMessages,
      {
        uuid: 'msg-3',
        role: 'user',
        content: 'New message',
        timestamp: 1737640120000
      }
    ]
    rerender({ messages: newMessages })

    // Should be different reference
    expect(result.current).not.toBe(firstResult)
    expect(result.current).toHaveLength(3)
  })
})

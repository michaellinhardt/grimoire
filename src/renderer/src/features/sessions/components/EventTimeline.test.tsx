import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventTimeline } from './EventTimeline'
import { MOCK_TIMELINE_EVENTS } from './types'
import type { TimelineEvent } from './types'

describe('EventTimeline', () => {
  // Fixed timestamp for reproducible tests
  const FIXED_NOW = 1737640400000 // A bit after the mock events

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Rendering', () => {
    it('renders list of EventTimelineItems', () => {
      const handleClick = vi.fn()
      render(<EventTimeline events={MOCK_TIMELINE_EVENTS} onEventClick={handleClick} />)

      // Should render all 5 mock events
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(MOCK_TIMELINE_EVENTS.length)
    })

    it('shows empty state when no events', () => {
      const handleClick = vi.fn()
      render(<EventTimeline events={[]} onEventClick={handleClick} />)

      expect(screen.getByText('Events will appear as conversation progresses.')).toBeInTheDocument()
    })

    it('renders events in order', () => {
      const handleClick = vi.fn()
      render(<EventTimeline events={MOCK_TIMELINE_EVENTS} onEventClick={handleClick} />)

      const buttons = screen.getAllByRole('button')
      // First event should be the user event
      expect(buttons[0]).toHaveAttribute('aria-label', expect.stringContaining('user event'))
    })
  })

  describe('Event click handling', () => {
    it('calls onEventClick with correct uuid for regular events', () => {
      const handleClick = vi.fn()
      render(<EventTimeline events={MOCK_TIMELINE_EVENTS} onEventClick={handleClick} />)

      // Click the first event (user event)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])

      expect(handleClick).toHaveBeenCalledWith('evt-001')
    })

    it('calls onSubAgentClick for sub-agent events when provided', () => {
      const handleClick = vi.fn()
      const handleSubAgentClick = vi.fn()
      render(
        <EventTimeline
          events={MOCK_TIMELINE_EVENTS}
          onEventClick={handleClick}
          onSubAgentClick={handleSubAgentClick}
        />
      )

      // Click the sub-agent event (4th event, index 3)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[3]) // sub_agent event

      expect(handleSubAgentClick).toHaveBeenCalledWith(MOCK_TIMELINE_EVENTS[3])
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('falls back to onEventClick for sub-agent events when onSubAgentClick not provided', () => {
      const handleClick = vi.fn()
      render(<EventTimeline events={MOCK_TIMELINE_EVENTS} onEventClick={handleClick} />)

      // Click the sub-agent event (4th event, index 3)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[3])

      expect(handleClick).toHaveBeenCalledWith('evt-004')
    })
  })

  describe('Active event highlighting', () => {
    it('highlights active event', () => {
      const handleClick = vi.fn()
      render(
        <EventTimeline
          events={MOCK_TIMELINE_EVENTS}
          onEventClick={handleClick}
          activeEventUuid="evt-002"
        />
      )

      // Second event should have active styling
      const buttons = screen.getAllByRole('button')
      expect(buttons[1]).toHaveClass('ring-2')
    })

    it('does not highlight non-active events', () => {
      const handleClick = vi.fn()
      render(
        <EventTimeline
          events={MOCK_TIMELINE_EVENTS}
          onEventClick={handleClick}
          activeEventUuid="evt-002"
        />
      )

      // First event should not have active styling
      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).not.toHaveClass('ring-2')
    })
  })

  describe('Event type rendering', () => {
    it('renders user events with right alignment', () => {
      const userEvents: TimelineEvent[] = [
        {
          uuid: 'user-1',
          type: 'user',
          summary: 'User message',
          timestamp: FIXED_NOW - 60000,
          tokenCount: 100
        }
      ]
      const handleClick = vi.fn()
      render(<EventTimeline events={userEvents} onEventClick={handleClick} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex-row-reverse')
    })

    it('renders assistant events with left alignment', () => {
      const assistantEvents: TimelineEvent[] = [
        {
          uuid: 'assistant-1',
          type: 'assistant',
          summary: 'Assistant response',
          timestamp: FIXED_NOW - 60000,
          tokenCount: 200
        }
      ]
      const handleClick = vi.fn()
      render(<EventTimeline events={assistantEvents} onEventClick={handleClick} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex-row')
    })

    it('renders tool events with elevated background', () => {
      const toolEvents: TimelineEvent[] = [
        {
          uuid: 'tool-1',
          type: 'tool',
          summary: 'Read file.ts',
          timestamp: FIXED_NOW - 60000,
          tokenCount: 50
        }
      ]
      const handleClick = vi.fn()
      render(<EventTimeline events={toolEvents} onEventClick={handleClick} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-[var(--bg-elevated)]')
    })

    it('renders sub-agent events with purple tint', () => {
      const subAgentEvents: TimelineEvent[] = [
        {
          uuid: 'subagent-1',
          type: 'sub_agent',
          summary: 'Explore-a1b2',
          timestamp: FIXED_NOW - 60000,
          tokenCount: 500,
          agentType: 'Explore',
          agentId: 'a1b2'
        }
      ]
      const handleClick = vi.fn()
      render(<EventTimeline events={subAgentEvents} onEventClick={handleClick} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-purple-500/10')
    })
  })

  describe('Scrollable container', () => {
    it('renders with ScrollArea for many events', () => {
      const manyEvents: TimelineEvent[] = Array.from({ length: 20 }, (_, i) => ({
        uuid: `evt-${i}`,
        type: i % 2 === 0 ? 'user' : 'assistant',
        summary: `Message ${i}`,
        timestamp: FIXED_NOW - i * 60000,
        tokenCount: 100 + i * 10
      }))
      const handleClick = vi.fn()
      render(<EventTimeline events={manyEvents} onEventClick={handleClick} />)

      // All events should be rendered
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(20)
    })
  })
})

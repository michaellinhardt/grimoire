import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventTimelineItem } from './EventTimelineItem'
import type { TimelineEvent } from './types'

describe('EventTimelineItem', () => {
  // Fixed timestamp for reproducible tests: 2026-01-23T11:06:40Z
  const FIXED_NOW = 1737640000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const userEvent: TimelineEvent = {
    uuid: 'evt-user-001',
    type: 'user',
    summary: 'Can you analyze the authentication code?',
    timestamp: FIXED_NOW - 1000 * 60 * 5, // 5 minutes ago
    tokenCount: 1200
  }

  const assistantEvent: TimelineEvent = {
    uuid: 'evt-assistant-001',
    type: 'assistant',
    summary: "I'll examine the auth module thoroughly...",
    timestamp: FIXED_NOW - 1000 * 60 * 4,
    tokenCount: 3400
  }

  const toolEvent: TimelineEvent = {
    uuid: 'evt-tool-001',
    type: 'tool',
    summary: 'Read src/auth/login.ts',
    timestamp: FIXED_NOW - 1000 * 60 * 3,
    tokenCount: 850
  }

  const subAgentEvent: TimelineEvent = {
    uuid: 'evt-subagent-001',
    type: 'sub_agent',
    summary: 'Explore-a8b2',
    timestamp: FIXED_NOW - 1000 * 60 * 2,
    tokenCount: 5200,
    agentType: 'Explore',
    agentId: 'a8b2'
  }

  describe('User events', () => {
    it('renders user event with right alignment and accent background', () => {
      render(<EventTimelineItem event={userEvent} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex-row-reverse')
      expect(button).toHaveClass('bg-purple-500/20')
    })

    it('displays truncated summary', () => {
      render(<EventTimelineItem event={userEvent} />)

      expect(screen.getByText(userEvent.summary)).toBeInTheDocument()
    })

    it('displays formatted token count', () => {
      render(<EventTimelineItem event={userEvent} />)

      expect(screen.getByText('1.2k')).toBeInTheDocument()
    })

    it('displays timestamp', () => {
      render(<EventTimelineItem event={userEvent} />)

      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })
  })

  describe('Assistant events', () => {
    it('renders assistant event with left alignment and elevated background', () => {
      render(<EventTimelineItem event={assistantEvent} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex-row')
      expect(button).toHaveClass('bg-[var(--bg-elevated)]')
    })

    it('displays formatted token count', () => {
      render(<EventTimelineItem event={assistantEvent} />)

      expect(screen.getByText('3.4k')).toBeInTheDocument()
    })
  })

  describe('Tool events', () => {
    it('renders tool event with left alignment', () => {
      render(<EventTimelineItem event={toolEvent} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex-row')
    })

    it('displays tool summary', () => {
      render(<EventTimelineItem event={toolEvent} />)

      expect(screen.getByText('Read src/auth/login.ts')).toBeInTheDocument()
    })
  })

  describe('Sub-agent events', () => {
    it('renders sub-agent event with purple tint background', () => {
      render(<EventTimelineItem event={subAgentEvent} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-purple-500/10')
    })

    it('displays agent type and short ID', () => {
      render(<EventTimelineItem event={subAgentEvent} />)

      expect(screen.getByText('Explore-a8b2')).toBeInTheDocument()
    })

    it('displays formatted token count for sub-agent', () => {
      render(<EventTimelineItem event={subAgentEvent} />)

      expect(screen.getByText('5.2k')).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<EventTimelineItem event={userEvent} onClick={handleClick} />)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('has accessible label', () => {
      render(<EventTimelineItem event={userEvent} />)

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        `Go to user event: ${userEvent.summary}`
      )
    })
  })

  describe('Active state', () => {
    it('renders with ring when active', () => {
      render(<EventTimelineItem event={userEvent} isActive={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('ring-2')
      expect(button).toHaveClass('ring-[var(--accent)]')
    })

    it('does not have ring when not active', () => {
      render(<EventTimelineItem event={userEvent} isActive={false} />)

      const button = screen.getByRole('button')
      expect(button).not.toHaveClass('ring-2')
    })
  })

  describe('Optional token count', () => {
    it('does not render token count when not provided', () => {
      const eventWithoutTokens: TimelineEvent = {
        uuid: 'evt-no-tokens',
        type: 'user',
        summary: 'Test message',
        timestamp: FIXED_NOW
      }

      render(<EventTimelineItem event={eventWithoutTokens} />)

      // Should not find any token count elements (k suffix)
      expect(screen.queryByText(/k$/)).not.toBeInTheDocument()
    })
  })
})

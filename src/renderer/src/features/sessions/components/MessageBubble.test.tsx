import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders user message content', () => {
    render(
      <MessageBubble role="user" content="Hello, Claude!" timestamp={Date.now() - 1000 * 60 * 2} />
    )
    expect(screen.getByText('Hello, Claude!')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    render(
      <MessageBubble
        role="assistant"
        content="Hello! How can I help you?"
        timestamp={Date.now() - 1000 * 60}
      />
    )
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument()
  })

  it('shows timestamp for user message', () => {
    render(<MessageBubble role="user" content="Test" timestamp={Date.now() - 1000 * 60 * 5} />)
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('applies right alignment for user messages', () => {
    const { container } = render(
      <MessageBubble role="user" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('ml-auto')
    expect(bubble.className).toContain('rounded-br-sm')
  })

  it('applies left alignment for assistant messages', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('mr-auto')
    expect(bubble.className).toContain('rounded-bl-sm')
  })

  it('has accessible aria-label for user messages', () => {
    render(<MessageBubble role="user" content="Test" timestamp={Date.now()} />)
    expect(screen.getByLabelText('User message')).toBeInTheDocument()
  })

  it('has accessible aria-label for assistant messages', () => {
    render(<MessageBubble role="assistant" content="Test" timestamp={Date.now()} />)
    expect(screen.getByLabelText('Assistant message')).toBeInTheDocument()
  })

  it('applies accent styling for user messages', () => {
    const { container } = render(
      <MessageBubble role="user" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('bg-[var(--accent-muted)]')
    expect(bubble.className).toContain('border-[var(--accent)]')
  })

  it('applies elevated styling for assistant messages', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Test" timestamp={Date.now()} />
    )
    const bubble = container.firstChild as HTMLElement
    expect(bubble.className).toContain('bg-[var(--bg-elevated)]')
    expect(bubble.className).toContain('border-[var(--border)]')
  })

  it('preserves whitespace in content', () => {
    const multilineContent = 'Line 1\nLine 2\nLine 3'
    render(<MessageBubble role="assistant" content={multilineContent} timestamp={Date.now()} />)
    const contentElement = screen.getByText(/Line 1/)
    expect(contentElement.className).toContain('whitespace-pre-wrap')
  })

  it('aligns timestamp right for user messages', () => {
    const { container } = render(
      <MessageBubble role="user" content="Test" timestamp={Date.now()} />
    )
    const timestamp = container.querySelector('span')
    expect(timestamp?.className).toContain('text-right')
  })

  it('does not align timestamp right for assistant messages', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Test" timestamp={Date.now()} />
    )
    const timestamp = container.querySelector('span')
    expect(timestamp?.className).not.toContain('text-right')
  })

  it('handles long content with word breaks', () => {
    const longContent = 'ThisIsAVeryLongWordThatShouldBreakProperlyWithoutOverflowingTheContainer'
    const { container } = render(
      <MessageBubble role="user" content={longContent} timestamp={Date.now()} />
    )
    const contentElement = container.querySelector('p')
    expect(contentElement?.className).toContain('break-words')
  })

  describe('rewind icon (Story 2b.5)', () => {
    it('shows rewind icon on hover for user messages (not first)', () => {
      const onRewind = vi.fn()
      const { container } = render(
        <MessageBubble
          role="user"
          content="Test message"
          timestamp={Date.now()}
          messageIndex={1}
          onRewind={onRewind}
        />
      )

      // Icon should exist but be hidden initially (opacity-0)
      const button = screen.getByLabelText('Rewind conversation from this message')
      expect(button).toBeInTheDocument()
      expect(button.className).toContain('opacity-0')
      expect(button.className).toContain('group-hover:opacity-100')

      // Container should have group class for hover detection
      const bubble = container.firstChild as HTMLElement
      expect(bubble.className).toContain('group')
      expect(bubble.className).toContain('relative')
    })

    it('does not show rewind icon for first user message (messageIndex=0)', () => {
      const onRewind = vi.fn()
      render(
        <MessageBubble
          role="user"
          content="First message"
          timestamp={Date.now()}
          messageIndex={0}
          onRewind={onRewind}
        />
      )

      expect(
        screen.queryByLabelText('Rewind conversation from this message')
      ).not.toBeInTheDocument()
    })

    it('does not show rewind icon for assistant messages', () => {
      const onRewind = vi.fn()
      render(
        <MessageBubble
          role="assistant"
          content="Assistant message"
          timestamp={Date.now()}
          messageIndex={1}
          onRewind={onRewind}
        />
      )

      expect(
        screen.queryByLabelText('Rewind conversation from this message')
      ).not.toBeInTheDocument()
    })

    it('does not show rewind icon when onRewind is undefined', () => {
      render(
        <MessageBubble
          role="user"
          content="Test message"
          timestamp={Date.now()}
          messageIndex={1}
          // onRewind intentionally omitted
        />
      )

      expect(
        screen.queryByLabelText('Rewind conversation from this message')
      ).not.toBeInTheDocument()
    })

    it('does not show rewind icon when messageIndex is undefined', () => {
      const onRewind = vi.fn()
      render(
        <MessageBubble
          role="user"
          content="Test message"
          timestamp={Date.now()}
          // messageIndex intentionally omitted
          onRewind={onRewind}
        />
      )

      expect(
        screen.queryByLabelText('Rewind conversation from this message')
      ).not.toBeInTheDocument()
    })

    it('calls onRewind callback when icon is clicked', () => {
      const onRewind = vi.fn()
      render(
        <MessageBubble
          role="user"
          content="Test message"
          timestamp={Date.now()}
          messageIndex={2}
          onRewind={onRewind}
        />
      )

      const button = screen.getByLabelText('Rewind conversation from this message')
      fireEvent.click(button)

      expect(onRewind).toHaveBeenCalledTimes(1)
    })

    it('stops click propagation when rewind icon is clicked', () => {
      const onRewind = vi.fn()
      const onParentClick = vi.fn()

      render(
        <div onClick={onParentClick}>
          <MessageBubble
            role="user"
            content="Test message"
            timestamp={Date.now()}
            messageIndex={1}
            onRewind={onRewind}
          />
        </div>
      )

      const button = screen.getByLabelText('Rewind conversation from this message')
      fireEvent.click(button)

      expect(onRewind).toHaveBeenCalledTimes(1)
      expect(onParentClick).not.toHaveBeenCalled()
    })

    it('icon has correct aria-label', () => {
      const onRewind = vi.fn()
      render(
        <MessageBubble
          role="user"
          content="Test message"
          timestamp={Date.now()}
          messageIndex={1}
          onRewind={onRewind}
        />
      )

      expect(screen.getByLabelText('Rewind conversation from this message')).toBeInTheDocument()
    })

    it('maintains existing styling when rewind props are added', () => {
      const { container } = render(
        <MessageBubble
          role="user"
          content="Test"
          timestamp={Date.now()}
          messageIndex={1}
          onRewind={vi.fn()}
        />
      )

      const bubble = container.firstChild as HTMLElement
      // Original styles should still be present
      expect(bubble.className).toContain('max-w-[80%]')
      expect(bubble.className).toContain('ml-auto')
      expect(bubble.className).toContain('rounded-br-sm')
      expect(bubble.className).toContain('bg-[var(--accent-muted)]')
    })
  })
})

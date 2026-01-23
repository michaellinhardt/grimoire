import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamingMessageBubble } from './StreamingMessageBubble'

describe('StreamingMessageBubble', () => {
  it('renders content when streaming', () => {
    render(<StreamingMessageBubble content="Hello world" isStreaming={true} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('shows cursor when streaming is active', () => {
    const { container } = render(<StreamingMessageBubble content="Test" isStreaming={true} />)
    const cursor = container.querySelector('.animate-cursor-blink')
    expect(cursor).toBeInTheDocument()
  })

  it('hides cursor when streaming is complete', () => {
    const { container } = render(<StreamingMessageBubble content="Test" isStreaming={false} />)
    const cursor = container.querySelector('.animate-cursor-blink')
    expect(cursor).not.toBeInTheDocument()
  })

  it('handles empty content gracefully', () => {
    const { container } = render(<StreamingMessageBubble content="" isStreaming={true} />)
    // Should still render the bubble container with min-height
    const bubble = container.querySelector('.min-h-\\[40px\\]')
    expect(bubble).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(<StreamingMessageBubble content="Styled" isStreaming={true} />)
    const bubble = container.querySelector('.rounded-\\[var\\(--radius-sm\\)\\]')
    expect(bubble).toBeInTheDocument()
  })

  it('cursor has aria-hidden for accessibility', () => {
    const { container } = render(<StreamingMessageBubble content="Test" isStreaming={true} />)
    const cursor = container.querySelector('[aria-hidden="true"]')
    expect(cursor).toBeInTheDocument()
  })
})

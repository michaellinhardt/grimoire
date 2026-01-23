import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NewSessionView } from './NewSessionView'

describe('NewSessionView', () => {
  it('renders empty state message', () => {
    render(<NewSessionView />)
    expect(screen.getByText('New session - start typing to begin')).toBeInTheDocument()
  })

  it('renders ChatInput with auto-focus', () => {
    render(<NewSessionView />)

    const textarea = screen.getByRole('textbox', { name: /message input/i })
    expect(textarea).toBeInTheDocument()
    expect(document.activeElement).toBe(textarea)
  })

  it('renders new session placeholder text', () => {
    render(<NewSessionView />)

    // Note: placeholder is 'Type your message...' for new sessions per AC5
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('renders send button', () => {
    render(<NewSessionView />)

    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('has proper layout structure', () => {
    const { container } = render(<NewSessionView />)
    // Check for flex column layout
    const mainContainer = container.querySelector('.flex-1.flex.flex-col')
    expect(mainContainer).toBeInTheDocument()
    // Check for conversation area
    const conversationArea = container.querySelector('.flex-1.flex.items-center.justify-center')
    expect(conversationArea).toBeInTheDocument()
  })

  it('does not disable ChatInput for new sessions', () => {
    render(<NewSessionView />)

    const textarea = screen.getByRole('textbox', { name: /message input/i })
    expect(textarea).not.toBeDisabled()
  })
})

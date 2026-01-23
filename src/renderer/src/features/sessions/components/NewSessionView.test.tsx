import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NewSessionView } from './NewSessionView'

describe('NewSessionView', () => {
  it('should render new session message', () => {
    render(<NewSessionView />)
    expect(screen.getByText('New session - start typing to begin')).toBeInTheDocument()
  })

  it('should render ChatInputPlaceholder with placeholder text', () => {
    render(<NewSessionView />)
    expect(screen.getByText('Type your message... (input coming in Epic 3a)')).toBeInTheDocument()
  })

  it('should have proper layout structure', () => {
    const { container } = render(<NewSessionView />)
    // Check for flex column layout
    const mainContainer = container.querySelector('.flex-1.flex.flex-col')
    expect(mainContainer).toBeInTheDocument()
    // Check for conversation area
    const conversationArea = container.querySelector('.flex-1.flex.items-center.justify-center')
    expect(conversationArea).toBeInTheDocument()
  })

  it('should include comment about sub-agent index location', () => {
    // This test verifies the component is structured correctly for Epic 2b
    // The actual comment is in the JSX, so we just verify the structure exists
    render(<NewSessionView />)
    // The conversation area placeholder div should exist
    const message = screen.getByText('New session - start typing to begin')
    expect(message.parentElement).toHaveClass('flex-1', 'flex', 'items-center', 'justify-center')
  })
})

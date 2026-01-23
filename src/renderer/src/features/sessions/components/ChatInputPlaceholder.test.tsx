import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChatInputPlaceholder } from './ChatInputPlaceholder'

describe('ChatInputPlaceholder', () => {
  it('should render with default placeholder text', () => {
    render(<ChatInputPlaceholder />)
    expect(screen.getByText('Type your message... (input coming in Epic 3a)')).toBeInTheDocument()
  })

  it('should render with custom placeholder text', () => {
    render(<ChatInputPlaceholder placeholder="Custom placeholder" />)
    expect(screen.getByText('Custom placeholder (input coming in Epic 3a)')).toBeInTheDocument()
  })

  it('should accept autoFocus prop without error', () => {
    // autoFocus is intentionally unused in the placeholder, but should be accepted
    expect(() => render(<ChatInputPlaceholder autoFocus />)).not.toThrow()
    expect(() => render(<ChatInputPlaceholder autoFocus={false} />)).not.toThrow()
  })

  it('should render proper container structure', () => {
    render(<ChatInputPlaceholder />)
    // Check the structure: outer div with border, inner div with background
    const textElement = screen.getByText('Type your message... (input coming in Epic 3a)')
    expect(textElement).toBeInTheDocument()
    // The parent should be the inner container with bg-hover
    expect(textElement.parentElement).toHaveClass('flex-1', 'h-8')
  })
})

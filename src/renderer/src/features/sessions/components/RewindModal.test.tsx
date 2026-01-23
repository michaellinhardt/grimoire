import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RewindModal } from './RewindModal'

describe('RewindModal (Story 2b.5)', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onRewind: vi.fn().mockResolvedValue(undefined)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct title', () => {
    render(<RewindModal {...defaultProps} />)
    expect(screen.getByText('Rewind Conversation')).toBeInTheDocument()
  })

  it('opens with textarea focused', () => {
    render(<RewindModal {...defaultProps} />)
    const textarea = screen.getByLabelText('New message')
    expect(textarea).toHaveFocus()
  })

  it('shows placeholder text in textarea', () => {
    render(<RewindModal {...defaultProps} />)
    expect(screen.getByPlaceholderText('Enter new message...')).toBeInTheDocument()
  })

  it('renders overlay with close modal label', () => {
    render(<RewindModal {...defaultProps} />)

    // Verify overlay is present (Radix handles the close-on-click behavior)
    const overlay = screen.getByLabelText('Close modal')
    expect(overlay).toBeInTheDocument()
    expect(overlay.className).toContain('bg-black/50')
  })

  it('calls onOpenChange with false when Escape is pressed', async () => {
    const onOpenChange = vi.fn()
    render(<RewindModal {...defaultProps} onOpenChange={onOpenChange} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange with false when Cancel is clicked', async () => {
    const onOpenChange = vi.fn()
    render(<RewindModal {...defaultProps} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange with false when X button is clicked', async () => {
    const onOpenChange = vi.fn()
    render(<RewindModal {...defaultProps} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByLabelText('Close'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables Send button when textarea is empty', () => {
    render(<RewindModal {...defaultProps} />)
    const sendButton = screen.getByText('Send')
    expect(sendButton).toBeDisabled()
  })

  it('disables Send button when textarea contains only whitespace', async () => {
    const user = userEvent.setup()
    render(<RewindModal {...defaultProps} />)

    const textarea = screen.getByLabelText('New message')
    await user.type(textarea, '   ')

    const sendButton = screen.getByText('Send')
    expect(sendButton).toBeDisabled()
  })

  it('enables Send button when textarea has content', async () => {
    const user = userEvent.setup()
    render(<RewindModal {...defaultProps} />)

    const textarea = screen.getByLabelText('New message')
    await user.type(textarea, 'New message content')

    const sendButton = screen.getByText('Send')
    expect(sendButton).toBeEnabled()
  })

  it('calls onRewind with trimmed message when Send is clicked', async () => {
    const user = userEvent.setup()
    const onRewind = vi.fn().mockResolvedValue(undefined)
    render(<RewindModal {...defaultProps} onRewind={onRewind} />)

    const textarea = screen.getByLabelText('New message')
    await user.type(textarea, '  Test message with spaces  ')

    const sendButton = screen.getByText('Send')
    await user.click(sendButton)

    expect(onRewind).toHaveBeenCalledWith('Test message with spaces')
  })

  it('shows loading state during submission', async () => {
    render(<RewindModal {...defaultProps} isLoading={true} />)

    // Send button should show "Sending..."
    expect(screen.getByText('Sending...')).toBeInTheDocument()

    // Send button should be disabled
    expect(screen.getByText('Sending...')).toBeDisabled()

    // Textarea should be disabled
    expect(screen.getByLabelText('New message')).toBeDisabled()

    // Cancel button should be disabled
    expect(screen.getByText('Cancel')).toBeDisabled()
  })

  it('shows error message when error prop is set', () => {
    render(<RewindModal {...defaultProps} error="Failed to rewind conversation" />)

    const errorMessage = screen.getByRole('alert')
    expect(errorMessage).toHaveTextContent('Failed to rewind conversation')
    expect(errorMessage).toHaveClass('text-red-500')
  })

  it('does not show error message when error is null', () => {
    render(<RewindModal {...defaultProps} error={null} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears textarea when modal reopens with new resetKey', async () => {
    const user = userEvent.setup()

    // Start with modal open
    const { rerender } = render(<RewindModal {...defaultProps} resetKey={1} />)

    // Type something in the textarea
    const textarea = screen.getByLabelText('New message')
    await user.type(textarea, 'Some text')
    expect(textarea).toHaveValue('Some text')

    // Close modal
    rerender(<RewindModal {...defaultProps} open={false} resetKey={1} />)

    // Verify modal is closed
    expect(screen.queryByText('Rewind Conversation')).not.toBeInTheDocument()

    // Reopen modal with new resetKey (simulates parent incrementing key on open)
    rerender(<RewindModal {...defaultProps} open={true} resetKey={2} />)

    // Textarea should be cleared because resetKey changed
    await waitFor(() => {
      expect(screen.getByLabelText('New message')).toHaveValue('')
    })
  })

  it('does not call onRewind when Send is clicked during loading', async () => {
    const user = userEvent.setup()
    const onRewind = vi.fn()
    render(<RewindModal {...defaultProps} onRewind={onRewind} isLoading={true} />)

    // Even if somehow there was text, clicking should not trigger onRewind
    const sendButton = screen.getByText('Sending...')
    await user.click(sendButton)

    expect(onRewind).not.toHaveBeenCalled()
  })

  it('does not render when open is false', () => {
    render(<RewindModal {...defaultProps} open={false} />)
    expect(screen.queryByText('Rewind Conversation')).not.toBeInTheDocument()
  })

  it('has accessible description for screen readers', () => {
    render(<RewindModal {...defaultProps} />)
    // The sr-only description should be present
    expect(
      screen.getByText(
        'Enter a new message to start an alternate conversation path from this point.'
      )
    ).toBeInTheDocument()
  })

  it('supports keyboard navigation with Tab', async () => {
    const user = userEvent.setup()
    // Type some text so Send button is not disabled (disabled buttons may skip in tab order)
    render(<RewindModal {...defaultProps} />)

    // Start with textarea focused
    expect(screen.getByLabelText('New message')).toHaveFocus()

    // Type text to enable Send button
    await user.type(screen.getByLabelText('New message'), 'Test')

    // Tab to Cancel button
    await user.tab()
    expect(screen.getByText('Cancel')).toHaveFocus()

    // Tab to Send button (now enabled)
    await user.tab()
    expect(screen.getByText('Send')).toHaveFocus()

    // Tab to X close button
    await user.tab()
    expect(screen.getByLabelText('Close')).toHaveFocus()
  })

  it('allows newlines in textarea (Enter does not submit)', async () => {
    const user = userEvent.setup()
    const onRewind = vi.fn()
    render(<RewindModal {...defaultProps} onRewind={onRewind} />)

    const textarea = screen.getByLabelText('New message')
    await user.type(textarea, 'Line 1{enter}Line 2')

    // Should have newline in content
    expect(textarea).toHaveValue('Line 1\nLine 2')

    // Should NOT have called onRewind
    expect(onRewind).not.toHaveBeenCalled()
  })
})

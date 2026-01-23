import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  const mockOnSend = vi.fn()

  beforeEach(() => {
    mockOnSend.mockClear()
  })

  describe('rendering', () => {
    it('renders textarea and send button', () => {
      render(<ChatInput onSend={mockOnSend} />)

      expect(screen.getByRole('textbox', { name: /message input/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('renders default placeholder when hasMessages is false', () => {
      render(<ChatInput onSend={mockOnSend} hasMessages={false} />)

      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
    })

    it('renders continue placeholder when hasMessages is true', () => {
      render(<ChatInput onSend={mockOnSend} hasMessages={true} />)

      expect(screen.getByPlaceholderText('Type anything to continue...')).toBeInTheDocument()
    })

    it('renders custom placeholder when provided', () => {
      render(<ChatInput onSend={mockOnSend} placeholder="Custom text" />)

      expect(screen.getByPlaceholderText('Custom text')).toBeInTheDocument()
    })
  })

  describe('input behavior', () => {
    it('updates value on input change', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello world')

      expect(textarea).toHaveValue('Hello world')
    })

    it('disables send button when input is empty', () => {
      render(<ChatInput onSend={mockOnSend} />)

      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeDisabled()
    })

    it('disables send button when input is whitespace only', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '   ')

      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeDisabled()
    })

    it('enables send button when input has content', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello')

      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeEnabled()
    })

    it('adjusts height when text is entered (auto-expand)', () => {
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

      // Mock scrollHeight to simulate multi-line content
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        get: () => 100
      })

      // Trigger change to invoke adjustHeight
      fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } })

      // Height should be set based on scrollHeight (capped at 200px max)
      expect(textarea.style.height).toBe('100px')
    })

    it('caps auto-expand height at max-height (200px)', () => {
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

      // Mock scrollHeight exceeding max
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        get: () => 300
      })

      // Trigger change to invoke adjustHeight
      fireEvent.change(textarea, { target: { value: 'Many\nlines\nof\ntext' } })

      // Height should be capped at 200px
      expect(textarea.style.height).toBe('200px')
    })

    it('resets height after sending message', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

      // Mock scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        get: () => 100
      })

      await user.type(textarea, 'Hello')
      await user.keyboard('{Enter}')

      // Height should reset to auto after clearing
      expect(textarea.style.height).toBe('auto')
    })
  })

  describe('send behavior', () => {
    it('calls onSend with trimmed message when Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '  Hello world  ')
      await user.keyboard('{Enter}')

      expect(mockOnSend).toHaveBeenCalledWith('Hello world')
      expect(textarea).toHaveValue('')
    })

    it('calls onSend when send button is clicked', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello')

      const button = screen.getByRole('button', { name: /send message/i })
      await user.click(button)

      expect(mockOnSend).toHaveBeenCalledWith('Hello')
      expect(textarea).toHaveValue('')
    })

    it('does not call onSend when Enter is pressed with empty input', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.click(textarea)
      await user.keyboard('{Enter}')

      expect(mockOnSend).not.toHaveBeenCalled()
    })

    it('inserts newline on Shift+Enter', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Line 1')
      await user.keyboard('{Shift>}{Enter}{/Shift}')
      await user.type(textarea, 'Line 2')

      expect(textarea).toHaveValue('Line 1\nLine 2')
      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('disables textarea when disabled prop is true', () => {
      render(<ChatInput onSend={mockOnSend} disabled />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })

    it('disables send button when disabled prop is true', () => {
      render(<ChatInput onSend={mockOnSend} disabled />)

      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeDisabled()
    })

    it('does not call onSend when disabled', () => {
      // Start with enabled, type, then render disabled
      const { rerender } = render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Hello' } })

      rerender(<ChatInput onSend={mockOnSend} disabled />)

      const button = screen.getByRole('button', { name: /send message/i })
      fireEvent.click(button)

      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  describe('auto-focus behavior', () => {
    it('focuses textarea on mount when autoFocus is true', () => {
      render(<ChatInput onSend={mockOnSend} autoFocus />)

      const textarea = screen.getByRole('textbox')
      expect(document.activeElement).toBe(textarea)
    })

    it('does not focus textarea on mount when autoFocus is false', () => {
      render(<ChatInput onSend={mockOnSend} autoFocus={false} />)

      const textarea = screen.getByRole('textbox')
      expect(document.activeElement).not.toBe(textarea)
    })

    it('does not focus textarea on mount by default', () => {
      render(<ChatInput onSend={mockOnSend} />)

      const textarea = screen.getByRole('textbox')
      expect(document.activeElement).not.toBe(textarea)
    })
  })

  // Story 3a-4: Abort button tests
  describe('abort button', () => {
    it('shows abort button when isWorking is true', () => {
      render(<ChatInput onSend={mockOnSend} onAbort={vi.fn()} isWorking={true} />)
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument()
    })

    it('shows send button when isWorking is false', () => {
      render(<ChatInput onSend={mockOnSend} onAbort={vi.fn()} isWorking={false} />)
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('calls onAbort when abort button clicked', () => {
      const handleAbort = vi.fn()
      render(<ChatInput onSend={mockOnSend} onAbort={handleAbort} isWorking={true} />)

      fireEvent.click(screen.getByRole('button', { name: /stop generation/i }))

      expect(handleAbort).toHaveBeenCalledTimes(1)
    })

    it('shows spinner when isAborting is true', () => {
      const { container } = render(
        <ChatInput onSend={mockOnSend} onAbort={vi.fn()} isWorking={true} isAborting={true} />
      )
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('disables abort button when isAborting is true', () => {
      render(<ChatInput onSend={mockOnSend} onAbort={vi.fn()} isWorking={true} isAborting={true} />)
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeDisabled()
    })
  })
})

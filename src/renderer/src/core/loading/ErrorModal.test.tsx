import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorModal } from './ErrorModal'

describe('ErrorModal', () => {
  const defaultProps = {
    errorType: 'claude' as const,
    errorMessage: 'Claude not found',
    onRetry: vi.fn(),
    onQuit: vi.fn()
  }

  it('renders error message', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByTestId('error-message')).toHaveTextContent('Claude not found')
  })

  it('shows claude installation instructions for claude error', () => {
    render(<ErrorModal {...defaultProps} errorType="claude" />)
    expect(screen.getByTestId('error-instructions')).toHaveTextContent('not installed')
  })

  it('shows config instructions for config error', () => {
    render(<ErrorModal {...defaultProps} errorType="config" />)
    expect(screen.getByTestId('error-instructions')).toHaveTextContent('configuration directory')
  })

  it('shows auth instructions for auth error', () => {
    render(<ErrorModal {...defaultProps} errorType="auth" />)
    expect(screen.getByTestId('error-instructions')).toHaveTextContent('Authentication required')
  })

  it('calls onRetry when Retry button clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorModal {...defaultProps} onRetry={onRetry} />)
    fireEvent.click(screen.getByTestId('retry-button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onQuit when Quit button clicked', () => {
    const onQuit = vi.fn()
    render(<ErrorModal {...defaultProps} onQuit={onQuit} />)
    fireEvent.click(screen.getByTestId('quit-button'))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })
})

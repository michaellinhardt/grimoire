import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingScreen } from './LoadingScreen'

describe('LoadingScreen', () => {
  const defaultProps = {
    status: 'loading' as const,
    currentStep: 'Initializing...',
    errorMessage: null,
    errorType: null,
    onRetry: vi.fn(),
    onQuit: vi.fn()
  }

  it('renders the Grimoire logo', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.getByTestId('loading-logo')).toHaveTextContent('Grimoire')
  })

  it('renders the current step text', () => {
    render(<LoadingScreen {...defaultProps} currentStep="Checking Claude Code..." />)
    expect(screen.getByTestId('loading-step')).toHaveTextContent('Checking Claude Code...')
  })

  it('applies pulse animation to logo', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.getByTestId('loading-logo')).toHaveClass('loading-logo-pulse')
  })

  it('shows ErrorModal when status is error', () => {
    render(
      <LoadingScreen
        {...defaultProps}
        status="error"
        errorMessage="Claude not found"
        errorType="claude"
      />
    )
    expect(screen.getByTestId('error-modal')).toBeInTheDocument()
  })

  it('does not show ErrorModal when status is loading', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument()
  })

  it('applies fade-out class when fadeOut is true', () => {
    render(<LoadingScreen {...defaultProps} fadeOut={true} />)
    expect(screen.getByTestId('loading-screen')).toHaveClass('loading-screen-fade-out')
  })

  it('does not apply fade-out class by default', () => {
    render(<LoadingScreen {...defaultProps} />)
    expect(screen.getByTestId('loading-screen')).not.toHaveClass('loading-screen-fade-out')
  })

  it('shows ErrorModal with default errorType when errorType is null', () => {
    render(
      <LoadingScreen
        {...defaultProps}
        status="error"
        errorMessage="Network error"
        errorType={null}
      />
    )
    expect(screen.getByTestId('error-modal')).toBeInTheDocument()
    // Falls back to 'claude' error type instructions
    expect(screen.getByTestId('error-instructions')).toHaveTextContent('not installed')
  })
})

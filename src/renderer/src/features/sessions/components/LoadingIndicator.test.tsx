import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingIndicator } from './LoadingIndicator'

describe('LoadingIndicator', () => {
  describe('Rendering', () => {
    it('renders "Loading Claude Code..." text', () => {
      render(<LoadingIndicator />)

      expect(screen.getByText('Loading Claude Code...')).toBeInTheDocument()
    })

    it('has fade-pulse animation class', () => {
      const { container } = render(<LoadingIndicator />)

      const indicator = container.querySelector('.loading-indicator')
      expect(indicator).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has role="status"', () => {
      render(<LoadingIndicator />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('has appropriate aria-label', () => {
      render(<LoadingIndicator />)

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading Claude Code')
    })
  })

  describe('Styling', () => {
    it('is left-aligned', () => {
      const { container } = render(<LoadingIndicator />)

      const indicator = container.querySelector('.loading-indicator')
      expect(indicator).toHaveClass('flex')
      expect(indicator).not.toHaveClass('flex-row-reverse')
    })

    it('has elevated background', () => {
      const { container } = render(<LoadingIndicator />)

      const indicator = container.querySelector('.loading-indicator')
      expect(indicator).toHaveClass('bg-[var(--bg-elevated)]')
    })

    it('accepts additional className', () => {
      const { container } = render(<LoadingIndicator className="custom-class" />)

      const indicator = container.querySelector('.loading-indicator')
      expect(indicator).toHaveClass('custom-class')
    })

    it('has max-w-fit for natural width', () => {
      const { container } = render(<LoadingIndicator />)

      const indicator = container.querySelector('.loading-indicator')
      expect(indicator).toHaveClass('max-w-fit')
    })

    it('has rounded corners', () => {
      const { container } = render(<LoadingIndicator />)

      const indicator = container.querySelector('.loading-indicator')
      expect(indicator).toHaveClass('rounded-lg')
    })
  })

  describe('Text styling', () => {
    it('has muted text color', () => {
      render(<LoadingIndicator />)

      const text = screen.getByText('Loading Claude Code...')
      expect(text).toHaveClass('text-[var(--text-muted)]')
    })

    it('has small text size', () => {
      render(<LoadingIndicator />)

      const text = screen.getByText('Loading Claude Code...')
      expect(text).toHaveClass('text-sm')
    })
  })
})

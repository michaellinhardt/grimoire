import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThinkingIndicator } from './ThinkingIndicator'

describe('ThinkingIndicator', () => {
  describe('Rendering', () => {
    it('renders "Thinking" text', () => {
      render(<ThinkingIndicator />)

      expect(screen.getByText('Thinking')).toBeInTheDocument()
    })

    it('renders three animated dots', () => {
      const { container } = render(<ThinkingIndicator />)

      const dots = container.querySelectorAll('.dot')
      expect(dots).toHaveLength(3)
    })

    it('has correct CSS animation class', () => {
      const { container } = render(<ThinkingIndicator />)

      const indicator = container.querySelector('.thinking-indicator')
      expect(indicator).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has role="status"', () => {
      render(<ThinkingIndicator />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('has appropriate aria-label', () => {
      render(<ThinkingIndicator />)

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Claude is thinking')
    })

    it('hides dots from screen readers', () => {
      const { container } = render(<ThinkingIndicator />)

      const dotsContainer = container.querySelector('[aria-hidden="true"]')
      expect(dotsContainer).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('is left-aligned (not flex-row-reverse)', () => {
      const { container } = render(<ThinkingIndicator />)

      const indicator = container.querySelector('.thinking-indicator')
      expect(indicator).toHaveClass('flex')
      expect(indicator).not.toHaveClass('flex-row-reverse')
    })

    it('has elevated background', () => {
      const { container } = render(<ThinkingIndicator />)

      const indicator = container.querySelector('.thinking-indicator')
      expect(indicator).toHaveClass('bg-[var(--bg-elevated)]')
    })

    it('accepts additional className', () => {
      const { container } = render(<ThinkingIndicator className="custom-class" />)

      const indicator = container.querySelector('.thinking-indicator')
      expect(indicator).toHaveClass('custom-class')
    })

    it('has max-w-fit for natural width', () => {
      const { container } = render(<ThinkingIndicator />)

      const indicator = container.querySelector('.thinking-indicator')
      expect(indicator).toHaveClass('max-w-fit')
    })
  })

  describe('Dot structure', () => {
    it('dots have correct size classes', () => {
      const { container } = render(<ThinkingIndicator />)

      const dots = container.querySelectorAll('.dot')
      dots.forEach((dot) => {
        expect(dot).toHaveClass('w-1.5')
        expect(dot).toHaveClass('h-1.5')
        expect(dot).toHaveClass('rounded-full')
      })
    })

    it('dots have muted background color', () => {
      const { container } = render(<ThinkingIndicator />)

      const dots = container.querySelectorAll('.dot')
      dots.forEach((dot) => {
        expect(dot).toHaveClass('bg-[var(--text-muted)]')
      })
    })
  })
})

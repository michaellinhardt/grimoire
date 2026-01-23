import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JumpToLatestButton } from './JumpToLatestButton'

describe('JumpToLatestButton', () => {
  it('renders visible when visible prop is true', () => {
    render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: /jump to latest/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toHaveClass('opacity-0')
  })

  it('is hidden when visible prop is false', () => {
    render(<JumpToLatestButton visible={false} onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: /jump to latest/i })
    expect(button).toHaveClass('opacity-0')
    expect(button).toHaveClass('pointer-events-none')
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<JumpToLatestButton visible={true} onClick={handleClick} />)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('displays correct text', () => {
    render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    expect(screen.getByText('Jump to latest')).toBeInTheDocument()
  })

  it('has correct accessibility label', () => {
    render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    expect(screen.getByLabelText('Jump to latest message')).toBeInTheDocument()
  })

  it('has focus-visible styling for keyboard accessibility', () => {
    render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('focus-visible:ring-2')
  })

  it('renders chevron icon', () => {
    const { container } = render(<JumpToLatestButton visible={true} onClick={vi.fn()} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

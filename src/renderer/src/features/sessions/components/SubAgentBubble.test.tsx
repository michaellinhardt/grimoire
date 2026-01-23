import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubAgentBubble } from './SubAgentBubble'
import type { SubAgentBlock } from './types'

const mockSubAgent: SubAgentBlock = {
  type: 'sub_agent',
  id: 'subagent-001-a8b2',
  agentType: 'Explore',
  label: 'Code Analysis Agent',
  parentMessageUuid: 'msg-001',
  path: '/.claude/sub-agents/subagent-001-a8b2.jsonl',
  status: 'done',
  messageCount: 8,
  toolCount: 5,
  summary: 'Analyzed authentication module. Found 3 security concerns in login flow.'
}

const mockRunningAgent: SubAgentBlock = {
  ...mockSubAgent,
  id: 'subagent-002-f3c1',
  status: 'running',
  summary: undefined
}

const mockErrorAgent: SubAgentBlock = {
  ...mockSubAgent,
  id: 'subagent-003-d4e5',
  status: 'error',
  summary: 'Build failed: npm ERR! missing dependency'
}

const mockAgentWithoutLabel: SubAgentBlock = {
  ...mockSubAgent,
  id: 'subagent-004',
  label: '',
  agentType: 'Task'
}

describe('SubAgentBubble', () => {
  describe('collapsed state', () => {
    it('renders agent icon', () => {
      const { container } = render(<SubAgentBubble subAgent={mockSubAgent} />)
      // Bot icon from lucide-react
      const icons = container.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)
    })

    it('renders agent label', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} />)
      expect(screen.getByText('Code Analysis Agent')).toBeInTheDocument()
    })

    it('renders default label when label is empty', () => {
      render(<SubAgentBubble subAgent={mockAgentWithoutLabel} />)
      expect(screen.getByText('Task Agent')).toBeInTheDocument()
    })

    it('renders "Done" status badge for done status', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} />)
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('does not show summary in collapsed state', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} isExpanded={false} />)
      // Radix Collapsible content is hidden when closed
      expect(screen.queryByText(/Analyzed authentication/)).toBeNull()
    })

    it('applies purple styling', () => {
      const { container } = render(<SubAgentBubble subAgent={mockSubAgent} />)
      const card = container.firstChild?.firstChild as HTMLElement
      expect(card.className).toContain('bg-purple-500/10')
      expect(card.className).toContain('border-purple-500')
    })

    it('renders chevron icon', () => {
      const { container } = render(<SubAgentBubble subAgent={mockSubAgent} />)
      // ChevronRight icon should be present
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThanOrEqual(2) // Bot + ChevronRight + ExternalLink
    })
  })

  describe('status badge styling', () => {
    it('renders "Running" status with animated dots for running status', () => {
      const { container } = render(<SubAgentBubble subAgent={mockRunningAgent} />)
      expect(screen.getByText('Running')).toBeInTheDocument()
      // Should have running-dots container with 3 dot children
      const dotsContainer = container.querySelector('.running-dots')
      expect(dotsContainer).toBeInTheDocument()
      const dots = dotsContainer?.querySelectorAll('.dot')
      expect(dots?.length).toBe(3)
    })

    it('running dots are hidden from screen readers', () => {
      const { container } = render(<SubAgentBubble subAgent={mockRunningAgent} />)
      const dotsContainer = container.querySelector('.running-dots')
      expect(dotsContainer?.getAttribute('aria-hidden')).toBe('true')
    })

    it('running status badge has green styling', () => {
      const { container } = render(<SubAgentBubble subAgent={mockRunningAgent} />)
      const badge = container.querySelector('.text-green-500')
      expect(badge).toBeInTheDocument()
    })

    it('renders "Done" status with muted styling', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} />)
      const badge = screen.getByText('Done')
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain('text-[var(--text-muted)]')
    })

    it('renders "Error" status with red styling', () => {
      render(<SubAgentBubble subAgent={mockErrorAgent} />)
      const badge = screen.getByText('Error')
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain('text-red-500')
    })
  })

  describe('expanded state', () => {
    it('shows message and tool count when expanded', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} isExpanded={true} />)
      expect(screen.getByText('8 messages, 5 tool calls')).toBeVisible()
    })

    it('shows summary when expanded', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} isExpanded={true} />)
      expect(screen.getByText(/Analyzed authentication module/)).toBeVisible()
    })

    it('rotates chevron when expanded', () => {
      const { container } = render(<SubAgentBubble subAgent={mockSubAgent} isExpanded={true} />)
      // Find the ChevronRight svg (second svg after Bot icon)
      const svgs = container.querySelectorAll('svg')
      const chevron = Array.from(svgs).find((svg) =>
        svg.getAttribute('class')?.includes('transition-transform')
      )
      expect(chevron?.getAttribute('class')).toContain('rotate-90')
    })

    it('shows question marks for unknown counts', () => {
      const agentWithoutCounts: SubAgentBlock = {
        ...mockSubAgent,
        messageCount: undefined,
        toolCount: undefined
      }
      render(<SubAgentBubble subAgent={agentWithoutCounts} isExpanded={true} />)
      expect(screen.getByText('? messages, ? tool calls')).toBeVisible()
    })

    it('does not show summary div when summary is undefined', () => {
      // Create a running agent with known counts
      const runningAgentWithCounts: SubAgentBlock = {
        type: 'sub_agent',
        id: 'subagent-running-test',
        agentType: 'Task',
        label: 'Running Task Agent',
        parentMessageUuid: 'msg-test',
        path: '/.claude/sub-agents/running.jsonl',
        status: 'running',
        messageCount: 3,
        toolCount: 2,
        summary: undefined
      }
      render(<SubAgentBubble subAgent={runningAgentWithCounts} isExpanded={true} />)
      // Running agent has no summary
      expect(screen.queryByText(/Analyzed/)).toBeNull()
      // But stats should still show
      expect(screen.getByText('3 messages, 2 tool calls')).toBeVisible()
    })
  })

  describe('toggle behavior', () => {
    it('calls onToggle when clicking the trigger button', () => {
      const onToggle = vi.fn()
      render(<SubAgentBubble subAgent={mockSubAgent} onToggle={onToggle} />)

      const trigger = screen.getByRole('button', { name: /Code Analysis Agent/i })
      fireEvent.click(trigger)

      expect(onToggle).toHaveBeenCalled()
    })

    it('has accessible button with aria-label including status', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} />)
      expect(screen.getByLabelText('Code Analysis Agent - Done')).toBeInTheDocument()
    })

    it('has accessible aria-label for running status', () => {
      render(<SubAgentBubble subAgent={mockRunningAgent} />)
      expect(screen.getByLabelText('Code Analysis Agent - Running')).toBeInTheDocument()
    })
  })

  describe('open-in-tab button', () => {
    it('renders open-in-tab button', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} />)
      expect(screen.getByLabelText('Open sub-agent in new tab')).toBeInTheDocument()
    })

    it('calls onOpenInTab when clicking the button', () => {
      const onOpenInTab = vi.fn()
      render(<SubAgentBubble subAgent={mockSubAgent} onOpenInTab={onOpenInTab} />)

      const openButton = screen.getByLabelText('Open sub-agent in new tab')
      fireEvent.click(openButton)

      expect(onOpenInTab).toHaveBeenCalled()
    })

    it('does not trigger onToggle when clicking open-in-tab button', () => {
      const onToggle = vi.fn()
      const onOpenInTab = vi.fn()
      render(
        <SubAgentBubble subAgent={mockSubAgent} onToggle={onToggle} onOpenInTab={onOpenInTab} />
      )

      const openButton = screen.getByLabelText('Open sub-agent in new tab')
      fireEvent.click(openButton)

      expect(onOpenInTab).toHaveBeenCalled()
      expect(onToggle).not.toHaveBeenCalled()
    })

    it('open-in-tab button has hidden opacity by default (hover to show)', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} isExpanded={false} />)
      const openButton = screen.getByLabelText('Open sub-agent in new tab')
      expect(openButton.className).toContain('opacity-0')
    })

    it('open-in-tab button is always visible when expanded', () => {
      render(<SubAgentBubble subAgent={mockSubAgent} isExpanded={true} />)
      const openButton = screen.getByLabelText('Open sub-agent in new tab')
      expect(openButton.className).toContain('opacity-100')
    })
  })

  describe('accessibility', () => {
    it('trigger button has proper accessible name', () => {
      render(<SubAgentBubble subAgent={mockErrorAgent} />)
      expect(
        screen.getByRole('button', { name: /Code Analysis Agent - Error/i })
      ).toBeInTheDocument()
    })

    it('icons are hidden from screen readers', () => {
      const { container } = render(<SubAgentBubble subAgent={mockSubAgent} />)
      const svgs = container.querySelectorAll('svg')
      svgs.forEach((svg) => {
        expect(svg.getAttribute('aria-hidden')).toBe('true')
      })
    })
  })
})

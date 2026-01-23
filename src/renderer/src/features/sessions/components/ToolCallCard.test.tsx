import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCallCard } from './ToolCallCard'
import type { ToolUseBlock, ToolResultBlock } from './types'

const mockToolCall: ToolUseBlock = {
  type: 'tool_use',
  id: 'test-tool-1',
  name: 'Read',
  input: { file_path: 'src/main/index.ts' }
}

const mockResult: ToolResultBlock = {
  type: 'tool_result',
  tool_use_id: 'test-tool-1',
  content: 'import { app } from "electron"\n\napp.whenReady()'
}

const mockErrorResult: ToolResultBlock = {
  type: 'tool_result',
  tool_use_id: 'test-tool-1',
  content: 'Error: ENOENT: no such file or directory',
  is_error: true
}

describe('ToolCallCard', () => {
  describe('collapsed state', () => {
    it('renders tool name', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} />)
      expect(screen.getByText('Read')).toBeInTheDocument()
    })

    it('renders tool summary', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} />)
      expect(screen.getByText('src/main/index.ts')).toBeInTheDocument()
    })

    it('renders chevron icon', () => {
      const { container } = render(<ToolCallCard toolCall={mockToolCall} result={mockResult} />)
      const chevron = container.querySelector('svg')
      expect(chevron).toBeInTheDocument()
    })

    it('does not show input/output in collapsed state', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} isExpanded={false} />)
      // Radix Collapsible content is hidden when closed
      expect(screen.queryByText('Input:')).toBeNull()
      expect(screen.queryByText('Output:')).toBeNull()
    })

    it('applies blue styling for normal tool', () => {
      const { container } = render(<ToolCallCard toolCall={mockToolCall} result={mockResult} />)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('bg-blue-500/10')
      expect(card.className).toContain('border-blue-500')
    })
  })

  describe('expanded state', () => {
    it('shows input section when expanded', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} isExpanded={true} />)
      expect(screen.getByText('Input:')).toBeVisible()
    })

    it('shows output section when expanded', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} isExpanded={true} />)
      expect(screen.getByText('Output:')).toBeVisible()
    })

    it('displays tool input as JSON', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} isExpanded={true} />)
      expect(screen.getByText(/"file_path":/)).toBeInTheDocument()
    })

    it('displays tool output content', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} isExpanded={true} />)
      expect(screen.getByText(/import { app }/)).toBeInTheDocument()
    })

    it('rotates chevron when expanded', () => {
      const { container } = render(
        <ToolCallCard toolCall={mockToolCall} result={mockResult} isExpanded={true} />
      )
      const chevron = container.querySelector('svg')
      // SVG elements use getAttribute('class') not className property
      expect(chevron?.getAttribute('class')).toContain('rotate-90')
    })
  })

  describe('toggle behavior', () => {
    it('calls onToggle when clicked', () => {
      const onToggle = vi.fn()
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} onToggle={onToggle} />)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(onToggle).toHaveBeenCalled()
    })

    it('has accessible button with aria-label', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} />)
      expect(screen.getByLabelText('Read tool call')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('applies red styling for error result', () => {
      const { container } = render(
        <ToolCallCard toolCall={mockToolCall} result={mockErrorResult} />
      )
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('bg-red-500/10')
      expect(card.className).toContain('border-red-500')
    })

    it('shows error preview in collapsed state', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockErrorResult} />)
      expect(screen.getByText(/ENOENT/)).toBeInTheDocument()
    })

    it('shows ERROR badge in collapsed state', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockErrorResult} isExpanded={false} />)
      expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('hides ERROR badge when expanded', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockErrorResult} isExpanded={true} />)
      // The "Error" badge (uppercase) should not be visible when expanded
      // The "Error:" label (with colon) IS visible in expanded state
      // Use regex to differentiate: badge has exact "Error" text
      const badgeText = screen.queryByText(/^Error$/) // Exact match without colon
      expect(badgeText).toBeNull() // Badge hidden when expanded
      // But "Error:" label should be present
      expect(screen.getByText('Error:')).toBeInTheDocument()
    })

    it('has accessible aria-label indicating error', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockErrorResult} />)
      expect(screen.getByLabelText('Read tool call (error)')).toBeInTheDocument()
    })

    it('shows "Error:" label instead of "Output:" in expanded error state', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockErrorResult} isExpanded={true} />)
      expect(screen.getByText('Error:')).toBeVisible()
      expect(screen.queryByText('Output:')).not.toBeInTheDocument()
    })
  })

  describe('no result state', () => {
    it('shows "No result available" when result is null', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={null} isExpanded={true} />)
      expect(screen.getByText('No result available')).toBeInTheDocument()
    })

    it('still shows input section when result is null', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={null} isExpanded={true} />)
      expect(screen.getByText('Input:')).toBeVisible()
    })
  })

  describe('different tool types', () => {
    it('renders Bash tool with command summary', () => {
      const bashTool: ToolUseBlock = {
        type: 'tool_use',
        id: 'bash-1',
        name: 'Bash',
        input: { command: 'npm run build' }
      }
      render(<ToolCallCard toolCall={bashTool} result={null} />)
      expect(screen.getByText('Bash')).toBeInTheDocument()
      expect(screen.getByText('npm run build')).toBeInTheDocument()
    })

    it('renders Glob tool with pattern summary', () => {
      const globTool: ToolUseBlock = {
        type: 'tool_use',
        id: 'glob-1',
        name: 'Glob',
        input: { pattern: '**/*.tsx' }
      }
      render(<ToolCallCard toolCall={globTool} result={null} />)
      expect(screen.getByText('Glob')).toBeInTheDocument()
      expect(screen.getByText('**/*.tsx')).toBeInTheDocument()
    })
  })

  describe('long output truncation', () => {
    const longContent = 'x'.repeat(600) // 600 chars, exceeds 500 threshold
    const mockLongResult: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test-tool-1',
      content: longContent
    }

    it('truncates long output and shows "Show more" button', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockLongResult} isExpanded={true} />)
      expect(screen.getByText('Show more')).toBeInTheDocument()
    })

    it('shows full output after clicking "Show more"', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockLongResult} isExpanded={true} />)

      const showMoreButton = screen.getByText('Show more')
      fireEvent.click(showMoreButton)

      expect(screen.getByText('Show less')).toBeInTheDocument()
      // Full content should be present (check first few chars and verify length)
      const preElement = screen.getByText(/^x+$/)
      expect(preElement.textContent?.length).toBe(600)
    })

    it('collapses output after clicking "Show less"', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockLongResult} isExpanded={true} />)

      // Expand
      fireEvent.click(screen.getByText('Show more'))
      expect(screen.getByText('Show less')).toBeInTheDocument()

      // Collapse
      fireEvent.click(screen.getByText('Show less'))
      expect(screen.getByText('Show more')).toBeInTheDocument()
    })

    it('does not show "Show more" for short output', () => {
      render(<ToolCallCard toolCall={mockToolCall} result={mockResult} isExpanded={true} />)
      expect(screen.queryByText('Show more')).not.toBeInTheDocument()
    })
  })
})

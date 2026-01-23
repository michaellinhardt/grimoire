import { type ReactElement, useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronRight } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { formatToolSummary } from '@renderer/shared/utils/formatToolSummary'
import { isToolError, getErrorPreview } from '@renderer/shared/utils/pairToolCalls'
import type { ToolUseBlock, ToolResultBlock } from './types'

/** Threshold for truncating long outputs (in characters) */
const OUTPUT_TRUNCATE_THRESHOLD = 500

export interface ToolCallCardProps {
  /** The tool use block containing tool name and input */
  toolCall: ToolUseBlock
  /** The tool result (may be null if pending or not yet received) */
  result: ToolResultBlock | null
  /** Whether the card is currently expanded */
  isExpanded?: boolean
  /** Callback when expand/collapse is toggled */
  onToggle?: () => void
}

/**
 * Renders a tool call as a compact card with expand/collapse functionality.
 * Shows tool name and brief summary in collapsed state.
 * Shows full input parameters and output when expanded.
 *
 * @param toolCall - The tool use block to display
 * @param result - The tool result (or null if pending)
 * @param isExpanded - Whether the card is expanded
 * @param onToggle - Callback when user toggles expand/collapse
 * @returns A styled tool call card element
 */
export function ToolCallCard({
  toolCall,
  result,
  isExpanded = false,
  onToggle
}: ToolCallCardProps): ReactElement {
  const hasError = isToolError(result)
  const summary = formatToolSummary(toolCall)
  const [showFullOutput, setShowFullOutput] = useState(false)

  // Determine if output should be truncated
  const outputContent = result?.content ?? ''
  const isOutputLong = outputContent.length > OUTPUT_TRUNCATE_THRESHOLD
  const displayedOutput =
    isOutputLong && !showFullOutput
      ? outputContent.slice(0, OUTPUT_TRUNCATE_THRESHOLD) + '...'
      : outputContent

  return (
    <Collapsible.Root
      open={isExpanded}
      onOpenChange={onToggle}
      className={cn(
        'rounded-lg border-l-2 overflow-hidden',
        hasError ? 'bg-red-500/10 border-red-500' : 'bg-blue-500/10 border-blue-500'
      )}
    >
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className={cn(
            'w-full text-left flex items-center gap-2 p-3',
            hasError ? 'hover:bg-red-500/15' : 'hover:bg-blue-500/15',
            'transition-colors cursor-pointer',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
          )}
          aria-label={`${toolCall.name} tool call${hasError ? ' (error)' : ''}`}
        >
          {/* Tool name */}
          <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
            {toolCall.name}
          </span>

          {/* Summary or error preview */}
          <span
            className={cn(
              'flex-1 truncate text-sm',
              hasError ? 'text-red-400' : 'text-[var(--text-muted)]'
            )}
          >
            {hasError && result ? getErrorPreview(result) : summary}
          </span>

          {/* Error badge (only in collapsed state with error) */}
          {hasError && !isExpanded && (
            <span className="text-xs font-medium text-red-400 uppercase">Error</span>
          )}

          {/* Chevron */}
          <ChevronRight
            className={cn(
              'h-4 w-4 text-[var(--text-muted)] transition-transform duration-200',
              isExpanded && 'rotate-90'
            )}
            aria-hidden="true"
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="collapsible-content overflow-hidden">
        <div className="p-3 pt-0 border-t border-[var(--border)]">
          {/* Input section */}
          <div className="text-xs text-[var(--text-muted)] mb-1 mt-2">Input:</div>
          <pre className="text-xs font-mono bg-[var(--bg-base)] p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>

          {/* Output section */}
          {result && (
            <>
              <div
                className={cn(
                  'text-xs mt-3 mb-1',
                  hasError ? 'text-red-400' : 'text-[var(--text-muted)]'
                )}
              >
                {hasError ? 'Error:' : 'Output:'}
              </div>
              <pre
                className={cn(
                  'text-xs font-mono p-2 rounded overflow-x-auto whitespace-pre-wrap break-all',
                  hasError ? 'bg-red-500/5 text-red-300' : 'bg-[var(--bg-base)]',
                  !showFullOutput && isOutputLong ? 'max-h-32' : 'max-h-48 overflow-y-auto'
                )}
              >
                {displayedOutput}
              </pre>
              {isOutputLong && (
                <button
                  type="button"
                  onClick={() => setShowFullOutput(!showFullOutput)}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] mt-1 cursor-pointer"
                >
                  {showFullOutput ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )}

          {/* No result indicator */}
          {!result && (
            <div className="text-xs text-[var(--text-muted)] mt-3 italic">No result available</div>
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

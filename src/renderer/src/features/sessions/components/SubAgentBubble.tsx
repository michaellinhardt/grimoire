import { type ReactElement } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Bot, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import type { SubAgentBlock } from './types'

export interface SubAgentBubbleProps {
  /** Sub-agent data block containing ID, type, status, and summary info */
  subAgent: SubAgentBlock
  /** Whether the bubble is expanded showing summary */
  isExpanded?: boolean
  /** Callback to toggle expanded state */
  onToggle?: () => void
  /** Callback to open sub-agent in dedicated tab */
  onOpenInTab?: () => void
}

/**
 * Renders a sub-agent as a collapsible bubble with inline summary and open-in-tab action.
 * Collapsed state shows agent icon, name, and status badge.
 * Expanded state shows conversation summary with message/tool counts.
 *
 * @param subAgent - Sub-agent data block
 * @param isExpanded - Whether the bubble is expanded showing summary
 * @param onToggle - Callback to toggle expanded state
 * @param onOpenInTab - Callback to open sub-agent in dedicated tab
 * @returns A styled sub-agent bubble element
 */
export function SubAgentBubble({
  subAgent,
  isExpanded = false,
  onToggle,
  onOpenInTab
}: SubAgentBubbleProps): ReactElement {
  const { status } = subAgent

  const statusBadgeClass = cn(
    'text-xs px-2 py-0.5 rounded flex items-center',
    status === 'running' && 'text-green-500 bg-green-500/10',
    status === 'done' && 'text-[var(--text-muted)] bg-[var(--bg-base)]',
    status === 'error' && 'text-red-500 bg-red-500/10'
  )

  // Status text for accessibility
  const statusText = status === 'running' ? 'Running' : status === 'done' ? 'Done' : 'Error'

  // Status content - running shows animated dots
  const statusContent =
    status === 'running' ? (
      <>
        Running
        <span className="running-dots ml-0.5 flex items-center" aria-hidden="true">
          <span className="dot w-1 h-1 rounded-full bg-green-500 mx-px" />
          <span className="dot w-1 h-1 rounded-full bg-green-500 mx-px" />
          <span className="dot w-1 h-1 rounded-full bg-green-500 mx-px" />
        </span>
      </>
    ) : status === 'done' ? (
      'Done'
    ) : (
      'Error'
    )

  return (
    <Collapsible.Root open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          'rounded-lg border-l-2 border-purple-500 bg-purple-500/10',
          'hover:bg-purple-500/15 transition-colors'
        )}
      >
        {/* Header - always visible */}
        <div className="flex items-center justify-between p-3 group">
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center flex-1 text-left',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
              )}
              aria-label={`${subAgent.label || subAgent.agentType + ' Agent'} - ${statusText}`}
            >
              <Bot className="h-4 w-4 text-purple-400 mr-2 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium text-[var(--text-primary)] truncate">
                {subAgent.label || `${subAgent.agentType} Agent`}
              </span>
              <span className={cn(statusBadgeClass, 'ml-2 flex-shrink-0')}>{statusContent}</span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 ml-auto text-[var(--text-muted)] transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
                aria-hidden="true"
              />
            </button>
          </Collapsible.Trigger>

          {/* Open in tab button - visible on hover or when expanded */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenInTab?.()
            }}
            className={cn(
              'ml-2 p-1 rounded hover:bg-purple-500/20 transition-opacity',
              'opacity-0 group-hover:opacity-100',
              isExpanded && 'opacity-100',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:opacity-100'
            )}
            title="Open in new tab"
            aria-label="Open sub-agent in new tab"
          >
            <ExternalLink className="h-4 w-4 text-purple-400" aria-hidden="true" />
          </button>
        </div>

        {/* Expanded content */}
        <Collapsible.Content className="collapsible-content overflow-hidden">
          <div className="px-3 pb-3 border-t border-purple-500/20">
            {/* Summary stats */}
            <div className="text-xs text-[var(--text-muted)] py-2">
              {subAgent.messageCount ?? '?'} messages, {subAgent.toolCount ?? '?'} tool calls
            </div>

            {/* Conversation summary - simplified view */}
            {subAgent.summary && (
              <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-base)] rounded p-2">
                {subAgent.summary}
              </div>
            )}

            {/* Note: Full conversation rendering deferred to when sub-agent tab is opened */}
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  )
}

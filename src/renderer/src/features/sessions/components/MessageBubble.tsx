import type { ReactElement } from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { formatMessageTimestamp } from '@renderer/shared/utils/formatMessageTimestamp'

export interface MessageBubbleProps {
  /** Message author - 'user' for human, 'assistant' for Claude */
  role: 'user' | 'assistant'
  /** Message text content */
  content: string
  /** Unix timestamp in milliseconds */
  timestamp: number
  /** Message index in conversation (0-based) - used to determine if first message */
  messageIndex?: number
  /** Callback when rewind icon is clicked (only for user messages, not first) */
  onRewind?: () => void
}

/**
 * Renders a conversation message bubble with role-based styling.
 * User messages: right-aligned, accent-muted background, accent border
 * Assistant messages: left-aligned, elevated background, subtle border
 *
 * @param role - Message author ('user' or 'assistant')
 * @param content - Message text content
 * @param timestamp - Unix timestamp in milliseconds
 * @param messageIndex - Message index in conversation (0-based)
 * @param onRewind - Callback when rewind icon is clicked (only for user messages, not first)
 * @returns A styled message bubble element
 */
export function MessageBubble({
  role,
  content,
  timestamp,
  messageIndex,
  onRewind
}: MessageBubbleProps): ReactElement {
  const isUser = role === 'user'
  // Show rewind icon only for user messages that are not the first message
  const showRewindIcon = isUser && messageIndex !== undefined && messageIndex > 0 && onRewind

  return (
    <div
      role="article"
      aria-label={isUser ? 'User message' : 'Assistant message'}
      className={cn(
        'relative group max-w-[80%] rounded-lg p-3',
        isUser
          ? 'ml-auto rounded-br-sm bg-[var(--accent-muted)] border border-[var(--accent)]'
          : 'mr-auto rounded-bl-sm bg-[var(--bg-elevated)] border border-[var(--border)]'
      )}
    >
      <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words">{content}</p>
      <span className={cn('text-xs text-[var(--text-muted)] mt-1 block', isUser && 'text-right')}>
        {formatMessageTimestamp(timestamp)}
      </span>

      {/* Rewind icon - only for user messages, not first message */}
      {showRewindIcon && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRewind()
          }}
          className={cn(
            'absolute top-2 right-2 p-1 rounded transition-opacity',
            'opacity-0 group-hover:opacity-100',
            'bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:opacity-100'
          )}
          aria-label="Rewind conversation from this message"
        >
          <RotateCcw className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" />
        </button>
      )}
    </div>
  )
}

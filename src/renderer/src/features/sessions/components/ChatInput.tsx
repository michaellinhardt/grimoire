import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactElement,
  type KeyboardEvent,
  type ChangeEvent
} from 'react'
import { Send, Square, Loader2 } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { useNetworkStatus } from '@renderer/shared/hooks/useNetworkStatus'

export interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void
  /** Callback when abort button clicked (Story 3a-4) */
  onAbort?: () => void
  /** Disable input during processing */
  disabled?: boolean
  /** Custom placeholder text (derived from hasMessages by default) */
  placeholder?: string
  /** Auto-focus on mount for new sessions */
  autoFocus?: boolean
  /** Whether session has existing messages (for placeholder logic) */
  hasMessages?: boolean
  /** Whether session is currently working (shows abort button) (Story 3a-4) */
  isWorking?: boolean
  /** Whether abort is in progress (Story 3a-4) */
  isAborting?: boolean
}

/**
 * Chat input component for composing and sending messages.
 * Features auto-expanding textarea, Enter to send, Shift+Enter for newlines.
 *
 * @param onSend - Callback when user sends a message
 * @param disabled - Disable input during processing
 * @param placeholder - Custom placeholder text
 * @param autoFocus - Auto-focus on mount for new sessions
 * @param hasMessages - Whether session has existing messages
 */
export function ChatInput({
  onSend,
  onAbort,
  disabled = false,
  placeholder,
  autoFocus = false,
  hasMessages = false,
  isWorking = false,
  isAborting = false
}: ChatInputProps): ReactElement {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { online } = useNetworkStatus()
  const isOffline = !online

  // Derive placeholder from hasMessages if not provided
  const displayPlaceholder =
    placeholder ?? (hasMessages ? 'Type anything to continue...' : 'Type your message...')

  // Auto-focus on mount if autoFocus is true
  // Use empty dependency array - focus should only happen on mount, not on prop changes
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Focus only on mount, not when autoFocus prop changes
  }, [])

  // Adjust textarea height based on content
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto' // Reset to recalculate
      const newHeight = Math.max(40, Math.min(textareaRef.current.scrollHeight, 200))
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [])

  // Handle input change
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      adjustHeight()
    },
    [adjustHeight]
  )

  // Internal send logic - shared between keyboard and button handlers
  const performSend = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !disabled && online) {
      onSend(trimmed)
      setValue('')
      // Reset height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, disabled, online, onSend])

  // Handle keyboard events (Enter to send, Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        performSend()
      }
      // Shift+Enter: default behavior (newline) allowed
    },
    [performSend]
  )

  // Handle send button click
  const handleSend = useCallback(() => {
    performSend()
  }, [performSend])

  const canSend = value.trim().length > 0 && !disabled && online

  return (
    <div className="h-auto border-t border-[var(--border)] flex items-end px-4 py-3 gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={displayPlaceholder}
        rows={1}
        title="Press Shift+Enter for a new line, Enter to send"
        className={cn(
          'flex-1 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] px-3 py-2',
          'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
          'resize-none min-h-[40px] max-h-[200px] overflow-y-auto',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Message input"
      />
      {isWorking ? (
        <button
          type="button"
          onClick={onAbort}
          disabled={isAborting || !onAbort}
          title="Stop generation (Esc)"
          className={cn(
            'p-2 rounded-[var(--radius-sm)]',
            'bg-red-500/90 text-white',
            'hover:bg-red-600 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Stop generation"
        >
          {isAborting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Square className="w-4 h-4 fill-current" />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          title={isOffline ? 'Internet required to send messages' : undefined}
          className={cn(
            'p-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white',
            'hover:bg-[var(--accent)]/80 transition-colors',
            'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label={isOffline ? 'Send message (offline)' : 'Send message'}
        >
          <Send className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

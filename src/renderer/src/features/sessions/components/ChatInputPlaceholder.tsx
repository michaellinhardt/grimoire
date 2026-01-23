import type { ReactElement } from 'react'

interface ChatInputPlaceholderProps {
  /** When true, indicates this input should auto-focus when ChatInput is implemented (UX11) */
  autoFocus?: boolean
  placeholder?: string
}

/**
 * Placeholder for chat input - will be replaced by actual ChatInput in Epic 3a.
 *
 * NOTE for Epic 3a: When implementing ChatInput:
 * - If autoFocus is true, call inputRef.focus() on mount
 * - Replace this entire component with the actual ChatInput
 */
export function ChatInputPlaceholder({
  autoFocus = false,
  placeholder = 'Type your message...'
}: ChatInputPlaceholderProps): ReactElement {
  // NOTE: autoFocus prop is stored for documentation purposes only in this placeholder.
  // Epic 3a will implement actual focus behavior.
  void autoFocus // Explicitly mark as intentionally unused

  return (
    <div className="h-12 border-t border-[var(--border)] flex items-center px-4">
      <div
        className="flex-1 h-8 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] px-3 flex items-center"
        role="textbox"
        aria-placeholder={placeholder}
        aria-disabled="true"
      >
        <span className="text-sm text-[var(--text-muted)]">
          {placeholder} (input coming in Epic 3a)
        </span>
      </div>
    </div>
  )
}

import { type ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'

export interface ThinkingIndicatorProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * Animated thinking indicator with three dots that pulse sequentially.
 * Displays when Claude is processing a request and has started streaming.
 * Non-persistent - disappears when response starts streaming.
 *
 * @param className - Additional CSS classes
 * @returns A thinking indicator element with animated dots
 */
export function ThinkingIndicator({ className }: ThinkingIndicatorProps): ReactElement {
  return (
    <div
      className={cn(
        'thinking-indicator flex items-center gap-2 p-3 rounded-lg',
        'bg-[var(--bg-elevated)] max-w-fit',
        className
      )}
      role="status"
      aria-label="Claude is thinking"
    >
      <span className="text-sm text-[var(--text-muted)]">Thinking</span>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        <span className="dot w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
        <span className="dot w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
        <span className="dot w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
      </span>
    </div>
  )
}

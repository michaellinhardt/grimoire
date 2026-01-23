import { type ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'

export interface LoadingIndicatorProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * Loading indicator with subtle fade pulse animation.
 * Displays when spawning CC child process for an inactive session.
 * Transitions to ThinkingIndicator once connection is established.
 *
 * @param className - Additional CSS classes
 * @returns A loading indicator element with fade pulse animation
 */
export function LoadingIndicator({ className }: LoadingIndicatorProps): ReactElement {
  return (
    <div
      className={cn(
        'loading-indicator flex items-center p-3 rounded-lg',
        'bg-[var(--bg-elevated)] max-w-fit',
        className
      )}
      role="status"
      aria-label="Loading Claude Code"
    >
      <span className="text-sm text-[var(--text-muted)]">Loading Claude Code...</span>
    </div>
  )
}

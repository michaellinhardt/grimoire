import { type ReactElement } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'

export interface JumpToLatestButtonProps {
  /** Whether the button should be visible */
  visible: boolean
  /** Callback when button is clicked */
  onClick: () => void
}

/**
 * Floating button to jump to latest content during streaming.
 * Shows when user scrolls away from bottom while streaming is active.
 */
export function JumpToLatestButton({ visible, onClick }: JumpToLatestButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 z-10',
        'flex items-center gap-1.5 px-3 py-1.5',
        'bg-[var(--accent)] text-white rounded-full',
        'text-xs font-medium shadow-lg',
        'hover:bg-[var(--accent-hover)] transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      )}
      aria-label="Jump to latest message"
    >
      <ChevronDown className="w-3.5 h-3.5" />
      <span>Jump to latest</span>
    </button>
  )
}

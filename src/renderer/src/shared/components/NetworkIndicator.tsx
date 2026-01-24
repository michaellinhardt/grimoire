import type { ReactElement } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { cn } from '../utils/cn'

/**
 * Small network status indicator.
 * Subtle when online (green, muted), attention-grabbing when offline (red, pulsing).
 */
export function NetworkIndicator(): ReactElement {
  const { online } = useNetworkStatus()

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors cursor-default',
            online ? 'bg-[var(--success)]/50' : 'bg-[var(--error)] animate-pulse'
          )}
          role="status"
          aria-label={online ? 'Online' : 'Offline'}
          data-testid="network-indicator"
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] z-50"
        >
          {online ? 'Online' : 'Offline - Some features unavailable'}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

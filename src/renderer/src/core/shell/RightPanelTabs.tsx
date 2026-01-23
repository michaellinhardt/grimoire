import { type ReactElement } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { PanelRightClose } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import type { RightPanelTab } from '@renderer/shared/store/useUIStore'

const TAB_OPTIONS: { value: RightPanelTab; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'events', label: 'Events' },
  { value: 'files', label: 'Files' }
]

const tabTriggerClasses = cn(
  'px-3 py-2 text-sm font-medium',
  'text-[var(--text-muted)]',
  'border-b-2 border-transparent',
  'transition-colors duration-150',
  'hover:text-[var(--text-primary)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
  'data-[state=active]:text-[var(--text-primary)]',
  'data-[state=active]:border-[var(--accent)]'
)

export interface RightPanelTabsProps {
  /** Callback when collapse button clicked */
  onCollapse: () => void
}

/**
 * Tab navigation for right panel with Info, Events, and Files tabs.
 * Must be used inside a Radix Tabs.Root - this renders the Tabs.List.
 * The active tab state is managed by the parent Tabs.Root component.
 * Door button collapses panel.
 */
export function RightPanelTabs({ onCollapse }: RightPanelTabsProps): ReactElement {
  return (
    <div className="h-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)]">
      <Tabs.List className="flex items-center" aria-label="Right panel views">
        {TAB_OPTIONS.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} className={tabTriggerClasses}>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <button
        onClick={onCollapse}
        className={cn(
          'mr-3 w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)]',
          'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
          'transition-colors'
        )}
        aria-label="Collapse right panel"
      >
        <PanelRightClose size={16} />
      </button>
    </div>
  )
}

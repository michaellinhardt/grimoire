import { PanelLeftClose, PanelRightClose } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import type { ReactNode, ReactElement } from 'react'

interface PanelTopbarProps {
  title: string
  side: 'left' | 'right'
  onCollapse: () => void
  children?: ReactNode
}

export function PanelTopbar({ title, side, onCollapse, children }: PanelTopbarProps): ReactElement {
  const CollapseIcon = side === 'left' ? PanelLeftClose : PanelRightClose

  return (
    <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</span>
        {children}
      </div>
      <button
        onClick={onCollapse}
        className={cn(
          'w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)]',
          'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
          'transition-colors'
        )}
        aria-label={`Collapse ${side} panel`}
      >
        <CollapseIcon size={16} />
      </button>
    </div>
  )
}

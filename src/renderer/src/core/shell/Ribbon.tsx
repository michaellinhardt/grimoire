import { MessagesSquare, Settings } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@renderer/shared/utils/cn'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import type { ReactNode, KeyboardEvent, ReactElement } from 'react'

interface RibbonButtonProps {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function RibbonButton({ icon, label, active, disabled, onClick }: RibbonButtonProps): ReactElement {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'w-[34px] h-[34px] flex items-center justify-center rounded-[var(--radius-sm)]',
            'text-[var(--text-muted)] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            !disabled && 'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            active && 'bg-[var(--accent)] text-white',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="px-2 py-1 text-sm bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] z-50"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function Ribbon(): ReactElement {
  const { activeSection, setActiveSection } = useUIStore()

  // Handle keyboard navigation within ribbon (Arrow Up/Down)
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const buttons = e.currentTarget.querySelectorAll('button:not([disabled])')
    const currentIndex = Array.from(buttons).findIndex((btn) => btn === document.activeElement)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0
      ;(buttons[nextIndex] as HTMLElement).focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1
      ;(buttons[prevIndex] as HTMLElement).focus()
    }
  }

  return (
    <div
      className="w-12 flex flex-col items-center py-2 gap-1 bg-[var(--bg-base)] border-r border-[var(--border)]"
      role="navigation"
      aria-label="Main navigation"
      onKeyDown={handleKeyDown}
    >
      <RibbonButton
        icon={<MessagesSquare size={20} />}
        label="Sessions"
        active={activeSection === 'sessions'}
        onClick={() => setActiveSection('sessions')}
      />
      <RibbonButton
        icon={<Settings size={20} />}
        label="Settings"
        active={activeSection === 'settings'}
        disabled
        onClick={() => setActiveSection('settings')}
      />
    </div>
  )
}

import type { ReactElement, MouseEvent } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Pin, Zap, AlertTriangle, MoreVertical, Archive, ArchiveRestore } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { formatRelativeTime } from '@renderer/shared/utils/formatRelativeTime'
import { getSessionDisplayName } from '@renderer/shared/utils/getSessionDisplayName'
import { SessionContextMenu } from './SessionContextMenu'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

// Shared menu item styles used by both DropdownMenu and ContextMenu
export const menuContentStyles =
  'min-w-[160px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] p-1 shadow-lg z-50'
export const menuItemStyles =
  'flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] cursor-pointer hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] focus:outline-none'

interface SessionListItemProps {
  session: SessionWithExists
  isActive: boolean
  isWorking: boolean
  onClick: () => void
  onArchive: () => void
  onUnarchive: () => void
}

export function SessionListItem({
  session,
  isActive,
  isWorking,
  onClick,
  onArchive,
  onUnarchive
}: SessionListItemProps): ReactElement {
  const displayName = getSessionDisplayName(session.folderPath)

  // Handle 3-dot menu click - prevent propagation and stop default to avoid triggering onClick
  const handleMenuTriggerClick = (e: MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick()
            }
          }}
          className={cn(
            'group w-full text-left p-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer',
            'hover:bg-[var(--bg-hover)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-inset',
            isActive && 'bg-[var(--accent-muted)] border border-[var(--accent)]',
            isWorking && 'border-l-2 border-l-[var(--success)]',
            !session.exists && 'opacity-75',
            session.archived && 'opacity-60'
          )}
        >
          <div className="flex items-center gap-2">
            {session.isPinned && (
              <Pin
                className="w-4 h-4 text-[var(--accent)] flex-shrink-0"
                aria-label="Pinned session"
              />
            )}
            {isWorking && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <Zap
                  className="w-4 h-4 text-[var(--success)] animate-pulse"
                  aria-label="Session is working"
                />
                <span className="text-[var(--success)] text-xs animate-pulse">...</span>
              </span>
            )}
            {!session.exists && (
              <AlertTriangle
                className="w-4 h-4 text-[var(--warning)] flex-shrink-0"
                aria-label="Folder not found"
              />
            )}
            <span className="font-medium truncate text-[var(--text-primary)] flex-1">
              {displayName}
            </span>

            {/* 3-dot menu - use div wrapper to prevent nested button issue */}
            <div onClick={handleMenuTriggerClick} className="flex-shrink-0">
              <SessionContextMenu
                session={session}
                trigger={
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] focus:opacity-100"
                    aria-label="Session options"
                  >
                    <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                }
                onArchive={onArchive}
                onUnarchive={onUnarchive}
              />
            </div>
          </div>
          <div
            className={cn(
              'text-xs truncate mt-0.5 pl-6',
              session.exists ? 'text-[var(--text-muted)]' : 'text-[var(--error)]',
              session.archived && 'italic'
            )}
          >
            {session.archived && (
              <Archive className="inline w-3 h-3 mr-1 text-[var(--text-muted)]" />
            )}
            {session.folderPath}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5 pl-6">
            {formatRelativeTime(session.lastAccessedAt || session.updatedAt)}
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menuContentStyles}>
          {session.archived ? (
            <ContextMenu.Item className={menuItemStyles} onSelect={onUnarchive}>
              <ArchiveRestore className="w-4 h-4" />
              Unarchive
            </ContextMenu.Item>
          ) : (
            <ContextMenu.Item className={menuItemStyles} onSelect={onArchive}>
              <Archive className="w-4 h-4" />
              Archive
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

import type { ReactNode, ReactElement } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Archive, ArchiveRestore } from 'lucide-react'
import type { SessionWithExists } from '../../../../../shared/types/ipc'
import { menuContentStyles, menuItemStyles } from './SessionListItem'

interface SessionContextMenuProps {
  session: SessionWithExists
  trigger: ReactNode
  onArchive: () => void
  onUnarchive: () => void
}

export function SessionContextMenu({
  session,
  trigger,
  onArchive,
  onUnarchive
}: SessionContextMenuProps): ReactElement {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuContentStyles} sideOffset={5}>
          {session.archived ? (
            <DropdownMenu.Item className={menuItemStyles} onSelect={onUnarchive}>
              <ArchiveRestore className="w-4 h-4" />
              Unarchive
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item className={menuItemStyles} onSelect={onArchive}>
              <Archive className="w-4 h-4" />
              Archive
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

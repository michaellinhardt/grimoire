import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import type { Tab } from '@renderer/shared/store/useUIStore'
import type { ReactElement } from 'react'

interface Props {
  tab: Tab | null
  onClose: () => void
  onConfirm: (tabId: string) => void
}

export function CloseTabConfirmDialog({ tab, onClose, onConfirm }: Props): ReactElement | null {
  if (!tab) return null

  const handleConfirm = async (): Promise<void> => {
    try {
      if (tab.sessionId) {
        // Terminate the child process first
        await window.grimoireAPI.sessions.terminate(tab.sessionId)
      }
      onConfirm(tab.id)
      onClose()
    } catch (error) {
      // Log error but still close the tab - process may already be dead
      console.error('Failed to terminate session process:', error)
      onConfirm(tab.id)
      onClose()
    }
  }

  return (
    <Dialog.Root open={!!tab} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-[400px] p-6 rounded-[var(--radius-md)]',
            'bg-[var(--bg-elevated)] border border-[var(--border)]',
            'focus:outline-none'
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-[var(--text-primary)]">
            Close Working Session?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--text-muted)]">
            This session is still working. Closing it will terminate the running process.
          </Dialog.Description>

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cancel and keep session open"
                className={cn(
                  'px-4 py-2 rounded-[var(--radius-sm)]',
                  'bg-[var(--bg-hover)] text-[var(--text-primary)]',
                  'hover:bg-[var(--bg-base)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]'
                )}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              aria-label="Confirm close and terminate process"
              className={cn(
                'px-4 py-2 rounded-[var(--radius-sm)]',
                'bg-[var(--error)] text-white',
                'hover:opacity-90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]'
              )}
            >
              Close Anyway
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close dialog"
              className={cn(
                'absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm'
              )}
            >
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

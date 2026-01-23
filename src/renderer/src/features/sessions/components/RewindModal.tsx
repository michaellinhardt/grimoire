import { useState, type ReactElement, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'

export interface RewindModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Callback when user submits a rewind request */
  onRewind: (message: string) => Promise<void>
  /** Whether the rewind operation is in progress */
  isLoading?: boolean
  /** Error message to display */
  error?: string | null
  /** Optional key to force reset when modal reopens (used by ConversationView) */
  resetKey?: number
}

/**
 * Modal dialog for rewinding a conversation from a specific message.
 * Users can enter a new message to start an alternate conversation path.
 *
 * Uses Radix UI Dialog primitive for accessible modal behavior:
 * - Escape key closes the modal
 * - Click outside (overlay) closes the modal
 * - Focus is trapped inside the modal
 * - Text area is auto-focused on open
 *
 * @param open - Whether the modal is open
 * @param onOpenChange - Callback when open state changes
 * @param onRewind - Callback when user submits a rewind request
 * @param isLoading - Whether the rewind operation is in progress
 * @param error - Error message to display
 * @returns A rewind modal dialog element
 */
export function RewindModal({
  open,
  onOpenChange,
  onRewind,
  isLoading = false,
  error = null,
  resetKey
}: RewindModalProps): ReactElement {
  // Using resetKey to force state reset when modal reopens
  // The parent increments resetKey each time it opens the modal
  const [message, setMessage] = useState('')
  const [lastResetKey, setLastResetKey] = useState(resetKey)

  // Reset message when resetKey changes (parent opened modal)
  if (resetKey !== lastResetKey) {
    setMessage('')
    setLastResetKey(resetKey)
  }

  // Also reset message when modal opens using onOpenChange wrapper (for user interactions)
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        // Reset message when opening via user interaction
        setMessage('')
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  const handleSubmit = async (): Promise<void> => {
    const trimmed = message.trim()
    if (!trimmed || isLoading) return
    await onRewind(trimmed)
  }

  const canSubmit = message.trim().length > 0 && !isLoading

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          aria-label="Close modal"
        />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-[500px] bg-[var(--bg-elevated)] rounded-lg p-6 shadow-xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'focus:outline-none'
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Rewind Conversation
          </Dialog.Title>

          <Dialog.Description asChild>
            <p className="sr-only">
              Enter a new message to start an alternate conversation path from this point.
            </p>
          </Dialog.Description>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter new message..."
            className={cn(
              'w-full h-32 p-3 rounded-md resize-y',
              'bg-[var(--bg-base)] border border-[var(--border)]',
              'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            autoFocus
            disabled={isLoading}
            aria-label="New message"
          />

          {error && (
            <p className="mt-2 text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  'px-4 py-2 rounded-md transition-colors',
                  'bg-[var(--bg-base)] text-[var(--text-primary)]',
                  'hover:bg-[var(--bg-hover)]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
                disabled={isLoading}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'px-4 py-2 rounded-md transition-colors',
                'bg-[var(--accent)] text-white hover:opacity-90',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className={cn(
                'absolute top-4 right-4 p-1 rounded transition-colors',
                'hover:bg-[var(--bg-hover)]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
              )}
              aria-label="Close"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

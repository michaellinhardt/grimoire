import { Plus, MessageSquare } from 'lucide-react'
import type { ReactElement } from 'react'
import { useSessionStore } from '@renderer/features/sessions/store/useSessionStore'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { getSessionDisplayName } from '@renderer/shared/utils'

/**
 * Empty state view shown in middle panel when no tabs are open.
 * Displays a message prompting user to select or create a session,
 * with a prominent "New Session" button.
 */
export function EmptyStateView(): ReactElement {
  const handleNewSession = async (): Promise<void> => {
    try {
      const result = await window.grimoireAPI.dialog.selectFolder()
      if (result.canceled || !result.folderPath) return

      const { sessionId } = await window.grimoireAPI.sessions.create(result.folderPath)
      const displayName = getSessionDisplayName(result.folderPath)

      // Refresh session list to include new session
      // Use getState() for imperative calls in async handlers (prevents stale closures)
      useSessionStore.getState().loadSessions()

      // Open the new session in a tab
      useUIStore.getState().focusOrOpenSession(sessionId, displayName)
    } catch (error) {
      console.error('Failed to create new session:', error)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-elevated)] p-4">
      <MessageSquare className="w-12 h-12 text-[var(--text-muted)] mb-4" />
      <p className="text-sm text-[var(--text-muted)] mb-4">Select a session or start a new one</p>
      <button
        type="button"
        onClick={handleNewSession}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-[var(--radius-sm)] transition-colors"
        aria-label="New session"
        title="New session"
      >
        <Plus className="w-4 h-4" />
        New Session
      </button>
    </div>
  )
}

import type { ReactElement } from 'react'
import { Plus, Archive } from 'lucide-react'
import { PanelTopbar } from './PanelTopbar'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useSessionStore } from '@renderer/features/sessions/store/useSessionStore'
import { SessionList } from '@renderer/features/sessions/components'
import { getSessionDisplayName } from '@renderer/shared/utils/getSessionDisplayName'

export function LeftPanelContent(): ReactElement {
  const { setLeftPanelCollapsed, showArchived, setShowArchived } = useUIStore()

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
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <PanelTopbar title="Sessions" side="left" onCollapse={() => setLeftPanelCollapsed(true)}>
        {/* Action buttons in header - children are rendered between title and collapse button */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={handleNewSession}
            className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="New session"
            title="New session"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] ${
              showArchived ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
            } hover:text-[var(--text-primary)]`}
            aria-label={showArchived ? 'Hide archived sessions' : 'Show archived sessions'}
            aria-pressed={showArchived}
            title={showArchived ? 'Hide archived sessions' : 'Show archived sessions'}
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </PanelTopbar>
      <div className="flex-1 overflow-hidden">
        <SessionList />
      </div>
    </div>
  )
}

import { useUIStore } from '@renderer/shared/store/useUIStore'
import type { ReactElement } from 'react'

export function MiddlePanelContent(): ReactElement {
  const { tabs, activeTabId } = useUIStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // No tabs open - show empty state
  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-elevated)] p-4">
        <p className="text-sm text-[var(--text-muted)]">Select a session or create a new one</p>
      </div>
    )
  }

  // Tab with no sessionId (new unsaved session) - show empty conversation with placeholder
  if (!activeTab.sessionId) {
    return (
      <div className="flex-1 flex flex-col bg-[var(--bg-elevated)] p-4">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-muted)]">New session - start typing to begin</p>
        </div>
        {/* Chat input placeholder - will be implemented in Epic 3a */}
        <div className="h-12 border-t border-[var(--border)] flex items-center px-4">
          <div className="flex-1 h-8 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] px-3 flex items-center">
            <span className="text-sm text-[var(--text-muted)]">
              Type a message... (input coming in Epic 3a)
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Tab with sessionId - show session conversation placeholder
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)] p-4">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">
          Session: {activeTab.title} (conversation rendering in Epic 2b)
        </p>
      </div>
      {/* Chat input placeholder - will be implemented in Epic 3a */}
      <div className="h-12 border-t border-[var(--border)] flex items-center px-4">
        <div className="flex-1 h-8 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] px-3 flex items-center">
          <span className="text-sm text-[var(--text-muted)]">
            Type a message... (input coming in Epic 3a)
          </span>
        </div>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import {
  ChatInputPlaceholder,
  EmptyStateView,
  NewSessionView,
  ConversationView,
  createMockMessages
} from '@renderer/features/sessions/components'
import type { ReactElement } from 'react'

export function MiddlePanelContent(): ReactElement {
  const { tabs, activeTabId } = useUIStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Create mock messages once per component mount (stable reference prevents re-renders)
  // Will be replaced by real data from session file in Epic 3b
  const mockMessages = useMemo(() => createMockMessages(), [])

  // No tabs open - show empty state with New Session button
  if (!activeTab) {
    return <EmptyStateView />
  }

  // Tab with no sessionId (new unsaved session) - show empty conversation with placeholder
  if (!activeTab.sessionId) {
    return <NewSessionView />
  }

  // Sub-agent tabs are read-only - show conversation without chat input
  const isSubAgentTab = activeTab.type === 'subagent'

  // Tab with sessionId - show session conversation
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)]">
      {/* ConversationView fills remaining space - min-h-0 critical for flex overflow */}
      <div className="flex-1 min-h-0">
        <ConversationView
          messages={mockMessages}
          sessionId={activeTab.sessionId}
          sessionState={activeTab.sessionState}
        />
      </div>
      {/* Chat input placeholder - will be implemented in Epic 3a */}
      {/* NOTE: Sub-agent tabs hide chat input (read-only view) */}
      {/* NOTE: Existing sessions do NOT auto-focus per UX spec (only new sessions auto-focus) */}
      {!isSubAgentTab && <ChatInputPlaceholder placeholder="Type your message..." />}
    </div>
  )
}

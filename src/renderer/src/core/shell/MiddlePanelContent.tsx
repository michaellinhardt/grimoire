import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import {
  useSessionStore,
  selectSessionById
} from '@renderer/features/sessions/store/useSessionStore'
import { useConversationStore } from '@renderer/features/sessions/store/useConversationStore'
import { useSendMessage } from '@renderer/features/sessions/hooks/useSendMessage'
import {
  ChatInput,
  EmptyStateView,
  NewSessionView,
  ConversationView,
  createMockMessages
} from '@renderer/features/sessions/components'
import type { ConversationMessage } from '@renderer/features/sessions/components/types'

export function MiddlePanelContent(): ReactElement {
  const { tabs, activeTabId } = useUIStore()
  const { sessions } = useSessionStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Get session details for folder path
  const session = activeTab?.sessionId
    ? selectSessionById(sessions, activeTab.sessionId)
    : undefined

  // Get messages from conversation store (falls back to mock for development)
  const storeMessages = useConversationStore((state) =>
    activeTab?.sessionId ? state.getMessages(activeTab.sessionId) : []
  )

  // Use mock messages until we have real data (Epic 3b)
  // Once messages exist in store, use those instead
  const mockMessages = useMemo(() => createMockMessages(), [])
  const displayMessages = storeMessages.length > 0 ? storeMessages : mockMessages

  // Setup send message hook
  const { sendMessage } = useSendMessage({
    sessionId: activeTab?.sessionId ?? null,
    tabId: activeTab?.id ?? '',
    folderPath: session?.folderPath
  })

  // No tabs open - show empty state with New Session button
  if (!activeTab) {
    return <EmptyStateView />
  }

  // Tab with no sessionId (new unsaved session) - show empty conversation with placeholder
  if (!activeTab.sessionId) {
    return <NewSessionView />
  }

  // Sub-agent tabs are read-only - show conversation without chat input
  // TODO: Determine if 'file' tab type should also hide chat input (architectural debt from type definition)
  const isSubAgentTab = activeTab.type === 'subagent'

  // Tab with sessionId - show session conversation
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)]">
      {/* ConversationView fills remaining space - min-h-0 critical for flex overflow */}
      <div className="flex-1 min-h-0">
        <ConversationView
          messages={displayMessages as ConversationMessage[]}
          sessionId={activeTab.sessionId}
          sessionState={activeTab.sessionState}
        />
      </div>
      {/* Chat input - sub-agent tabs hide this (read-only view) */}
      {/* NOTE: Existing sessions do NOT auto-focus per UX spec (only new sessions auto-focus) */}
      {!isSubAgentTab && (
        <ChatInput
          onSend={sendMessage}
          autoFocus={false}
          hasMessages={displayMessages.length > 0}
          disabled={activeTab.sessionState === 'working'}
        />
      )}
    </div>
  )
}

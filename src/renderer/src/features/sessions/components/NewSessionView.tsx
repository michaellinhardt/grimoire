import { type ReactElement } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { useSendMessage } from '../hooks/useSendMessage'
import { ChatInput } from './ChatInput'

/**
 * View for a new session with no messages yet.
 * Shows empty conversation area with chat input.
 *
 * NOTE: New sessions require a folder path for CC spawn.
 * Current flow: User selects folder via "New Session" button -> session created -> tab opens.
 * This view is shown when tab has no sessionId (folder selected but not yet started).
 */
export function NewSessionView(): ReactElement {
  const { tabs, activeTabId } = useUIStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Note: For new sessions, folderPath must come from tab context or dialog
  // Currently, the "New Session" flow creates a session with a selected folder
  // This placeholder handles the edge case where no folder is yet selected
  const { sendMessage } = useSendMessage({
    sessionId: null,
    tabId: activeTab?.id ?? '',
    // TODO: folderPath should come from tab context once Tab interface is extended
    // For now, new sessions require the "New Session" button flow which provides folder
    folderPath: undefined
  })

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)]">
      {/* Conversation area - sub-agent index will appear here during streaming (Epic 2b) */}
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">New session - start typing to begin</p>
      </div>
      {/* ChatInput with auto-focus for new sessions (UX11) */}
      <ChatInput
        onSend={sendMessage}
        autoFocus={true}
        hasMessages={false}
        disabled={false}
        placeholder="Type your message..."
      />
    </div>
  )
}

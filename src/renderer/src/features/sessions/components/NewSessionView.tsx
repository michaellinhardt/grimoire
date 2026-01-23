import type { ReactElement } from 'react'
import { ChatInputPlaceholder } from './ChatInputPlaceholder'

/**
 * View for a new session with no messages yet.
 * Shows empty conversation area with placeholder input.
 * Sub-agent index will appear during streaming (Epic 2b - AC3).
 */
export function NewSessionView(): ReactElement {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-elevated)]">
      {/* Conversation area - sub-agent index will appear here during streaming (Epic 2b) */}
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">New session - start typing to begin</p>
      </div>
      {/* ChatInput placeholder - will be replaced with actual ChatInput in Epic 3a */}
      {/* autoFocus indicates this input should be focused when implemented (UX11) */}
      <ChatInputPlaceholder autoFocus placeholder="Type your message..." />
    </div>
  )
}

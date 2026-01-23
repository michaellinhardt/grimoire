import { useRef, useEffect, useCallback, useState, useMemo, type ReactElement } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { MessageBubble } from './MessageBubble'
import { ToolCallCard } from './ToolCallCard'
import { SubAgentBubble } from './SubAgentBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { LoadingIndicator } from './LoadingIndicator'
import { RewindModal } from './RewindModal'
import { StreamingMessageBubble } from './StreamingMessageBubble'
import { JumpToLatestButton } from './JumpToLatestButton'
import { useUIStore, type SessionState } from '@renderer/shared/store/useUIStore'
import { findToolResult } from '@renderer/shared/utils/pairToolCalls'
import { formatMessageTimestamp } from '@renderer/shared/utils/formatMessageTimestamp'
import { cn } from '@renderer/shared/utils/cn'
import { useActiveTimelineEvent } from '../hooks/useActiveTimelineEvent'
import { useStreamingMessage } from '../hooks/useStreamingMessage'
import type { ConversationMessage, SubAgentBlock } from './types'
import type { DisplayMessage, SystemMessage } from '../store/useConversationStore'

// Type guard for system messages (abort/error) - Story 3a-4
// SystemMessage has type: 'system', ConversationMessage has role: 'user' | 'assistant'
function isSystemMessage(msg: DisplayMessage): msg is SystemMessage {
  return 'type' in msg && msg.type === 'system'
}

export interface ConversationViewProps {
  /** Array of conversation messages to display (including system messages) */
  messages: DisplayMessage[]
  /** Session ID for scroll position persistence */
  sessionId: string
  /** Session state for loading/thinking indicators */
  sessionState?: SessionState
  /** Callback for scroll-to-event functionality */
  onScrollToEventRef?: (scrollFn: (eventUuid: string) => void) => void
  /** Callback when user initiates a rewind (Story 2b.5) */
  onRewind?: (checkpointUuid: string, newMessage: string) => Promise<void>
}

/**
 * Scrollable conversation view with message bubbles.
 * Features smart auto-scroll and scroll position persistence per session.
 *
 * @param messages - Array of conversation messages to display
 * @param sessionId - Session ID for scroll position persistence
 * @returns A scrollable conversation view element
 */
export function ConversationView({
  messages,
  sessionId,
  sessionState = 'idle',
  onScrollToEventRef,
  onRewind
}: ConversationViewProps): ReactElement {
  const viewportRef = useRef<HTMLDivElement>(null)
  const isInitialMount = useRef(true)
  const lastMessageCountRef = useRef(messages.length)

  // Track message element refs for scroll-to-event functionality
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Streaming state from hook (Story 3a-3)
  const {
    content: streamingContent,
    isStreaming: isActivelyStreaming,
    pendingToolCalls,
    completedToolCalls
  } = useStreamingMessage(sessionId)

  // Use actual streaming state (Story 3a-3)
  const isStreaming = isActivelyStreaming

  // Track if user manually scrolled up during streaming (Story 3a-3)
  const [userScrolledUp, setUserScrolledUp] = useState(false)

  const { getScrollPosition, setScrollPosition, openSubAgentTab, setScrollToConversationEvent } =
    useUIStore()

  // Highlight state for scroll-to-event animation (Story 2c-3)
  const [highlightedUuid, setHighlightedUuid] = useState<string | null>(null)

  // Track message UUIDs for scroll sync (Story 2c-3)
  const messageUuids = useMemo(() => messages.map((m) => m.uuid), [messages])

  // Track active message in viewport for timeline sync (Story 2c-3)
  useActiveTimelineEvent(viewportRef, messageUuids)

  // Track which tool cards are expanded
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  // Track which sub-agent bubbles are expanded (Story 2b.3)
  const [expandedSubAgents, setExpandedSubAgents] = useState<Set<string>>(new Set())

  // Rewind modal state (Story 2b.5)
  const [rewindModalOpen, setRewindModalOpen] = useState(false)
  const [rewindCheckpointUuid, setRewindCheckpointUuid] = useState<string | null>(null)
  const [rewindLoading, setRewindLoading] = useState(false)
  const [rewindError, setRewindError] = useState<string | null>(null)
  const [rewindResetKey, setRewindResetKey] = useState(0)

  const toggleTool = useCallback((toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }, [])

  const toggleSubAgent = useCallback((agentId: string) => {
    setExpandedSubAgents((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
      return next
    })
  }, [])

  const handleOpenInTab = useCallback(
    (subAgent: SubAgentBlock) => {
      openSubAgentTab(subAgent)
    },
    [openSubAgentTab]
  )

  // Open rewind modal when rewind icon is clicked (Story 2b.5)
  const handleRewindClick = useCallback((messageUuid: string) => {
    setRewindCheckpointUuid(messageUuid)
    setRewindError(null)
    setRewindResetKey((k) => k + 1) // Force message reset in RewindModal
    setRewindModalOpen(true)
  }, [])

  // Handle rewind submission (Story 2b.5)
  const handleRewindSubmit = useCallback(
    async (newMessage: string) => {
      if (!rewindCheckpointUuid || !onRewind) return

      setRewindLoading(true)
      setRewindError(null)

      try {
        await onRewind(rewindCheckpointUuid, newMessage)
        setRewindModalOpen(false)
        setRewindCheckpointUuid(null)
      } catch (err) {
        setRewindError(err instanceof Error ? err.message : 'Failed to rewind conversation')
      } finally {
        setRewindLoading(false)
      }
    },
    [rewindCheckpointUuid, onRewind]
  )

  // Scroll to a specific event/message by UUID with highlight animation (Story 2c-3)
  const scrollToEvent = useCallback((eventUuid: string) => {
    const element = messageRefs.current.get(eventUuid)
    if (element) {
      // Browser handles smooth scroll timing (~300ms)
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Apply highlight animation
      setHighlightedUuid(eventUuid)

      // Remove highlight after 500ms
      setTimeout(() => {
        setHighlightedUuid(null)
      }, 500)
    }
  }, [])

  // Check if user is near bottom (within 100px)
  const isNearBottom = useCallback((): boolean => {
    if (!viewportRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = viewportRef.current
    return scrollHeight - scrollTop - clientHeight < 100
  }, [])

  // Scroll to bottom helper
  const scrollToBottom = useCallback((): void => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [])

  // Handle initial mount and scroll restoration
  useEffect(() => {
    if (!viewportRef.current) return

    if (isInitialMount.current) {
      isInitialMount.current = false
      const savedPosition = getScrollPosition(sessionId)

      if (savedPosition > 0) {
        // Restore saved position
        viewportRef.current.scrollTop = savedPosition
      } else {
        // Initial load with no saved position - scroll to bottom
        scrollToBottom()
      }
      lastMessageCountRef.current = messages.length
      return
    }

    // Check if new messages were added
    if (messages.length > lastMessageCountRef.current) {
      // Only auto-scroll if user is near bottom
      if (isNearBottom()) {
        scrollToBottom()
      }
      lastMessageCountRef.current = messages.length
    }
  }, [messages, sessionId, getScrollPosition, isNearBottom, scrollToBottom])

  // Reset initial mount flag when sessionId changes (NOT when messages change)
  useEffect(() => {
    isInitialMount.current = true
    lastMessageCountRef.current = messages.length
    // Reset expanded tools, sub-agents, message refs, and rewind state when switching sessions
    setExpandedTools(new Set())
    setExpandedSubAgents(new Set())
    messageRefs.current.clear()
    setUserScrolledUp(false)
    // Reset rewind modal state (Story 2b.5)
    setRewindModalOpen(false)
    setRewindCheckpointUuid(null)
    setRewindError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset on sessionId change, not messages
  }, [sessionId])

  // Expose scrollToEvent function to parent via callback ref
  useEffect(() => {
    if (onScrollToEventRef) {
      onScrollToEventRef(scrollToEvent)
    }
  }, [onScrollToEventRef, scrollToEvent])

  // Register scroll function to store for cross-component access (Story 2c-3)
  useEffect(() => {
    setScrollToConversationEvent(scrollToEvent)
    return () => setScrollToConversationEvent(null)
  }, [scrollToEvent, setScrollToConversationEvent])

  // Handle streaming auto-scroll (Story 3a-3)
  useEffect(() => {
    if (isStreaming && isNearBottom() && !userScrolledUp) {
      scrollToBottom()
    }
  }, [streamingContent, isStreaming, isNearBottom, userScrolledUp, scrollToBottom])

  // Ref to store debounce timeout for cleanup on unmount
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup debounce timeout on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Handle jump to latest click (Story 3a-3)
  const handleJumpToLatest = useCallback(() => {
    scrollToBottom()
    setUserScrolledUp(false)
  }, [scrollToBottom])

  // Save scroll position on scroll (debounced to reduce state updates during rapid scrolling)
  const handleScroll = useCallback((): void => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      if (viewportRef.current) {
        setScrollPosition(sessionId, viewportRef.current.scrollTop)
      }
    }, 100)

    // Track user scroll-away during streaming (Story 3a-3)
    if (isStreaming && viewportRef.current) {
      const atBottom = isNearBottom()
      if (!atBottom && !userScrolledUp) {
        setUserScrolledUp(true)
      } else if (atBottom && userScrolledUp) {
        setUserScrolledUp(false)
      }
    }
  }, [sessionId, setScrollPosition, isStreaming, isNearBottom, userScrolledUp])

  return (
    <ScrollArea.Root className="h-full w-full">
      <ScrollArea.Viewport ref={viewportRef} className="h-full w-full" onScroll={handleScroll}>
        <div className="flex flex-col space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm">
              Messages will appear as the conversation progresses.
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                // Handle system messages first (abort/error) - Story 3a-4
                if (isSystemMessage(msg)) {
                  return (
                    <div
                      key={msg.uuid}
                      data-message-uuid={msg.uuid}
                      className={cn(
                        'flex justify-center py-2',
                        highlightedUuid === msg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
                      )}
                      ref={(el) => {
                        if (el) messageRefs.current.set(msg.uuid, el)
                      }}
                    >
                      <span
                        className={cn(
                          'text-sm italic px-3 py-1 rounded-full',
                          msg.isError
                            ? 'text-red-400 bg-red-500/10'
                            : 'text-[var(--text-muted)] bg-[var(--bg-hover)]'
                        )}
                      >
                        {msg.content}
                      </span>
                    </div>
                  )
                }

                // Cast to ConversationMessage after type guard check
                const convMsg = msg as ConversationMessage

                // Check if message has tool use blocks or sub-agent blocks (assistant messages only)
                const hasTools =
                  convMsg.role === 'assistant' &&
                  convMsg.toolUseBlocks &&
                  convMsg.toolUseBlocks.length > 0
                const hasSubAgents =
                  convMsg.role === 'assistant' &&
                  convMsg.subAgentBlocks &&
                  convMsg.subAgentBlocks.length > 0

                if (hasTools || hasSubAgents) {
                  // Filter out Task and Skill tool calls when corresponding sub-agent exists
                  // This prevents duplicate UI: showing both ToolCallCard AND SubAgentBubble for same spawn
                  const toolsToRender =
                    hasSubAgents && hasTools
                      ? convMsg.toolUseBlocks!.filter(
                          (tool) => tool.name !== 'Task' && tool.name !== 'Skill'
                        )
                      : (convMsg.toolUseBlocks ?? [])

                  return (
                    <div
                      key={convMsg.uuid}
                      data-message-uuid={convMsg.uuid}
                      className={cn(
                        'transition-all duration-300',
                        highlightedUuid === convMsg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
                      )}
                      ref={(el) => {
                        if (el) messageRefs.current.set(convMsg.uuid, el)
                      }}
                    >
                      {/* Render text content first if present */}
                      {convMsg.content && (
                        <MessageBubble
                          role="assistant"
                          content={convMsg.content}
                          timestamp={convMsg.timestamp}
                        />
                      )}
                      {/* Render tool call cards */}
                      {toolsToRender.map((tool) => (
                        <ToolCallCard
                          key={tool.id}
                          toolCall={tool}
                          result={findToolResult(tool.id, convMsg.toolResults)}
                          isExpanded={expandedTools.has(tool.id)}
                          onToggle={() => toggleTool(tool.id)}
                        />
                      ))}
                      {/* Render sub-agent bubbles (Story 2b.3) */}
                      {convMsg.subAgentBlocks?.map((subAgent) => (
                        <SubAgentBubble
                          key={subAgent.id}
                          subAgent={subAgent}
                          isExpanded={expandedSubAgents.has(subAgent.id)}
                          onToggle={() => toggleSubAgent(subAgent.id)}
                          onOpenInTab={() => handleOpenInTab(subAgent)}
                        />
                      ))}
                      {/* Show timestamp for tool/agent-only messages (no text content) */}
                      {!convMsg.content && (
                        <span className="text-xs text-[var(--text-muted)] ml-1">
                          {formatMessageTimestamp(convMsg.timestamp)}
                        </span>
                      )}
                    </div>
                  )
                }

                // Regular message without tool blocks or sub-agents
                return (
                  <div
                    key={convMsg.uuid}
                    data-message-uuid={convMsg.uuid}
                    className={cn(
                      'transition-all duration-300',
                      highlightedUuid === convMsg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
                    )}
                    ref={(el) => {
                      if (el) messageRefs.current.set(convMsg.uuid, el)
                    }}
                  >
                    <MessageBubble
                      role={convMsg.role}
                      content={convMsg.content}
                      timestamp={convMsg.timestamp}
                      messageIndex={index}
                      onRewind={
                        convMsg.role === 'user' && onRewind
                          ? () => handleRewindClick(convMsg.uuid)
                          : undefined
                      }
                    />
                  </div>
                )
              })}
            </>
          )}

          {/* Streaming message bubble (Story 3a-3) */}
          {isStreaming && <StreamingMessageBubble content={streamingContent} isStreaming={true} />}

          {/* Pending tool calls during streaming (Story 3a-3) */}
          {pendingToolCalls.map((tool) => (
            <ToolCallCard
              key={tool.id}
              toolCall={tool}
              result={null}
              isExpanded={expandedTools.has(tool.id)}
              onToggle={() => toggleTool(tool.id)}
            />
          ))}

          {/* Completed tool calls during streaming (Story 3a-3) */}
          {completedToolCalls.map(({ call, result }) => (
            <ToolCallCard
              key={call.id}
              toolCall={call}
              result={result}
              isExpanded={expandedTools.has(call.id)}
              onToggle={() => toggleTool(call.id)}
            />
          ))}

          {/* Loading/Thinking indicators at the END of messages list */}
          {sessionState === 'working' && !isStreaming && <LoadingIndicator />}
          {sessionState === 'working' && isStreaming && <ThinkingIndicator />}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        aria-label="Conversation scroll"
        className="flex touch-none select-none p-0.5 transition-colors bg-transparent hover:bg-[var(--bg-hover)]"
      >
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--text-muted)] opacity-50 hover:opacity-75" />
      </ScrollArea.Scrollbar>

      {/* Jump to latest button (Story 3a-3) */}
      <JumpToLatestButton visible={isStreaming && userScrolledUp} onClick={handleJumpToLatest} />

      {/* Rewind Modal (Story 2b.5) */}
      <RewindModal
        open={rewindModalOpen}
        onOpenChange={setRewindModalOpen}
        onRewind={handleRewindSubmit}
        isLoading={rewindLoading}
        error={rewindError}
        resetKey={rewindResetKey}
      />
    </ScrollArea.Root>
  )
}

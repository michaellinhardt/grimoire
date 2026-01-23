import { useRef, useEffect, useCallback, useState, useMemo, type ReactElement } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { MessageBubble } from './MessageBubble'
import { ToolCallCard } from './ToolCallCard'
import { SubAgentBubble } from './SubAgentBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { LoadingIndicator } from './LoadingIndicator'
import { RewindModal } from './RewindModal'
import { useUIStore, type SessionState } from '@renderer/shared/store/useUIStore'
import { findToolResult } from '@renderer/shared/utils/pairToolCalls'
import { formatMessageTimestamp } from '@renderer/shared/utils/formatMessageTimestamp'
import { cn } from '@renderer/shared/utils/cn'
import { useActiveTimelineEvent } from '../hooks/useActiveTimelineEvent'
import type { ConversationMessage, SubAgentBlock } from './types'

export interface ConversationViewProps {
  /** Array of conversation messages to display */
  messages: ConversationMessage[]
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

  // Track streaming state for Loading->Thinking transition
  // MVP NOTE: With request-response model, this will be refined in Epic 3b
  const [isStreaming, setIsStreaming] = useState(false)

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
    setIsStreaming(false)
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

  // Simulate streaming detection for Loading->Thinking transition
  // MVP NOTE: With request-response model, this simulates the transition
  // Real streaming detection will be implemented in Epic 3b
  useEffect(() => {
    if (sessionState === 'working' && messages.length > 0) {
      // Consider "streaming" once we have at least one message while working
      setIsStreaming(true)
    } else if (sessionState === 'idle') {
      setIsStreaming(false)
    }
  }, [sessionState, messages.length])

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
  }, [sessionId, setScrollPosition])

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
                // Check if message has tool use blocks or sub-agent blocks (assistant messages only)
                const hasTools =
                  msg.role === 'assistant' && msg.toolUseBlocks && msg.toolUseBlocks.length > 0
                const hasSubAgents =
                  msg.role === 'assistant' && msg.subAgentBlocks && msg.subAgentBlocks.length > 0

                if (hasTools || hasSubAgents) {
                  // Filter out Task and Skill tool calls when corresponding sub-agent exists
                  // This prevents duplicate UI: showing both ToolCallCard AND SubAgentBubble for same spawn
                  const toolsToRender =
                    hasSubAgents && hasTools
                      ? msg.toolUseBlocks!.filter(
                          (tool) => tool.name !== 'Task' && tool.name !== 'Skill'
                        )
                      : (msg.toolUseBlocks ?? [])

                  return (
                    <div
                      key={msg.uuid}
                      data-message-uuid={msg.uuid}
                      className={cn(
                        'transition-all duration-300',
                        highlightedUuid === msg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
                      )}
                      ref={(el) => {
                        if (el) messageRefs.current.set(msg.uuid, el)
                      }}
                    >
                      {/* Render text content first if present */}
                      {msg.content && (
                        <MessageBubble
                          role="assistant"
                          content={msg.content}
                          timestamp={msg.timestamp}
                        />
                      )}
                      {/* Render tool call cards */}
                      {toolsToRender.map((tool) => (
                        <ToolCallCard
                          key={tool.id}
                          toolCall={tool}
                          result={findToolResult(tool.id, msg.toolResults)}
                          isExpanded={expandedTools.has(tool.id)}
                          onToggle={() => toggleTool(tool.id)}
                        />
                      ))}
                      {/* Render sub-agent bubbles (Story 2b.3) */}
                      {msg.subAgentBlocks?.map((subAgent) => (
                        <SubAgentBubble
                          key={subAgent.id}
                          subAgent={subAgent}
                          isExpanded={expandedSubAgents.has(subAgent.id)}
                          onToggle={() => toggleSubAgent(subAgent.id)}
                          onOpenInTab={() => handleOpenInTab(subAgent)}
                        />
                      ))}
                      {/* Show timestamp for tool/agent-only messages (no text content) */}
                      {!msg.content && (
                        <span className="text-xs text-[var(--text-muted)] ml-1">
                          {formatMessageTimestamp(msg.timestamp)}
                        </span>
                      )}
                    </div>
                  )
                }

                // Regular message without tool blocks or sub-agents
                return (
                  <div
                    key={msg.uuid}
                    data-message-uuid={msg.uuid}
                    className={cn(
                      'transition-all duration-300',
                      highlightedUuid === msg.uuid && 'ring-2 ring-[var(--accent)] rounded-lg'
                    )}
                    ref={(el) => {
                      if (el) messageRefs.current.set(msg.uuid, el)
                    }}
                  >
                    <MessageBubble
                      role={msg.role}
                      content={msg.content}
                      timestamp={msg.timestamp}
                      messageIndex={index}
                      onRewind={
                        msg.role === 'user' && onRewind
                          ? () => handleRewindClick(msg.uuid)
                          : undefined
                      }
                    />
                  </div>
                )
              })}
            </>
          )}

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

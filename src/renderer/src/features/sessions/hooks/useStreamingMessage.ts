import { useState, useEffect, useCallback } from 'react'
import type { ToolUseBlock, ToolResultBlock } from '../components/types'

interface StreamingState {
  content: string
  isStreaming: boolean
  pendingToolCalls: ToolUseBlock[]
  completedToolCalls: Array<{ call: ToolUseBlock; result: ToolResultBlock }>
  orphanedToolResults: Record<string, ToolResultBlock>
  error: string | null
}

export interface UseStreamingMessageResult extends StreamingState {
  /** Reset streaming state for new stream */
  reset: () => void
}

/**
 * Hook for managing streaming message state.
 * Subscribes to IPC streaming events and accumulates content.
 *
 * @param sessionId - Session ID to listen for streaming events
 * @returns Streaming state and control functions
 */
export function useStreamingMessage(sessionId: string | null): UseStreamingMessageResult {
  const [state, setState] = useState<StreamingState>({
    content: '',
    isStreaming: false,
    pendingToolCalls: [],
    completedToolCalls: [],
    orphanedToolResults: {},
    error: null
  })

  const reset = useCallback(() => {
    setState({
      content: '',
      isStreaming: false,
      pendingToolCalls: [],
      completedToolCalls: [],
      orphanedToolResults: {},
      error: null
    })
  }, [])

  useEffect(() => {
    if (!sessionId) return

    // Subscribe to chunk events
    const unsubChunk = window.grimoireAPI.sessions.onStreamChunk((event) => {
      if (event.sessionId !== sessionId) return
      setState((prev) => ({
        ...prev,
        content: prev.content + event.content,
        isStreaming: true
      }))
    })

    // Subscribe to tool events
    const unsubTool = window.grimoireAPI.sessions.onStreamTool((event) => {
      if (event.sessionId !== sessionId) return

      if (event.type === 'tool_use' && event.toolUse) {
        const toolUse = event.toolUse as ToolUseBlock
        setState((prev) => {
          const newState = {
            ...prev,
            pendingToolCalls: [...prev.pendingToolCalls, toolUse]
          }

          // Check if we have an orphaned result for this tool
          const orphanedResult = prev.orphanedToolResults[toolUse.id]
          if (orphanedResult) {
            // Immediately complete this tool with the orphaned result
            const newOrphaned = { ...prev.orphanedToolResults }
            delete newOrphaned[toolUse.id]

            return {
              ...newState,
              pendingToolCalls: newState.pendingToolCalls.filter((t) => t.id !== toolUse.id),
              completedToolCalls: [
                ...prev.completedToolCalls,
                { call: toolUse, result: orphanedResult }
              ],
              orphanedToolResults: newOrphaned
            }
          }

          return newState
        })
      } else if (event.type === 'tool_result' && event.toolResult) {
        const toolResult = event.toolResult as ToolResultBlock
        setState((prev) => {
          const matchingTool = prev.pendingToolCalls.find((t) => t.id === toolResult.tool_use_id)
          if (!matchingTool) {
            // Store orphaned result for later matching (handles out-of-order events)
            return {
              ...prev,
              orphanedToolResults: {
                ...prev.orphanedToolResults,
                [toolResult.tool_use_id]: toolResult
              }
            }
          }

          return {
            ...prev,
            pendingToolCalls: prev.pendingToolCalls.filter((t) => t.id !== toolResult.tool_use_id),
            completedToolCalls: [
              ...prev.completedToolCalls,
              { call: matchingTool, result: toolResult }
            ]
          }
        })
      }
    })

    // Subscribe to end events
    const unsubEnd = window.grimoireAPI.sessions.onStreamEnd((event) => {
      if (event.sessionId !== sessionId) return
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: event.success ? null : (event.error ?? 'Stream ended with error')
      }))
    })

    // Cleanup all subscriptions on unmount
    return () => {
      unsubChunk()
      unsubTool()
      unsubEnd()
    }
  }, [sessionId])

  return { ...state, reset }
}

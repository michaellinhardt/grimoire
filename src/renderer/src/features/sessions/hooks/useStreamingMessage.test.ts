import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreamingMessage } from './useStreamingMessage'

describe('useStreamingMessage', () => {
  const mockSessionId = 'test-session-123'
  let chunkCallback: ((event: unknown) => void) | null = null
  let toolCallback: ((event: unknown) => void) | null = null
  let endCallback: ((event: unknown) => void) | null = null

  beforeEach(() => {
    const mockOnStreamChunk = vi.fn((cb) => {
      chunkCallback = cb
      return vi.fn()
    })
    const mockOnStreamTool = vi.fn((cb) => {
      toolCallback = cb
      return vi.fn()
    })
    const mockOnStreamEnd = vi.fn((cb) => {
      endCallback = cb
      return vi.fn()
    })

    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          onStreamChunk: mockOnStreamChunk,
          onStreamTool: mockOnStreamTool,
          onStreamEnd: mockOnStreamEnd
        }
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    chunkCallback = null
    toolCallback = null
    endCallback = null
  })

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    expect(result.current.content).toBe('')
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.pendingToolCalls).toEqual([])
    expect(result.current.completedToolCalls).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('accumulates content from chunk events', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'Hello ' })
    })

    expect(result.current.content).toBe('Hello ')
    expect(result.current.isStreaming).toBe(true)

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'world!' })
    })

    expect(result.current.content).toBe('Hello world!')
  })

  it('ignores events for different session', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: 'other-session', type: 'text', content: 'Ignored' })
    })

    expect(result.current.content).toBe('')
  })

  it('tracks tool use events', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    const toolUse = {
      type: 'tool_use' as const,
      id: 'tool-1',
      name: 'Read',
      input: { file_path: '/test.ts' }
    }

    act(() => {
      toolCallback?.({ sessionId: mockSessionId, type: 'tool_use', toolUse })
    })

    expect(result.current.pendingToolCalls).toHaveLength(1)
    expect(result.current.pendingToolCalls[0].id).toBe('tool-1')
  })

  it('moves tool to completed when result arrives', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    const toolUse = {
      type: 'tool_use' as const,
      id: 'tool-1',
      name: 'Read',
      input: { file_path: '/test.ts' }
    }

    const toolResult = {
      type: 'tool_result' as const,
      tool_use_id: 'tool-1',
      content: 'File contents here'
    }

    act(() => {
      toolCallback?.({ sessionId: mockSessionId, type: 'tool_use', toolUse })
    })

    expect(result.current.pendingToolCalls).toHaveLength(1)
    expect(result.current.completedToolCalls).toHaveLength(0)

    act(() => {
      toolCallback?.({ sessionId: mockSessionId, type: 'tool_result', toolResult })
    })

    expect(result.current.pendingToolCalls).toHaveLength(0)
    expect(result.current.completedToolCalls).toHaveLength(1)
    expect(result.current.completedToolCalls[0].call.id).toBe('tool-1')
    expect(result.current.completedToolCalls[0].result.content).toBe('File contents here')
  })

  it('handles stream end event', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'Content' })
    })

    expect(result.current.isStreaming).toBe(true)

    act(() => {
      endCallback?.({ sessionId: mockSessionId, success: true })
    })

    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets error on failed stream end', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      endCallback?.({ sessionId: mockSessionId, success: false, error: 'Network error' })
    })

    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBe('Network error')
  })

  it('sets default error message when error not provided', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      endCallback?.({ sessionId: mockSessionId, success: false })
    })

    expect(result.current.error).toBe('Stream ended with error')
  })

  it('resets state with reset function', () => {
    const { result } = renderHook(() => useStreamingMessage(mockSessionId))

    act(() => {
      chunkCallback?.({ sessionId: mockSessionId, type: 'text', content: 'Content' })
    })

    expect(result.current.content).toBe('Content')

    act(() => {
      result.current.reset()
    })

    expect(result.current.content).toBe('')
    expect(result.current.isStreaming).toBe(false)
  })

  it('cleans up listeners on unmount', () => {
    const cleanupChunk = vi.fn()
    const cleanupTool = vi.fn()
    const cleanupEnd = vi.fn()

    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          onStreamChunk: vi.fn(() => cleanupChunk),
          onStreamTool: vi.fn(() => cleanupTool),
          onStreamEnd: vi.fn(() => cleanupEnd)
        }
      }
    })

    const { unmount } = renderHook(() => useStreamingMessage(mockSessionId))

    unmount()

    expect(cleanupChunk).toHaveBeenCalled()
    expect(cleanupTool).toHaveBeenCalled()
    expect(cleanupEnd).toHaveBeenCalled()
  })

  it('does not subscribe when sessionId is null', () => {
    const mockOnStreamChunk = vi.fn(() => vi.fn())

    vi.stubGlobal('window', {
      grimoireAPI: {
        sessions: {
          onStreamChunk: mockOnStreamChunk,
          onStreamTool: vi.fn(() => vi.fn()),
          onStreamEnd: vi.fn(() => vi.fn())
        }
      }
    })

    renderHook(() => useStreamingMessage(null))

    expect(mockOnStreamChunk).not.toHaveBeenCalled()
  })
})

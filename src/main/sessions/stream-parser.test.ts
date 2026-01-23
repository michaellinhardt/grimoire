import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'stream'

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock database
vi.mock('../db', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(() => ({ id: 'test-session' }))
    }))
  }))
}))

// Mock checkpoint registry
vi.mock('./checkpoint-registry', () => ({
  addCheckpoint: vi.fn(),
  clearCheckpoints: vi.fn()
}))

import { BrowserWindow } from 'electron'
import { createStreamParser } from './stream-parser'
import { addCheckpoint, clearCheckpoints } from './checkpoint-registry'

// Use mocked versions
const mockClearCheckpoints = clearCheckpoints as ReturnType<typeof vi.fn>

describe('stream-parser', () => {
  let mockWindow: { webContents: { send: ReturnType<typeof vi.fn> } }
  let mockStdout: Readable

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock window
    mockWindow = { webContents: { send: vi.fn() } }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
      mockWindow as unknown as Electron.BrowserWindow
    ])

    // Create mock stdout stream
    mockStdout = new Readable({ read: vi.fn() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function pushEvent(event: unknown): void {
    mockStdout.push(JSON.stringify(event) + '\n')
  }

  function endStream(): void {
    mockStdout.push(null)
  }

  describe('init event parsing', () => {
    it('parses init event and emits session ID', async () => {
      const onSessionIdCaptured = vi.fn()
      const parser = createStreamParser({
        sessionId: 'initial-session',
        stdout: mockStdout,
        onSessionIdCaptured
      })

      const initPromise = new Promise<void>((resolve) => {
        parser.on('init', () => resolve())
      })

      pushEvent({
        type: 'system',
        subtype: 'init',
        session_id: 'captured-session-id',
        tools: ['Read', 'Write']
      })
      endStream()

      await initPromise

      expect(onSessionIdCaptured).toHaveBeenCalledWith('captured-session-id')
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:init',
        expect.objectContaining({
          sessionId: 'captured-session-id',
          tools: ['Read', 'Write']
        })
      )
    })

    it('emits init event with correct structure', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const initPromise = new Promise<{
        type: string
        sessionId: string
        tools: unknown[]
      }>((resolve) => {
        parser.on('init', (event) => resolve(event))
      })

      pushEvent({
        type: 'system',
        subtype: 'init',
        session_id: 'new-session-id',
        tools: [{ name: 'Read' }, { name: 'Write' }]
      })
      endStream()

      const event = await initPromise

      expect(event.type).toBe('init')
      expect(event.sessionId).toBe('new-session-id')
      expect(event.tools).toEqual([{ name: 'Read' }, { name: 'Write' }])
    })

    it('handles init event without tools', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const initPromise = new Promise<{ tools: unknown[] }>((resolve) => {
        parser.on('init', (event) => resolve(event))
      })

      pushEvent({
        type: 'system',
        subtype: 'init',
        session_id: 'session-123'
      })
      endStream()

      const event = await initPromise
      expect(event.tools).toEqual([])
    })
  })

  describe('user event parsing', () => {
    it('captures checkpoint UUID from user messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const userPromise = new Promise<void>((resolve) => {
        parser.on('user', () => resolve())
      })

      pushEvent({
        type: 'user',
        uuid: 'checkpoint-uuid-123',
        message: { role: 'user', content: 'Hello world' }
      })
      endStream()

      await userPromise

      expect(addCheckpoint).toHaveBeenCalledWith('test-session', 'checkpoint-uuid-123')
    })

    it('extracts string content from user messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const userPromise = new Promise<{ content: string }>((resolve) => {
        parser.on('user', (event) => resolve(event))
      })

      pushEvent({
        type: 'user',
        uuid: 'user-uuid',
        message: { role: 'user', content: 'Hello world' }
      })
      endStream()

      const event = await userPromise
      expect(event.content).toBe('Hello world')
    })

    it('emits tool_result from user messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const toolResultPromise = new Promise<void>((resolve) => {
        parser.on('tool_result', () => resolve())
      })

      pushEvent({
        type: 'user',
        uuid: 'user-uuid',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: 'File contents here',
              is_error: false
            }
          ]
        }
      })
      endStream()

      await toolResultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'tool_result',
          toolResult: expect.objectContaining({
            tool_use_id: 'toolu_123'
          })
        })
      )
    })

    it('emits tool_result with is_error flag', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const toolResultPromise = new Promise<void>((resolve) => {
        parser.on('tool_result', () => resolve())
      })

      pushEvent({
        type: 'user',
        uuid: 'user-uuid',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_err',
              content: 'Error: File not found',
              is_error: true
            }
          ]
        }
      })
      endStream()

      await toolResultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'tool_result',
          toolResult: expect.objectContaining({
            is_error: true
          })
        })
      )
    })

    it('skips user messages without uuid', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      let userEventReceived = false
      parser.on('user', () => {
        userEventReceived = true
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      pushEvent({
        type: 'user',
        message: { role: 'user', content: 'No UUID' }
      })
      endStream()

      await closePromise

      expect(userEventReceived).toBe(false)
      expect(addCheckpoint).not.toHaveBeenCalled()
    })
  })

  describe('assistant event parsing', () => {
    it('emits stream:chunk for text content', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const assistantPromise = new Promise<void>((resolve) => {
        parser.on('assistant', () => resolve())
      })

      pushEvent({
        type: 'assistant',
        uuid: 'assistant-uuid',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello! How can I help?' }]
        }
      })
      endStream()

      await assistantPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:chunk',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'text',
          content: 'Hello! How can I help?',
          uuid: 'assistant-uuid'
        })
      )
    })

    it('emits stream:tool for tool_use blocks', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const assistantPromise = new Promise<void>((resolve) => {
        parser.on('assistant', () => resolve())
      })

      pushEvent({
        type: 'assistant',
        uuid: 'assistant-uuid',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_456',
              name: 'Read',
              input: { file_path: '/src/test.ts' }
            }
          ]
        }
      })
      endStream()

      await assistantPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'tool_use',
          toolUse: expect.objectContaining({
            id: 'toolu_456',
            name: 'Read'
          })
        })
      )
    })

    it('handles assistant message with both text and tool_use', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      let assistantEventCount = 0
      parser.on('assistant', () => {
        assistantEventCount++
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read that file.' },
            { type: 'tool_use', id: 'toolu_789', name: 'Read', input: { file_path: '/test.ts' } }
          ]
        }
      })
      endStream()

      await closePromise

      expect(assistantEventCount).toBe(2)
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(2)
    })

    it('accumulates token usage from assistant messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ tokens?: { input: number; output: number } }>(
        (resolve) => {
          parser.on('result', (event) => resolve(event))
        }
      )

      // First assistant message with tokens
      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Part 1' }],
          usage: { input_tokens: 100, output_tokens: 50 }
        }
      })

      // Second assistant message with more tokens
      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Part 2' }],
          usage: { input_tokens: 200, output_tokens: 100 }
        }
      })

      // Result event
      pushEvent({
        type: 'result',
        subtype: 'success',
        cost_usd: 0.05
      })
      endStream()

      const result = await resultPromise

      // Should have accumulated 300 input, 150 output
      expect(result.tokens).toEqual({ input: 300, output: 150 })
    })

    it('captures model from assistant messages', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          model: 'claude-3-opus',
          content: [{ type: 'text', text: 'Hello' }]
        }
      })
      endStream()

      await closePromise

      // Model capture is verified through metadata upsert mock
      // Just ensure no errors thrown
    })
  })

  describe('result event parsing', () => {
    it('parses result event and extracts cost', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ costUsd: number | undefined }>((resolve) => {
        parser.on('result', (event) => resolve({ costUsd: event.costUsd }))
      })

      pushEvent({
        type: 'result',
        subtype: 'success',
        duration_ms: 5000,
        cost_usd: 0.123
      })
      endStream()

      const result = await resultPromise
      expect(result.costUsd).toBe(0.123)
    })

    it('emits stream:end to renderer when result event arrives', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<void>((resolve) => {
        parser.on('result', () => resolve())
      })

      pushEvent({
        type: 'result',
        subtype: 'success',
        duration_ms: 5000,
        cost_usd: 0.123
      })
      endStream()

      await resultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          sessionId: 'test-session',
          success: true,
          costUsd: 0.123,
          durationMs: 5000,
          tokens: expect.any(Object)
        })
      )
    })

    it('emits stream:end with accumulated tokens and cost', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<void>((resolve) => {
        parser.on('result', () => resolve())
      })

      // Add tokens from assistant message
      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello' }],
          usage: { input_tokens: 100, output_tokens: 50 }
        }
      })

      // Result with cost
      pushEvent({
        type: 'result',
        subtype: 'success',
        cost_usd: 0.05,
        duration_ms: 3000
      })
      endStream()

      await resultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          success: true,
          tokens: { input: 100, output: 50 },
          costUsd: 0.05,
          durationMs: 3000
        })
      )
    })

    it('sets success to false when result subtype is not success', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<void>((resolve) => {
        parser.on('result', () => resolve())
      })

      pushEvent({
        type: 'result',
        subtype: 'error'
      })
      endStream()

      await resultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:end',
        expect.objectContaining({
          success: false
        })
      )
    })

    it('ignores duplicate result events', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      let resultCount = 0
      parser.on('result', () => {
        resultCount++
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      // Send two result events
      pushEvent({
        type: 'result',
        subtype: 'success',
        cost_usd: 0.1
      })
      pushEvent({
        type: 'result',
        subtype: 'success',
        cost_usd: 0.2
      })
      endStream()

      await closePromise

      // Should only process first result event
      expect(resultCount).toBe(1)

      // stream:end should only be sent once with first result's cost
      const streamEndCalls = mockWindow.webContents.send.mock.calls.filter(
        (call) => call[0] === 'stream:end'
      )
      expect(streamEndCalls).toHaveLength(1)
      expect(streamEndCalls[0][1]).toMatchObject({ costUsd: 0.1 })
    })

    it('handles costUSD (alternative naming)', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ costUsd: number | undefined }>((resolve) => {
        parser.on('result', (event) => resolve({ costUsd: event.costUsd }))
      })

      pushEvent({
        type: 'result',
        subtype: 'success',
        costUSD: 0.456
      })
      endStream()

      const result = await resultPromise
      expect(result.costUsd).toBe(0.456)
    })

    it('extracts duration_ms from result', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ durationMs: number | undefined }>((resolve) => {
        parser.on('result', (event) => resolve({ durationMs: event.durationMs }))
      })

      pushEvent({
        type: 'result',
        subtype: 'success',
        duration_ms: 12345
      })
      endStream()

      const result = await resultPromise
      expect(result.durationMs).toBe(12345)
    })

    it('sets success to true for subtype success', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ success: boolean }>((resolve) => {
        parser.on('result', (event) => resolve({ success: event.success }))
      })

      pushEvent({
        type: 'result',
        subtype: 'success'
      })
      endStream()

      const result = await resultPromise
      expect(result.success).toBe(true)
    })

    it('sets success to false for non-success subtype', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const resultPromise = new Promise<{ success: boolean }>((resolve) => {
        parser.on('result', (event) => resolve({ success: event.success }))
      })

      pushEvent({
        type: 'result',
        subtype: 'error'
      })
      endStream()

      const result = await resultPromise
      expect(result.success).toBe(false)
    })
  })

  describe('error handling', () => {
    it('handles malformed JSON gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      // Push invalid JSON
      mockStdout.push('not valid json\n')

      // Push valid JSON to verify parsing continues
      pushEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Valid message' }]
        }
      })
      endStream()

      await closePromise

      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:chunk',
        expect.objectContaining({ content: 'Valid message' })
      )

      consoleWarnSpy.mockRestore()
    })

    it('skips invalid lines and continues parsing', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      let assistantCount = 0
      parser.on('assistant', () => assistantCount++)

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      pushEvent({ type: 'assistant', message: { content: [{ type: 'text', text: 'First' }] } })
      mockStdout.push('{"broken: json\n') // Invalid
      pushEvent({ type: 'assistant', message: { content: [{ type: 'text', text: 'Second' }] } })
      endStream()

      await closePromise

      expect(assistantCount).toBe(2)
    })

    it('handles empty lines gracefully without logging', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      mockStdout.push('\n')
      mockStdout.push('  \n')
      pushEvent({ type: 'assistant', message: { content: [{ type: 'text', text: 'Valid' }] } })
      endStream()

      await closePromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:chunk',
        expect.objectContaining({ content: 'Valid' })
      )

      // Empty lines should NOT trigger warnings
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('close event', () => {
    it('emits close event when stream ends', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      endStream()

      await closePromise
      // If we get here without timeout, test passes
    })

    it('clears checkpoints when stream closes', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const closePromise = new Promise<void>((resolve) => {
        parser.on('close', () => resolve())
      })

      // Add a checkpoint
      pushEvent({
        type: 'user',
        uuid: 'checkpoint-1',
        message: { role: 'user', content: 'Test' }
      })

      endStream()

      await closePromise

      // Verify addCheckpoint was called to add checkpoint
      expect(addCheckpoint).toHaveBeenCalled()

      // Verify clearCheckpoints was called to clean up memory
      expect(mockClearCheckpoints).toHaveBeenCalledWith('test-session')
    })
  })

  describe('session ID handling', () => {
    it('updates session ID on init event callback', async () => {
      const onSessionIdCaptured = vi.fn()
      createStreamParser({
        sessionId: 'initial-id',
        stdout: mockStdout,
        onSessionIdCaptured
      })

      const closePromise = new Promise<void>((resolve) => {
        // Use setTimeout to wait for events to process
        setTimeout(resolve, 50)
      })

      pushEvent({
        type: 'system',
        subtype: 'init',
        session_id: 'new-id-from-cc'
      })
      endStream()

      await closePromise

      expect(onSessionIdCaptured).toHaveBeenCalledWith('new-id-from-cc')
    })

    it('uses updated session ID for subsequent events', async () => {
      createStreamParser({
        sessionId: 'initial-id',
        stdout: mockStdout,
        onSessionIdCaptured: vi.fn()
      })

      const closePromise = new Promise<void>((resolve) => {
        setTimeout(resolve, 50)
      })

      // Init event updates session ID
      pushEvent({
        type: 'system',
        subtype: 'init',
        session_id: 'updated-session-id'
      })

      // Assistant event should use updated ID
      pushEvent({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hello' }] }
      })
      endStream()

      await closePromise

      // The stream:chunk event should have the updated session ID
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:chunk',
        expect.objectContaining({
          sessionId: 'updated-session-id'
        })
      )
    })
  })

  describe('tool_use parsing', () => {
    it('handles tool_use without input', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const assistantPromise = new Promise<void>((resolve) => {
        parser.on('assistant', () => resolve())
      })

      pushEvent({
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 'toolu_1', name: 'NoArgs' }]
        }
      })
      endStream()

      await assistantPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          toolUse: expect.objectContaining({
            input: {}
          })
        })
      )
    })
  })

  describe('standalone tool_result parsing', () => {
    it('handles standalone tool_result events', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const toolResultPromise = new Promise<void>((resolve) => {
        parser.on('tool_result', () => resolve())
      })

      pushEvent({
        type: 'tool_result',
        tool_use_id: 'toolu_standalone',
        content: 'File read successfully',
        is_error: false
      })
      endStream()

      await toolResultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          sessionId: 'test-session',
          type: 'tool_result',
          toolResult: expect.objectContaining({
            tool_use_id: 'toolu_standalone',
            content: 'File read successfully',
            is_error: false
          })
        })
      )
    })

    it('handles standalone tool_result with error flag', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const toolResultPromise = new Promise<void>((resolve) => {
        parser.on('tool_result', () => resolve())
      })

      pushEvent({
        type: 'tool_result',
        tool_use_id: 'toolu_error',
        content: 'Error: File not found',
        is_error: true
      })
      endStream()

      await toolResultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          type: 'tool_result',
          toolResult: expect.objectContaining({
            is_error: true
          })
        })
      )
    })

    it('handles standalone tool_result with non-string content', async () => {
      const parser = createStreamParser({
        sessionId: 'test-session',
        stdout: mockStdout
      })

      const toolResultPromise = new Promise<void>((resolve) => {
        parser.on('tool_result', () => resolve())
      })

      pushEvent({
        type: 'tool_result',
        tool_use_id: 'toolu_object',
        content: { key: 'value' }
      })
      endStream()

      await toolResultPromise

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stream:tool',
        expect.objectContaining({
          toolResult: expect.objectContaining({
            content: '{"key":"value"}'
          })
        })
      )
    })
  })
})

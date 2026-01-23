import { describe, it, expect } from 'vitest'
import { findToolResult, isToolError, getErrorPreview } from './pairToolCalls'
import type { ToolResultBlock } from '@renderer/features/sessions/components/types'

describe('findToolResult', () => {
  const mockResults: ToolResultBlock[] = [
    { type: 'tool_result', tool_use_id: 'tool-1', content: 'Result 1' },
    { type: 'tool_result', tool_use_id: 'tool-2', content: 'Result 2' },
    { type: 'tool_result', tool_use_id: 'tool-3', content: 'Result 3' }
  ]

  it('finds matching result by tool ID', () => {
    const result = findToolResult('tool-2', mockResults)
    expect(result).not.toBeNull()
    expect(result?.content).toBe('Result 2')
  })

  it('returns null for unknown tool ID', () => {
    const result = findToolResult('unknown-id', mockResults)
    expect(result).toBeNull()
  })

  it('returns null for undefined results array', () => {
    const result = findToolResult('tool-1', undefined)
    expect(result).toBeNull()
  })

  it('returns null for empty results array', () => {
    const result = findToolResult('tool-1', [])
    expect(result).toBeNull()
  })
})

describe('isToolError', () => {
  it('returns false for null result', () => {
    expect(isToolError(null)).toBe(false)
  })

  it('detects explicit is_error flag', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Something happened',
      is_error: true
    }
    expect(isToolError(result)).toBe(true)
  })

  it('does not treat is_error: false as error (explicit override)', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Error in the text but not an error result',
      is_error: false
    }
    // is_error: false explicitly overrides content pattern matching
    expect(isToolError(result)).toBe(false)
  })

  it('uses pattern matching when is_error is undefined (legacy API)', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Error: Something went wrong'
      // Note: is_error field is absent (undefined)
    }
    expect(isToolError(result)).toBe(true)
  })

  it('detects "Error:" in content', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Error: ENOENT: no such file or directory'
    }
    expect(isToolError(result)).toBe(true)
  })

  it('detects "failed" in content', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Command failed with exit code 1'
    }
    expect(isToolError(result)).toBe(true)
  })

  it('detects "not found" in content', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'File not found: missing.ts'
    }
    expect(isToolError(result)).toBe(true)
  })

  it('detects "permission denied" in content', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Permission denied: /etc/passwd'
    }
    expect(isToolError(result)).toBe(true)
  })

  it('detects "enoent" in content', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'ENOENT: no such file'
    }
    expect(isToolError(result)).toBe(true)
  })

  it('detects content starting with "error"', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'error occurred during execution'
    }
    expect(isToolError(result)).toBe(true)
  })

  it('returns false for successful result', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Operation completed successfully'
    }
    expect(isToolError(result)).toBe(false)
  })
})

describe('getErrorPreview', () => {
  it('returns first line if short', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Error: File not found\nStack trace:\n  at read()'
    }
    expect(getErrorPreview(result)).toBe('Error: File not found')
  })

  it('truncates first line if longer than 100 chars', () => {
    const longLine = 'Error: ' + 'x'.repeat(150)
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: longLine
    }
    const preview = getErrorPreview(result)
    expect(preview.length).toBe(103) // 100 + "..."
    expect(preview.endsWith('...')).toBe(true)
  })

  it('handles single-line content', () => {
    const result: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'test',
      content: 'Simple error message'
    }
    expect(getErrorPreview(result)).toBe('Simple error message')
  })
})

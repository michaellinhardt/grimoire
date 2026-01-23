import { describe, it, expect } from 'vitest'
import { formatToolSummary } from './formatToolSummary'
import type { ToolUseBlock } from '@renderer/features/sessions/components/types'

describe('formatToolSummary', () => {
  it('formats Read tool with file path', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Read',
      input: { file_path: 'src/main/index.ts' }
    }
    expect(formatToolSummary(toolCall)).toBe('src/main/index.ts')
  })

  it('formats Write tool with file path', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Write',
      input: { file_path: 'src/utils/helper.ts' }
    }
    expect(formatToolSummary(toolCall)).toBe('src/utils/helper.ts')
  })

  it('formats Edit tool with file path', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Edit',
      input: { file_path: 'src/renderer/App.tsx', old_string: 'x', new_string: 'y' }
    }
    expect(formatToolSummary(toolCall)).toBe('src/renderer/App.tsx')
  })

  it('formats NotebookEdit tool with notebook_path', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'NotebookEdit',
      input: { notebook_path: 'notebooks/analysis.ipynb' }
    }
    expect(formatToolSummary(toolCall)).toBe('notebooks/analysis.ipynb')
  })

  it('truncates long file paths with ... prefix', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Read',
      input: {
        file_path: 'src/renderer/src/features/sessions/components/very-long-component-name.tsx'
      }
    }
    const result = formatToolSummary(toolCall)
    expect(result.length).toBeLessThanOrEqual(40)
    expect(result.startsWith('...')).toBe(true)
    expect(result.endsWith('.tsx')).toBe(true)
  })

  it('formats Bash tool with command', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Bash',
      input: { command: 'npm run build' }
    }
    expect(formatToolSummary(toolCall)).toBe('npm run build')
  })

  it('truncates long Bash commands with ... suffix', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Bash',
      input: { command: 'npm run build && npm run test && npm run lint && npm run typecheck' }
    }
    const result = formatToolSummary(toolCall)
    expect(result.length).toBeLessThanOrEqual(53) // 50 + "..."
    expect(result.endsWith('...')).toBe(true)
  })

  it('formats Glob tool with pattern', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Glob',
      input: { pattern: '**/*.tsx' }
    }
    expect(formatToolSummary(toolCall)).toBe('**/*.tsx')
  })

  it('truncates long Glob patterns', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Glob',
      input: { pattern: 'src/renderer/src/features/sessions/components/**/*.tsx' }
    }
    const result = formatToolSummary(toolCall)
    expect(result.length).toBeLessThanOrEqual(43) // 40 + "..."
    expect(result.endsWith('...')).toBe(true)
  })

  it('formats Grep tool with pattern', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Grep',
      input: { pattern: 'TODO' }
    }
    expect(formatToolSummary(toolCall)).toBe('TODO')
  })

  it('truncates long Grep patterns', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Grep',
      input: { pattern: 'very long search pattern that exceeds limit' }
    }
    const result = formatToolSummary(toolCall)
    expect(result.length).toBeLessThanOrEqual(33) // 30 + "..."
    expect(result.endsWith('...')).toBe(true)
  })

  it('formats WebSearch tool with query', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'WebSearch',
      input: { query: 'React best practices 2026' }
    }
    expect(formatToolSummary(toolCall)).toBe('React best practices 2026')
  })

  it('formats WebFetch tool with URL (shows domain + path)', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'WebFetch',
      input: { url: 'https://docs.example.com/api/reference' }
    }
    expect(formatToolSummary(toolCall)).toBe('docs.example.com/api/reference')
  })

  it('handles invalid WebFetch URL gracefully', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'WebFetch',
      input: { url: 'not-a-valid-url' }
    }
    expect(formatToolSummary(toolCall)).toBe('not-a-valid-url')
  })

  it('truncates long WebFetch URLs', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'WebFetch',
      input: {
        url: 'https://docs.very-long-domain-name.example.com/api/v2/reference/endpoints/users'
      }
    }
    const result = formatToolSummary(toolCall)
    expect(result.length).toBeLessThanOrEqual(43) // 40 + "..."
    expect(result.endsWith('...')).toBe(true)
  })

  it('formats Task tool with subagent_type', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Task',
      input: { subagent_type: 'Explore', description: 'Find files' }
    }
    expect(formatToolSummary(toolCall)).toBe('Explore')
  })

  it('formats Skill tool with skill name', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Skill',
      input: { skill: 'commit', args: '-m "fix bug"' }
    }
    expect(formatToolSummary(toolCall)).toBe('commit')
  })

  it('formats Skill tool with missing skill name', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Skill',
      input: {}
    }
    expect(formatToolSummary(toolCall)).toBe('Skill')
  })

  it('returns tool name for unknown tools', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'CustomTool',
      input: { foo: 'bar' }
    }
    expect(formatToolSummary(toolCall)).toBe('CustomTool')
  })

  it('handles missing input fields gracefully', () => {
    const toolCall: ToolUseBlock = {
      type: 'tool_use',
      id: 'test-1',
      name: 'Read',
      input: {}
    }
    expect(formatToolSummary(toolCall)).toBe('')
  })
})

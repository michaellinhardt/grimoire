import { describe, it, expect } from 'vitest'
import { convertToTimelineEvents } from './timelineUtils'
import type { ConversationMessage, ToolUseBlock, SubAgentBlock } from '../types'

describe('convertToTimelineEvents', () => {
  describe('empty input', () => {
    it('returns empty array for empty messages array', () => {
      const result = convertToTimelineEvents([])
      expect(result).toEqual([])
    })
  })

  describe('user messages', () => {
    it('converts user message to user event with correct fields', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'user',
          content: 'Hello, can you help me?',
          timestamp: 1737640000000
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        uuid: 'msg-1',
        type: 'user',
        summary: 'Hello, can you help me?',
        timestamp: 1737640000000,
        tokenCount: 6 // ~24 chars / 4
      })
    })

    it('truncates long user message summary at 50 chars', () => {
      const longMessage = 'A'.repeat(60)
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'user',
          content: longMessage,
          timestamp: 1737640000000
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result[0].summary).toHaveLength(50)
      expect(result[0].summary).toBe('A'.repeat(47) + '...')
    })

    it('uses first line of multi-line message for summary', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'user',
          content: 'First line\nSecond line\nThird line',
          timestamp: 1737640000000
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result[0].summary).toBe('First line')
    })
  })

  describe('assistant messages', () => {
    it('converts assistant message to assistant event', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: 'I can help you with that.',
          timestamp: 1737640000000
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        uuid: 'msg-1',
        type: 'assistant',
        summary: 'I can help you with that.',
        timestamp: 1737640000000,
        tokenCount: 7 // ~26 chars / 4
      })
    })

    it('does not create assistant event for empty content when tool exists', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: 'test.ts' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)

      // Should only have tool event, not assistant event
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('tool')
    })

    it('creates fallback event for assistant message with no content, tools, or sub-agents', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000
        }
      ]

      const result = convertToTimelineEvents(messages)

      // Should create a fallback event so the message appears in timeline
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        uuid: 'msg-1',
        type: 'assistant',
        summary: '(empty response)',
        timestamp: 1737640000000,
        tokenCount: undefined
      })
    })
  })

  describe('tool calls', () => {
    it('generates tool events for tool use blocks', () => {
      const toolUseBlock: ToolUseBlock = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'Read',
        input: { file_path: 'src/main/index.ts' }
      }
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: 'Let me read that file.',
          timestamp: 1737640000000,
          toolUseBlocks: [toolUseBlock]
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result).toHaveLength(2)
      expect(result[1]).toEqual({
        uuid: 'msg-1-tool-toolu_123',
        type: 'tool',
        summary: 'Read src/main/index.ts',
        timestamp: 1737640000000,
        tokenCount: expect.any(Number)
      })
    })

    it('formats Read tool summary correctly', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: 'src/components/Button.tsx' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary).toBe('Read src/components/Button.tsx')
    })

    it('formats Write tool summary correctly', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Write',
              input: { file_path: 'output.txt' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary).toBe('Write output.txt')
    })

    it('formats Edit tool summary correctly', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Edit',
              input: { file_path: 'config.ts', old_string: 'a', new_string: 'b' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary).toBe('Edit config.ts')
    })

    it('formats Bash tool summary correctly', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Bash',
              input: { command: 'npm test' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary).toBe('Bash: npm test')
    })

    it('formats Glob tool summary correctly', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Glob',
              input: { pattern: '**/*.tsx' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary).toBe('Glob **/*.tsx')
    })

    it('formats Grep tool summary correctly', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Grep',
              input: { pattern: 'TODO' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary).toBe('Grep TODO')
    })

    it('uses tool name for unknown tools', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'CustomTool',
              input: { foo: 'bar' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary).toBe('CustomTool')
    })

    it('truncates long file paths at 40 chars', () => {
      const longPath = 'src/' + 'a'.repeat(50) + '/file.ts'
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: longPath }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      expect(result[0].summary.startsWith('Read ')).toBe(true)
      expect(result[0].summary.endsWith('...')).toBe(true)
      expect(result[0].summary.length).toBe(5 + 40) // "Read " + 40 chars
    })
  })

  describe('sub-agents', () => {
    it('generates sub_agent events for sub-agent blocks', () => {
      const subAgent: SubAgentBlock = {
        type: 'sub_agent',
        id: 'subagent-001-a8b2',
        agentType: 'Explore',
        label: 'Code Analysis',
        parentMessageUuid: 'msg-1',
        path: '/.claude/sub-agents/subagent-001-a8b2.jsonl',
        status: 'done'
      }
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: 'I will analyze the code.',
          timestamp: 1737640000000,
          subAgentBlocks: [subAgent]
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result).toHaveLength(2) // assistant + sub_agent
      expect(result[1]).toEqual({
        uuid: 'msg-1-subagent-subagent-001-a8b2',
        type: 'sub_agent',
        summary: 'Explore-a8b2',
        timestamp: 1737640000000,
        tokenCount: undefined,
        agentType: 'Explore',
        agentId: 'a8b2'
      })
    })

    it('uses last 4 chars of sub-agent ID as agentId', () => {
      const subAgent: SubAgentBlock = {
        type: 'sub_agent',
        id: 'subagent-long-id-xyz9',
        agentType: 'Task',
        label: 'Task Agent',
        parentMessageUuid: 'msg-1',
        path: '/path',
        status: 'running'
      }
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          subAgentBlocks: [subAgent]
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result[0].agentId).toBe('xyz9')
      expect(result[0].summary).toBe('Task-xyz9')
    })
  })

  describe('Task/Skill tool filtering', () => {
    it('filters out Task tool when corresponding sub-agent exists', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-task',
              name: 'Task',
              input: { task: 'analyze code' }
            }
          ],
          subAgentBlocks: [
            {
              type: 'sub_agent',
              id: 'subagent-001',
              agentType: 'Task',
              label: 'Task Agent',
              parentMessageUuid: 'msg-1',
              path: '/path',
              status: 'done'
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)

      // Should only have sub_agent event, not Task tool event
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('sub_agent')
    })

    it('filters out Skill tool when corresponding sub-agent exists', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-skill',
              name: 'Skill',
              input: { skill: 'commit' }
            }
          ],
          subAgentBlocks: [
            {
              type: 'sub_agent',
              id: 'subagent-001',
              agentType: 'Skill',
              label: 'Skill Agent',
              parentMessageUuid: 'msg-1',
              path: '/path',
              status: 'done'
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)

      // Should only have sub_agent event, not Skill tool event
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('sub_agent')
    })

    it('keeps other tools when sub-agent exists', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-read',
              name: 'Read',
              input: { file_path: 'test.ts' }
            },
            {
              type: 'tool_use',
              id: 'tool-task',
              name: 'Task',
              input: { task: 'analyze' }
            }
          ],
          subAgentBlocks: [
            {
              type: 'sub_agent',
              id: 'subagent-001',
              agentType: 'Task',
              label: 'Task Agent',
              parentMessageUuid: 'msg-1',
              path: '/path',
              status: 'done'
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)

      // Should have Read tool + sub_agent, but not Task tool
      expect(result).toHaveLength(2)
      expect(result.map((e) => e.type)).toEqual(['tool', 'sub_agent'])
      expect(result[0].summary).toContain('Read')
    })
  })

  describe('token count estimation', () => {
    it('estimates token count as ~4 chars per token', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'user',
          content: '12345678', // 8 chars = 2 tokens
          timestamp: 1737640000000
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result[0].tokenCount).toBe(2)
    })

    it('returns undefined for empty content', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: 1737640000000,
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: 'test.ts' }
            }
          ]
        }
      ]

      const result = convertToTimelineEvents(messages)
      // Tool events have token count based on input JSON
      expect(result[0].tokenCount).toBeGreaterThan(0)
    })

    it('rounds up token count', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'user',
          content: '123', // 3 chars = 0.75 tokens, rounded up to 1
          timestamp: 1737640000000
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result[0].tokenCount).toBe(1)
    })
  })

  describe('multiple messages', () => {
    it('preserves message order in output events', () => {
      const messages: ConversationMessage[] = [
        {
          uuid: 'msg-1',
          role: 'user',
          content: 'First',
          timestamp: 1737640000000
        },
        {
          uuid: 'msg-2',
          role: 'assistant',
          content: 'Second',
          timestamp: 1737640060000
        },
        {
          uuid: 'msg-3',
          role: 'user',
          content: 'Third',
          timestamp: 1737640120000
        }
      ]

      const result = convertToTimelineEvents(messages)

      expect(result).toHaveLength(3)
      expect(result[0].uuid).toBe('msg-1')
      expect(result[1].uuid).toBe('msg-2')
      expect(result[2].uuid).toBe('msg-3')
    })
  })
})

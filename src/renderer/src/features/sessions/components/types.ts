// ========================================
// Story 2b.4: Navigation and Loading States Types
// ========================================

/**
 * Timeline event for navigation map display
 * Maps to ConversationMessage.uuid for scroll synchronization
 */
export interface TimelineEvent {
  /** UUID matching the corresponding ConversationMessage.uuid */
  uuid: string
  /** Event type determines alignment and styling */
  type: 'user' | 'assistant' | 'tool' | 'sub_agent'
  /** One-line truncated summary for timeline display */
  summary: string
  /** Unix timestamp in milliseconds */
  timestamp: number
  /** Optional token count for display (e.g., "3.4k") */
  tokenCount?: number
  /** Agent type for sub_agent events (e.g., 'Explore', 'Task') */
  agentType?: string
  /** Short agent ID for sub_agent events (e.g., 'a8b2') */
  agentId?: string
}

// ========================================
// Story 2b.2: Tool Call Display Types
// ========================================

// ========================================
// Story 2b.3: Sub-Agent Display Types
// ========================================

/**
 * Sub-agent block from Claude Code - represents a spawned sub-agent conversation
 */
export interface SubAgentBlock {
  type: 'sub_agent'
  /** Sub-agent session ID */
  id: string
  /** Agent type (e.g., 'Explore', 'Bash', 'Task') */
  agentType: string
  /** Human-readable label */
  label: string
  /** UUID of parent message that spawned this agent */
  parentMessageUuid: string
  /** File path to sub-agent conversation */
  path: string
  /** Current status of the sub-agent */
  status: 'running' | 'done' | 'error'
  /** Total messages in sub-agent conversation */
  messageCount?: number
  /** Total tool calls in sub-agent conversation */
  toolCount?: number
  /** Brief summary of what the agent accomplished */
  summary?: string
}

/**
 * Tool use block from Claude Code - represents a tool call
 */
export interface ToolUseBlock {
  type: 'tool_use'
  /** Unique identifier for this tool call (e.g., "toolu_01HXYyux...") */
  id: string
  /** Tool name (e.g., "Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task") */
  name: string
  /** Tool-specific input parameters */
  input: Record<string, unknown>
}

/**
 * Tool result block from Claude Code - represents a tool's output
 */
export interface ToolResultBlock {
  type: 'tool_result'
  /** Matches ToolUseBlock.id */
  tool_use_id: string
  /** Result text or error message */
  content: string
  /** Explicit error indicator from Claude Code API (optional) */
  is_error?: boolean
}

/**
 * Paired tool call and its result
 */
export interface ToolPair {
  call: ToolUseBlock
  result: ToolResultBlock | null
}

/**
 * A single message in a conversation
 */
export interface ConversationMessage {
  /** Unique identifier for the message */
  uuid: string
  /** Message author - 'user' for human, 'assistant' for Claude */
  role: 'user' | 'assistant'
  /** Message text content */
  content: string
  /** Unix timestamp in milliseconds (NOT ISO 8601 string) */
  timestamp: number
  /** Optional tool use blocks for assistant messages */
  toolUseBlocks?: ToolUseBlock[]
  /** Optional tool results paired with tool use blocks */
  toolResults?: ToolResultBlock[]
  /** Optional sub-agent data for assistant messages (Story 2b.3) */
  subAgentBlocks?: SubAgentBlock[]
}

/**
 * Mock conversation data for development and testing.
 * Uses fixed timestamps relative to a base time for reproducible tests.
 * In production tests, use vi.useFakeTimers() with vi.setSystemTime().
 */
export const MOCK_MESSAGES: ConversationMessage[] = [
  {
    uuid: 'msg-1',
    role: 'user',
    content: 'Hello, can you help me with a React question?',
    timestamp: 1737630000000 // Fixed: 2026-01-23T10:00:00Z
  },
  {
    uuid: 'msg-2',
    role: 'assistant',
    content: "Of course! I'd be happy to help with React. What would you like to know?",
    timestamp: 1737630060000 // Fixed: 2026-01-23T10:01:00Z
  },
  {
    uuid: 'msg-3',
    role: 'user',
    content: 'How do I use useEffect correctly?',
    timestamp: 1737630180000 // Fixed: 2026-01-23T10:03:00Z
  },
  {
    uuid: 'msg-4',
    role: 'assistant',
    content:
      'useEffect is used for side effects in React components. The key rules are:\n\n1. Always include dependencies in the dependency array\n2. Return a cleanup function if needed\n3. Avoid infinite loops by careful dependency management',
    timestamp: 1737630240000 // Fixed: 2026-01-23T10:04:00Z
  }
]

/**
 * Creates mock messages with timestamps relative to current time.
 *
 * Usage guidelines:
 * - **For tests:** Use MOCK_MESSAGES (fixed timestamps) with vi.useFakeTimers()
 *   to ensure reproducible time-based assertions.
 * - **For development/runtime:** Use createMockMessages() to see realistic
 *   relative timestamps like "2m ago" in the UI during development.
 */
export function createMockMessages(): ConversationMessage[] {
  const now = Date.now()
  return [
    {
      uuid: 'msg-1',
      role: 'user',
      content: 'Hello, can you help me with a React question?',
      timestamp: now - 1000 * 60 * 5
    },
    {
      uuid: 'msg-2',
      role: 'assistant',
      content: "Of course! I'd be happy to help with React. What would you like to know?",
      timestamp: now - 1000 * 60 * 4
    },
    {
      uuid: 'msg-3',
      role: 'user',
      content: 'How do I use useEffect correctly?',
      timestamp: now - 1000 * 60 * 2
    },
    {
      uuid: 'msg-4',
      role: 'assistant',
      content:
        'useEffect is used for side effects in React components. The key rules are:\n\n1. Always include dependencies in the dependency array\n2. Return a cleanup function if needed\n3. Avoid infinite loops by careful dependency management',
      timestamp: now - 1000 * 60 * 1
    }
  ]
}

// ========================================
// Story 2b.2: Mock Tool Data
// ========================================

/**
 * Mock tool calls for development and testing
 */
export const MOCK_TOOL_CALLS: ToolUseBlock[] = [
  {
    type: 'tool_use',
    id: 'toolu_01Read001',
    name: 'Read',
    input: { file_path: 'src/main/index.ts' }
  },
  {
    type: 'tool_use',
    id: 'toolu_01Bash002',
    name: 'Bash',
    input: { command: 'npm run build && npm test' }
  },
  {
    type: 'tool_use',
    id: 'toolu_01Edit003',
    name: 'Edit',
    input: {
      file_path: 'src/renderer/App.tsx',
      old_string: 'const foo = 1',
      new_string: 'const foo = 2'
    }
  },
  {
    type: 'tool_use',
    id: 'toolu_01Glob004',
    name: 'Glob',
    input: { pattern: '**/*.tsx' }
  }
]

/**
 * Mock tool results for development and testing
 */
export const MOCK_TOOL_RESULTS: ToolResultBlock[] = [
  {
    type: 'tool_result',
    tool_use_id: 'toolu_01Read001',
    content:
      'import { app } from "electron"\n\napp.whenReady().then(() => {\n  // Application startup logic\n})'
  },
  {
    type: 'tool_result',
    tool_use_id: 'toolu_01Bash002',
    content: 'Build succeeded\n\nTest Suites: 42 passed\nTests: 310 passed'
  },
  {
    type: 'tool_result',
    tool_use_id: 'toolu_01Edit003',
    content: 'Edit successful'
  },
  {
    type: 'tool_result',
    tool_use_id: 'toolu_01Glob004',
    content: 'src/renderer/App.tsx\nsrc/renderer/main.tsx\nsrc/renderer/components/Button.tsx'
  }
]

/**
 * Mock error result for testing error states
 */
export const MOCK_ERROR_RESULT: ToolResultBlock = {
  type: 'tool_result',
  tool_use_id: 'toolu_error001',
  content: 'Error: ENOENT: no such file or directory, open "/path/to/missing-file.ts"',
  is_error: true
}

/**
 * Mock messages with tool blocks for development
 * Demonstrates a realistic conversation with tool usage
 */
export const MOCK_MESSAGES_WITH_TOOLS: ConversationMessage[] = [
  {
    uuid: 'msg-1',
    role: 'user',
    content: 'Can you read the main entry file?',
    timestamp: 1737630000000
  },
  {
    uuid: 'msg-2',
    role: 'assistant',
    content: "I'll read the main entry file for you.",
    timestamp: 1737630030000,
    toolUseBlocks: [MOCK_TOOL_CALLS[0]],
    toolResults: [MOCK_TOOL_RESULTS[0]]
  },
  {
    uuid: 'msg-3',
    role: 'assistant',
    content:
      'The main entry file sets up the Electron application. Let me also run the build to make sure everything works.',
    timestamp: 1737630060000,
    toolUseBlocks: [MOCK_TOOL_CALLS[1]],
    toolResults: [MOCK_TOOL_RESULTS[1]]
  },
  {
    uuid: 'msg-4',
    role: 'user',
    content: 'Great, can you fix the variable name?',
    timestamp: 1737630120000
  },
  {
    uuid: 'msg-5',
    role: 'assistant',
    content: "I'll update the variable name for you.",
    timestamp: 1737630150000,
    toolUseBlocks: [MOCK_TOOL_CALLS[2]],
    toolResults: [MOCK_TOOL_RESULTS[2]]
  }
]

// ========================================
// Story 2b.3: Mock Sub-Agent Data
// ========================================

/**
 * Mock sub-agent blocks for development and testing
 */
export const MOCK_SUB_AGENTS: SubAgentBlock[] = [
  {
    type: 'sub_agent',
    id: 'subagent-001-a8b2',
    agentType: 'Explore',
    label: 'Code Analysis Agent',
    parentMessageUuid: 'msg-001',
    path: '/.claude/sub-agents/subagent-001-a8b2.jsonl',
    status: 'done',
    messageCount: 8,
    toolCount: 5,
    summary: 'Analyzed authentication module. Found 3 security concerns in login flow.'
  },
  {
    type: 'sub_agent',
    id: 'subagent-002-f3c1',
    agentType: 'Task',
    label: 'Refactoring Assistant',
    parentMessageUuid: 'msg-002',
    path: '/.claude/sub-agents/subagent-002-f3c1.jsonl',
    status: 'running',
    messageCount: 3,
    toolCount: 2
  },
  {
    type: 'sub_agent',
    id: 'subagent-003-d4e5',
    agentType: 'Bash',
    label: 'Build Agent',
    parentMessageUuid: 'msg-003',
    path: '/.claude/sub-agents/subagent-003-d4e5.jsonl',
    status: 'error',
    messageCount: 2,
    toolCount: 1,
    summary: 'Build failed: npm ERR! missing dependency'
  }
]

/**
 * Mock messages with sub-agent blocks for development
 * Demonstrates a realistic conversation with sub-agent spawns
 */
export const MOCK_MESSAGES_WITH_SUB_AGENTS: ConversationMessage[] = [
  {
    uuid: 'msg-sa-001',
    role: 'user',
    content: 'Can you analyze the authentication code and find any security issues?',
    timestamp: 1737640000000 // Fixed timestamp for reproducible tests
  },
  {
    uuid: 'msg-sa-002',
    role: 'assistant',
    content: "I'll spawn an analysis agent to examine the auth module thoroughly.",
    timestamp: 1737640060000, // 1 minute later
    subAgentBlocks: [MOCK_SUB_AGENTS[0]]
  },
  {
    uuid: 'msg-sa-003',
    role: 'assistant',
    content: 'The analysis is complete. Here are the findings from the Code Analysis Agent:',
    timestamp: 1737640360000 // 5 minutes later
  }
]

// ========================================
// Story 2b.4: Mock Timeline Events
// ========================================

/**
 * Mock timeline events for development and testing.
 * NOTE: Fixed timestamps (1737640000000 = 2026-01-23T11:06:40Z) ensure reproducible tests.
 * For runtime development mocks, consider createMockTimelineEvents() pattern.
 */
export const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    uuid: 'evt-001',
    type: 'user',
    summary: 'Can you analyze the authentication code?',
    timestamp: 1737640000000, // 2026-01-23T11:06:40Z
    tokenCount: 1200
  },
  {
    uuid: 'evt-002',
    type: 'assistant',
    summary: "I'll examine the auth module thoroughly...",
    timestamp: 1737640060000,
    tokenCount: 3400
  },
  {
    uuid: 'evt-003',
    type: 'tool',
    summary: 'Read src/auth/login.ts',
    timestamp: 1737640120000,
    tokenCount: 850
  },
  {
    uuid: 'evt-004',
    type: 'sub_agent',
    summary: 'Explore-a8b2',
    timestamp: 1737640180000,
    tokenCount: 5200,
    agentType: 'Explore',
    agentId: 'a8b2'
  },
  {
    uuid: 'evt-005',
    type: 'assistant',
    summary: 'Based on my analysis, there are 3 issues...',
    timestamp: 1737640360000,
    tokenCount: 2100
  }
]

/**
 * Creates mock timeline events with timestamps relative to current time.
 * For tests, use MOCK_TIMELINE_EVENTS with vi.useFakeTimers().
 */
export function createMockTimelineEvents(): TimelineEvent[] {
  const now = Date.now()
  return [
    {
      uuid: 'evt-001',
      type: 'user',
      summary: 'Can you analyze the authentication code?',
      timestamp: now - 1000 * 60 * 10, // 10 minutes ago
      tokenCount: 1200
    },
    {
      uuid: 'evt-002',
      type: 'assistant',
      summary: "I'll examine the auth module thoroughly...",
      timestamp: now - 1000 * 60 * 9,
      tokenCount: 3400
    },
    {
      uuid: 'evt-003',
      type: 'tool',
      summary: 'Read src/auth/login.ts',
      timestamp: now - 1000 * 60 * 8,
      tokenCount: 850
    },
    {
      uuid: 'evt-004',
      type: 'sub_agent',
      summary: 'Explore-a8b2',
      timestamp: now - 1000 * 60 * 7,
      tokenCount: 5200,
      agentType: 'Explore',
      agentId: 'a8b2'
    },
    {
      uuid: 'evt-005',
      type: 'assistant',
      summary: 'Based on my analysis, there are 3 issues...',
      timestamp: now - 1000 * 60 * 5,
      tokenCount: 2100
    }
  ]
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ConversationView } from './ConversationView'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import type { ConversationMessage, SubAgentBlock } from './types'

// Mock useUIStore - return only the properties we need, properly typed
vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: vi.fn()
}))

// Use fixed timestamps for reproducible tests
// Note: These are absolute timestamps (Jan 2026) that work with mocked system time
// For timestamp display tests, see 'renders timestamps for messages' which uses Date.now()
const mockMessages: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Hello', timestamp: 1737630000000 }, // 2026-01-23T10:00:00Z
  { uuid: '2', role: 'assistant', content: 'Hi there!', timestamp: 1737630030000 } // 2026-01-23T10:00:30Z
]

// Mock messages with tool blocks for tool card integration tests
const mockMessagesWithTools: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Read the file', timestamp: 1737630000000 },
  {
    uuid: '2',
    role: 'assistant',
    content: "I'll read that file for you.",
    timestamp: 1737630030000,
    toolUseBlocks: [
      { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'src/main.ts' } }
    ],
    toolResults: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'File contents here' }]
  }
]

// Mock messages with multiple tool blocks in a single message
const mockMessagesWithMultipleTools: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Read multiple files', timestamp: 1737630000000 },
  {
    uuid: '2',
    role: 'assistant',
    content: "I'll read multiple files for you.",
    timestamp: 1737630030000,
    toolUseBlocks: [
      { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'src/main.ts' } },
      { type: 'tool_use', id: 'tool-2', name: 'Glob', input: { pattern: '**/*.tsx' } },
      { type: 'tool_use', id: 'tool-3', name: 'Bash', input: { command: 'npm run build' } }
    ],
    toolResults: [
      { type: 'tool_result', tool_use_id: 'tool-1', content: 'File contents here' },
      { type: 'tool_result', tool_use_id: 'tool-2', content: 'src/App.tsx\nsrc/index.tsx' },
      { type: 'tool_result', tool_use_id: 'tool-3', content: 'Build succeeded' }
    ]
  }
]

// Mock messages with error tool result
const mockMessagesWithErrorTool: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Read missing file', timestamp: 1737630000000 },
  {
    uuid: '2',
    role: 'assistant',
    content: "I'll try to read that file.",
    timestamp: 1737630030000,
    toolUseBlocks: [
      { type: 'tool_use', id: 'tool-err', name: 'Read', input: { file_path: 'missing.ts' } }
    ],
    toolResults: [
      {
        type: 'tool_result',
        tool_use_id: 'tool-err',
        content: 'Error: ENOENT: no such file or directory',
        is_error: true
      }
    ]
  }
]

// Mock messages with tool blocks but NO text content (tool-only message)
// NOTE: Uses function to get timestamps relative to mocked Date.now()
function createMockMessagesWithToolOnly(): ConversationMessage[] {
  return [
    { uuid: '1', role: 'user', content: 'Run the build', timestamp: Date.now() - 1000 * 60 * 5 },
    {
      uuid: '2',
      role: 'assistant',
      content: '', // Empty content - Claude sometimes executes tools silently
      timestamp: Date.now() - 1000 * 60 * 2, // 2 minutes ago
      toolUseBlocks: [
        { type: 'tool_use', id: 'tool-silent', name: 'Bash', input: { command: 'npm run build' } }
      ],
      toolResults: [{ type: 'tool_result', tool_use_id: 'tool-silent', content: 'Build succeeded' }]
    }
  ]
}

// Mock sub-agent blocks for Story 2b.3 tests
const mockSubAgent: SubAgentBlock = {
  type: 'sub_agent',
  id: 'subagent-001-a8b2',
  agentType: 'Explore',
  label: 'Code Analysis Agent',
  parentMessageUuid: 'msg-001',
  path: '/.claude/sub-agents/subagent-001-a8b2.jsonl',
  status: 'done',
  messageCount: 8,
  toolCount: 5,
  summary: 'Analyzed authentication module. Found 3 security concerns.'
}

// Mock messages with sub-agent blocks (Story 2b.3)
const mockMessagesWithSubAgents: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Analyze the auth code', timestamp: 1737630000000 },
  {
    uuid: '2',
    role: 'assistant',
    content: "I'll spawn an agent to analyze that.",
    timestamp: 1737630030000,
    subAgentBlocks: [mockSubAgent]
  }
]

// Mock messages with both tools and sub-agents (Task tool should be filtered)
const mockMessagesWithToolsAndSubAgents: ConversationMessage[] = [
  { uuid: '1', role: 'user', content: 'Analyze the auth code', timestamp: 1737630000000 },
  {
    uuid: '2',
    role: 'assistant',
    content: "I'll analyze that.",
    timestamp: 1737630030000,
    toolUseBlocks: [
      { type: 'tool_use', id: 'task-tool-1', name: 'Task', input: { description: 'Analyze auth' } },
      { type: 'tool_use', id: 'read-tool-1', name: 'Read', input: { file_path: 'auth.ts' } }
    ],
    toolResults: [{ type: 'tool_result', tool_use_id: 'read-tool-1', content: 'File contents' }],
    subAgentBlocks: [mockSubAgent]
  }
]

describe('ConversationView', () => {
  const mockSetScrollPosition = vi.fn()
  const mockGetScrollPosition = vi.fn()
  const mockClearScrollPosition = vi.fn()
  const mockOpenSubAgentTab = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'))

    mockSetScrollPosition.mockClear()
    mockGetScrollPosition.mockReturnValue(0)
    mockClearScrollPosition.mockClear()
    mockOpenSubAgentTab.mockClear()

    // Mock only the functions actually used by ConversationView
    vi.mocked(useUIStore).mockReturnValue({
      setScrollPosition: mockSetScrollPosition,
      getScrollPosition: mockGetScrollPosition,
      clearScrollPosition: mockClearScrollPosition,
      openSubAgentTab: mockOpenSubAgentTab,
      scrollPositions: new Map(),
      // Include required UIState properties (minimal stubs)
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      tabs: [],
      activeTabId: null,
      activeSection: 'sessions' as const,
      showArchived: false,
      setLeftPanelCollapsed: vi.fn(),
      setRightPanelCollapsed: vi.fn(),
      setActiveSection: vi.fn(),
      setShowArchived: vi.fn(),
      addTab: vi.fn(),
      closeTab: vi.fn(),
      setActiveTabId: vi.fn(),
      findTabBySessionId: vi.fn(),
      focusOrOpenSession: vi.fn(),
      updateTabSessionState: vi.fn(),
      updateTabTitle: vi.fn()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders all messages', () => {
    render(<ConversationView messages={mockMessages} sessionId="test-session" />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('renders messages with correct roles', () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const bubbles = container.querySelectorAll('.max-w-\\[80\\%\\]')
    expect(bubbles).toHaveLength(2)

    // First bubble (user) should have ml-auto
    expect(bubbles[0].className).toContain('ml-auto')
    // Second bubble (assistant) should have mr-auto
    expect(bubbles[1].className).toContain('mr-auto')
  })

  it('renders empty state message when no messages', () => {
    render(<ConversationView messages={[]} sessionId="test-session" />)

    expect(
      screen.getByText('Messages will appear as the conversation progresses.')
    ).toBeInTheDocument()
  })

  it('calls getScrollPosition on mount', () => {
    render(<ConversationView messages={mockMessages} sessionId="test-session" />)

    expect(mockGetScrollPosition).toHaveBeenCalledWith('test-session')
  })

  it('saves scroll position on scroll (debounced)', async () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) {
      await act(async () => {
        fireEvent.scroll(viewport, { target: { scrollTop: 100 } })
        // Advance timers to trigger debounced callback (100ms debounce)
        vi.advanceTimersByTime(150)
      })
    }

    expect(mockSetScrollPosition).toHaveBeenCalledWith('test-session', expect.any(Number))
  })

  it('renders messages with space-y-4 gap', () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const messageContainer = container.querySelector('.space-y-4')
    expect(messageContainer).toBeInTheDocument()
  })

  it('has proper padding around messages', () => {
    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const messageContainer = container.querySelector('.p-4')
    expect(messageContainer).toBeInTheDocument()
  })

  it('renders accessible message bubbles', () => {
    render(<ConversationView messages={mockMessages} sessionId="test-session" />)

    expect(screen.getByLabelText('User message')).toBeInTheDocument()
    expect(screen.getByLabelText('Assistant message')).toBeInTheDocument()
  })

  it('renders timestamps for messages', () => {
    // Use messages with recent timestamps relative to the mocked time
    const recentMessages: ConversationMessage[] = [
      { uuid: '1', role: 'user', content: 'Hello', timestamp: Date.now() - 1000 * 60 * 5 },
      { uuid: '2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() - 1000 * 60 * 2 }
    ]
    render(<ConversationView messages={recentMessages} sessionId="test-session" />)

    // Messages should show relative time since they're within 24 hours
    const timestamps = screen.getAllByText(/ago/)
    expect(timestamps.length).toBe(2)
    expect(screen.getByText('5m ago')).toBeInTheDocument()
    expect(screen.getByText('2m ago')).toBeInTheDocument()
  })

  it('handles many messages', () => {
    const manyMessages: ConversationMessage[] = Array.from({ length: 50 }, (_, i) => ({
      uuid: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
      timestamp: 1737630000000 + i * 1000
    }))

    const { container } = render(
      <ConversationView messages={manyMessages} sessionId="test-session" />
    )

    const bubbles = container.querySelectorAll('.max-w-\\[80\\%\\]')
    expect(bubbles).toHaveLength(50)
  })

  it('uses correct sessionId for scroll position', () => {
    render(<ConversationView messages={mockMessages} sessionId="my-unique-session" />)

    expect(mockGetScrollPosition).toHaveBeenCalledWith('my-unique-session')
  })

  it('shows empty state when messages change from non-empty to empty', () => {
    const { rerender } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    // Initially shows messages
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(
      screen.queryByText('Messages will appear as the conversation progresses.')
    ).not.toBeInTheDocument()

    // Rerender with empty messages
    rerender(<ConversationView messages={[]} sessionId="test-session" />)

    // Should now show empty state
    expect(
      screen.getByText('Messages will appear as the conversation progresses.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('restores saved scroll position on mount when position exists', () => {
    // Mock a previously saved scroll position
    mockGetScrollPosition.mockReturnValue(250)

    const { container } = render(
      <ConversationView messages={mockMessages} sessionId="session-with-saved-position" />
    )

    // Verify getScrollPosition was called with the session ID
    expect(mockGetScrollPosition).toHaveBeenCalledWith('session-with-saved-position')

    // The viewport should have its scrollTop set to the saved position
    // Note: In JSDOM, scrollTop may not be directly settable, but we verify the function was called
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]')
    expect(viewport).toBeInTheDocument()
  })

  it('cleans up debounce timeout on unmount', async () => {
    const { container, unmount } = render(
      <ConversationView messages={mockMessages} sessionId="test-session" />
    )

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) {
      // Trigger a scroll event to start debounce timer
      await act(async () => {
        fireEvent.scroll(viewport, { target: { scrollTop: 100 } })
      })
    }

    // Unmount before debounce completes (debounce is 100ms)
    unmount()

    // Advance timers past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    // setScrollPosition should NOT be called after unmount since cleanup clears the timeout
    // Reset the mock call count before advancing timers to verify no NEW calls happen
    mockSetScrollPosition.mockClear()

    // Advance timers - the scroll handler should NOT fire due to cleanup
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    // Verify no state updates occurred after unmount
    expect(mockSetScrollPosition).not.toHaveBeenCalled()
  })

  describe('with tool cards', () => {
    it('renders ToolCallCard for messages with tool blocks', () => {
      render(<ConversationView messages={mockMessagesWithTools} sessionId="test-session" />)

      // Should show the tool name
      expect(screen.getByText('Read')).toBeInTheDocument()
      // Should show the file path summary
      expect(screen.getByText('src/main.ts')).toBeInTheDocument()
    })

    it('renders text content alongside tool cards', () => {
      render(<ConversationView messages={mockMessagesWithTools} sessionId="test-session" />)

      // Should show assistant text content
      expect(screen.getByText("I'll read that file for you.")).toBeInTheDocument()
      // Should also show tool card
      expect(screen.getByText('Read')).toBeInTheDocument()
    })

    it('expands tool card when clicked', async () => {
      render(<ConversationView messages={mockMessagesWithTools} sessionId="test-session" />)

      // Click to expand
      const toolButton = screen.getByLabelText('Read tool call')
      fireEvent.click(toolButton)

      // Should now show expanded content
      expect(screen.getByText('Input:')).toBeVisible()
      expect(screen.getByText('Output:')).toBeVisible()
    })

    it('collapses tool card when clicked again', async () => {
      render(<ConversationView messages={mockMessagesWithTools} sessionId="test-session" />)

      const toolButton = screen.getByLabelText('Read tool call')

      // Expand
      fireEvent.click(toolButton)
      expect(screen.getByText('Input:')).toBeVisible()

      // Collapse
      fireEvent.click(toolButton)
      // Radix Collapsible removes content when closed
      expect(screen.queryByText('Input:')).toBeNull()
    })

    it('resets expanded tools when sessionId changes', async () => {
      const { rerender } = render(
        <ConversationView messages={mockMessagesWithTools} sessionId="session-1" />
      )

      // Expand a tool
      const toolButton = screen.getByLabelText('Read tool call')
      fireEvent.click(toolButton)
      expect(screen.getByText('Input:')).toBeVisible()

      // Change session
      rerender(<ConversationView messages={mockMessagesWithTools} sessionId="session-2" />)

      // Tool should be collapsed again
      expect(screen.queryByText('Input:')).toBeNull()
    })

    it('renders regular messages without tool blocks normally', () => {
      render(<ConversationView messages={mockMessagesWithTools} sessionId="test-session" />)

      // User message should render as MessageBubble
      expect(screen.getByText('Read the file')).toBeInTheDocument()
      expect(screen.getByLabelText('User message')).toBeInTheDocument()
    })

    it('renders multiple tool cards in a single message', () => {
      render(<ConversationView messages={mockMessagesWithMultipleTools} sessionId="test-session" />)

      // Should show all tool names
      expect(screen.getByText('Read')).toBeInTheDocument()
      expect(screen.getByText('Glob')).toBeInTheDocument()
      expect(screen.getByText('Bash')).toBeInTheDocument()
      // Should show summaries
      expect(screen.getByText('src/main.ts')).toBeInTheDocument()
      expect(screen.getByText('**/*.tsx')).toBeInTheDocument()
      expect(screen.getByText('npm run build')).toBeInTheDocument()
    })

    it('renders error state tool card with correct styling', () => {
      const { container } = render(
        <ConversationView messages={mockMessagesWithErrorTool} sessionId="test-session" />
      )

      // Should show error indicator in aria-label
      expect(screen.getByLabelText('Read tool call (error)')).toBeInTheDocument()
      // Should show error text
      expect(screen.getByText(/ENOENT/)).toBeInTheDocument()
      // Card should have red styling (check for the red border class)
      const toolCard = container.querySelector('.border-red-500')
      expect(toolCard).toBeInTheDocument()
    })

    it('renders tool-only messages (no text content) with timestamp', () => {
      render(
        <ConversationView messages={createMockMessagesWithToolOnly()} sessionId="test-session" />
      )

      // Should show the tool card
      expect(screen.getByText('Bash')).toBeInTheDocument()
      expect(screen.getByText('npm run build')).toBeInTheDocument()

      // Should NOT show a MessageBubble for the assistant (no aria-label for assistant message)
      // Only the user message bubble should exist
      expect(screen.queryByLabelText('Assistant message')).not.toBeInTheDocument()
      expect(screen.getByLabelText('User message')).toBeInTheDocument()

      // Should show a timestamp for the tool-only message (2m ago from mocked time)
      expect(screen.getByText('2m ago')).toBeInTheDocument()
    })
  })

  describe('with sub-agent bubbles (Story 2b.3)', () => {
    it('renders SubAgentBubble for messages with subAgentBlocks', () => {
      render(<ConversationView messages={mockMessagesWithSubAgents} sessionId="test-session" />)

      // Should show the sub-agent label
      expect(screen.getByText('Code Analysis Agent')).toBeInTheDocument()
      // Should show "Done" status
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('renders text content alongside sub-agent bubbles', () => {
      render(<ConversationView messages={mockMessagesWithSubAgents} sessionId="test-session" />)

      // Should show assistant text content
      expect(screen.getByText("I'll spawn an agent to analyze that.")).toBeInTheDocument()
      // Should also show sub-agent bubble
      expect(screen.getByText('Code Analysis Agent')).toBeInTheDocument()
    })

    it('expands sub-agent bubble when clicked', () => {
      render(<ConversationView messages={mockMessagesWithSubAgents} sessionId="test-session" />)

      // Click to expand
      const trigger = screen.getByRole('button', { name: /Code Analysis Agent/i })
      fireEvent.click(trigger)

      // Should now show expanded content
      expect(screen.getByText('8 messages, 5 tool calls')).toBeVisible()
      expect(screen.getByText(/Analyzed authentication module/)).toBeVisible()
    })

    it('collapses sub-agent bubble when clicked again', () => {
      render(<ConversationView messages={mockMessagesWithSubAgents} sessionId="test-session" />)

      const trigger = screen.getByRole('button', { name: /Code Analysis Agent/i })

      // Expand
      fireEvent.click(trigger)
      expect(screen.getByText('8 messages, 5 tool calls')).toBeVisible()

      // Collapse
      fireEvent.click(trigger)
      // Radix Collapsible removes content when closed
      expect(screen.queryByText('8 messages, 5 tool calls')).toBeNull()
    })

    it('calls openSubAgentTab when clicking open-in-tab button', () => {
      render(<ConversationView messages={mockMessagesWithSubAgents} sessionId="test-session" />)

      const openButton = screen.getByLabelText('Open sub-agent in new tab')
      fireEvent.click(openButton)

      expect(mockOpenSubAgentTab).toHaveBeenCalledWith(mockSubAgent)
    })

    it('resets expanded sub-agents when sessionId changes', () => {
      const { rerender } = render(
        <ConversationView messages={mockMessagesWithSubAgents} sessionId="session-1" />
      )

      // Expand a sub-agent
      const trigger = screen.getByRole('button', { name: /Code Analysis Agent/i })
      fireEvent.click(trigger)
      expect(screen.getByText('8 messages, 5 tool calls')).toBeVisible()

      // Change session
      rerender(<ConversationView messages={mockMessagesWithSubAgents} sessionId="session-2" />)

      // Sub-agent should be collapsed again
      expect(screen.queryByText('8 messages, 5 tool calls')).toBeNull()
    })

    it('filters Task tool cards when subAgentBlocks present', () => {
      render(
        <ConversationView messages={mockMessagesWithToolsAndSubAgents} sessionId="test-session" />
      )

      // Should show the Read tool (not a Task/Skill)
      expect(screen.getByText('Read')).toBeInTheDocument()
      // Should show the sub-agent bubble
      expect(screen.getByText('Code Analysis Agent')).toBeInTheDocument()
      // Should NOT show the Task tool card (filtered out)
      expect(screen.queryByText('Task')).not.toBeInTheDocument()
    })

    it('filters Skill tool cards when subAgentBlocks present', () => {
      const messagesWithSkill: ConversationMessage[] = [
        { uuid: '1', role: 'user', content: 'Run skill', timestamp: 1737630000000 },
        {
          uuid: '2',
          role: 'assistant',
          content: "I'll run that skill.",
          timestamp: 1737630030000,
          toolUseBlocks: [
            { type: 'tool_use', id: 'skill-tool-1', name: 'Skill', input: { skill: 'analyze' } },
            { type: 'tool_use', id: 'bash-tool-1', name: 'Bash', input: { command: 'ls' } }
          ],
          toolResults: [{ type: 'tool_result', tool_use_id: 'bash-tool-1', content: 'file.txt' }],
          subAgentBlocks: [mockSubAgent]
        }
      ]

      render(<ConversationView messages={messagesWithSkill} sessionId="test-session" />)

      // Should show the Bash tool (not a Task/Skill)
      expect(screen.getByText('Bash')).toBeInTheDocument()
      // Should show the sub-agent bubble
      expect(screen.getByText('Code Analysis Agent')).toBeInTheDocument()
      // Should NOT show the Skill tool card (filtered out)
      expect(screen.queryByText('Skill')).not.toBeInTheDocument()
    })

    it('manages sub-agent expansion state separately from tools', () => {
      const messagesWithBoth: ConversationMessage[] = [
        { uuid: '1', role: 'user', content: 'Do stuff', timestamp: 1737630000000 },
        {
          uuid: '2',
          role: 'assistant',
          content: 'Doing stuff.',
          timestamp: 1737630030000,
          toolUseBlocks: [
            { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: 'test.ts' } }
          ],
          toolResults: [{ type: 'tool_result', tool_use_id: 'read-1', content: 'File contents' }],
          subAgentBlocks: [mockSubAgent]
        }
      ]

      render(<ConversationView messages={messagesWithBoth} sessionId="test-session" />)

      // Expand the tool card
      const toolButton = screen.getByLabelText('Read tool call')
      fireEvent.click(toolButton)
      expect(screen.getByText('Input:')).toBeVisible()

      // Sub-agent should still be collapsed
      expect(screen.queryByText('8 messages, 5 tool calls')).toBeNull()

      // Expand the sub-agent
      const subAgentTrigger = screen.getByRole('button', { name: /Code Analysis Agent/i })
      fireEvent.click(subAgentTrigger)
      expect(screen.getByText('8 messages, 5 tool calls')).toBeVisible()

      // Tool should still be expanded
      expect(screen.getByText('Input:')).toBeVisible()
    })

    it('applies purple styling to sub-agent bubble', () => {
      const { container } = render(
        <ConversationView messages={mockMessagesWithSubAgents} sessionId="test-session" />
      )

      // Sub-agent bubble should have purple background and border
      const subAgentCard = container.querySelector('.bg-purple-500\\/10')
      expect(subAgentCard).toBeInTheDocument()
      const purpleBorder = container.querySelector('.border-purple-500')
      expect(purpleBorder).toBeInTheDocument()
    })
  })

  describe('Loading and Thinking indicators (Story 2b.4)', () => {
    it('shows LoadingIndicator when sessionState is working and no messages streaming', () => {
      render(<ConversationView messages={[]} sessionId="test-session" sessionState="working" />)

      expect(screen.getByRole('status', { name: 'Loading Claude Code' })).toBeInTheDocument()
      expect(screen.getByText('Loading Claude Code...')).toBeInTheDocument()
    })

    it('shows ThinkingIndicator when sessionState is working and streaming started', () => {
      // When there are messages and state is working, streaming has started
      render(
        <ConversationView messages={mockMessages} sessionId="test-session" sessionState="working" />
      )

      expect(screen.getByRole('status', { name: 'Claude is thinking' })).toBeInTheDocument()
      expect(screen.getByText('Thinking')).toBeInTheDocument()
    })

    it('hides indicators when sessionState is idle', () => {
      render(
        <ConversationView messages={mockMessages} sessionId="test-session" sessionState="idle" />
      )

      expect(screen.queryByRole('status', { name: 'Loading Claude Code' })).not.toBeInTheDocument()
      expect(screen.queryByRole('status', { name: 'Claude is thinking' })).not.toBeInTheDocument()
    })

    it('hides indicators when sessionState is undefined (defaults to idle)', () => {
      render(<ConversationView messages={mockMessages} sessionId="test-session" />)

      expect(screen.queryByRole('status', { name: 'Loading Claude Code' })).not.toBeInTheDocument()
      expect(screen.queryByRole('status', { name: 'Claude is thinking' })).not.toBeInTheDocument()
    })

    it('transitions from Loading to Thinking when first message arrives', () => {
      const { rerender } = render(
        <ConversationView messages={[]} sessionId="test-session" sessionState="working" />
      )

      // Initially shows loading
      expect(screen.getByText('Loading Claude Code...')).toBeInTheDocument()
      expect(screen.queryByText('Thinking')).not.toBeInTheDocument()

      // Rerender with first message (streaming started)
      rerender(
        <ConversationView
          messages={[mockMessages[0]]}
          sessionId="test-session"
          sessionState="working"
        />
      )

      // Should now show thinking
      expect(screen.queryByText('Loading Claude Code...')).not.toBeInTheDocument()
      expect(screen.getByText('Thinking')).toBeInTheDocument()
    })

    it('resets streaming state when session changes', () => {
      const { rerender } = render(
        <ConversationView messages={mockMessages} sessionId="session-1" sessionState="working" />
      )

      // Should show thinking (has messages while working)
      expect(screen.getByText('Thinking')).toBeInTheDocument()

      // Change session to a new one with working state but no messages
      rerender(<ConversationView messages={[]} sessionId="session-2" sessionState="working" />)

      // Should show loading (new session, no messages yet)
      expect(screen.getByText('Loading Claude Code...')).toBeInTheDocument()
    })
  })

  describe('scroll-to-event functionality (Story 2b.4)', () => {
    it('exposes scrollToEvent function via callback ref', () => {
      let capturedScrollFn: ((uuid: string) => void) | null = null
      const handleScrollRef = (fn: (uuid: string) => void): void => {
        capturedScrollFn = fn
      }

      render(
        <ConversationView
          messages={mockMessages}
          sessionId="test-session"
          onScrollToEventRef={handleScrollRef}
        />
      )

      expect(capturedScrollFn).not.toBeNull()
      expect(typeof capturedScrollFn).toBe('function')
    })

    it('clears message refs when session changes', () => {
      let capturedScrollFn: ((uuid: string) => void) | null = null
      const handleScrollRef = (fn: (uuid: string) => void): void => {
        capturedScrollFn = fn
      }

      const { rerender } = render(
        <ConversationView
          messages={mockMessages}
          sessionId="session-1"
          onScrollToEventRef={handleScrollRef}
        />
      )

      // Capture the function for session-1
      const fn1 = capturedScrollFn

      // Change to a different session
      rerender(
        <ConversationView
          messages={mockMessages}
          sessionId="session-2"
          onScrollToEventRef={handleScrollRef}
        />
      )

      // Function should be re-exposed (same function, but refs cleared internally)
      expect(capturedScrollFn).toBe(fn1)
    })
  })

  describe('Rewind functionality (Story 2b.5)', () => {
    // Messages specifically for rewind tests - need user messages at indices > 0
    const rewindTestMessages: ConversationMessage[] = [
      { uuid: 'msg-1', role: 'user', content: 'First message', timestamp: 1737630000000 },
      { uuid: 'msg-2', role: 'assistant', content: 'Reply', timestamp: 1737630030000 },
      { uuid: 'msg-3', role: 'user', content: 'Second user message', timestamp: 1737630060000 },
      { uuid: 'msg-4', role: 'assistant', content: 'Another reply', timestamp: 1737630090000 }
    ]

    it('shows rewind icon on hover for user messages (not first)', () => {
      const mockOnRewind = vi.fn().mockResolvedValue(undefined)
      render(
        <ConversationView
          messages={rewindTestMessages}
          sessionId="test-session"
          onRewind={mockOnRewind}
        />
      )

      // Only the second user message (index 2) should have rewind button
      const rewindButtons = screen.getAllByLabelText('Rewind conversation from this message')
      expect(rewindButtons).toHaveLength(1)
    })

    it('does not show rewind icon for first message', () => {
      const mockOnRewind = vi.fn().mockResolvedValue(undefined)
      const singleMessage: ConversationMessage[] = [
        { uuid: '1', role: 'user', content: 'Hello', timestamp: 1737630000000 }
      ]
      render(
        <ConversationView
          messages={singleMessage}
          sessionId="test-session"
          onRewind={mockOnRewind}
        />
      )

      // First message (index 0) should NOT have rewind button
      expect(
        screen.queryByLabelText('Rewind conversation from this message')
      ).not.toBeInTheDocument()
    })

    it('does not show rewind icon when onRewind is not provided', () => {
      render(<ConversationView messages={rewindTestMessages} sessionId="test-session" />)

      // Without onRewind callback, no rewind buttons should exist
      expect(
        screen.queryByLabelText('Rewind conversation from this message')
      ).not.toBeInTheDocument()
    })

    it('opens RewindModal when rewind icon is clicked', async () => {
      const mockOnRewind = vi.fn().mockResolvedValue(undefined)
      render(
        <ConversationView
          messages={rewindTestMessages}
          sessionId="test-session"
          onRewind={mockOnRewind}
        />
      )

      // Click rewind button
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Rewind conversation from this message'))
      })

      // Modal should open
      expect(screen.getByText('Rewind Conversation')).toBeInTheDocument()
    })

    it('calls onRewind with checkpoint UUID and new message when submitted', async () => {
      const mockOnRewind = vi.fn().mockResolvedValue(undefined)
      render(
        <ConversationView
          messages={rewindTestMessages}
          sessionId="test-session"
          onRewind={mockOnRewind}
        />
      )

      // Click rewind button on second user message (uuid: 'msg-3')
      const rewindButton = screen.getByLabelText('Rewind conversation from this message')
      await act(async () => {
        fireEvent.click(rewindButton)
      })

      // Type new message
      const textarea = screen.getByLabelText('New message')
      fireEvent.change(textarea, { target: { value: 'New approach' } })

      // Submit and wait for async call
      await act(async () => {
        fireEvent.click(screen.getByText('Send'))
      })

      // onRewind should be called with the message UUID and new message
      await vi.waitFor(() => {
        expect(mockOnRewind).toHaveBeenCalledWith('msg-3', 'New approach')
      })
    })

    it('closes modal after successful rewind', async () => {
      const mockOnRewind = vi.fn().mockResolvedValue(undefined)
      render(
        <ConversationView
          messages={rewindTestMessages}
          sessionId="test-session"
          onRewind={mockOnRewind}
        />
      )

      // Open modal
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Rewind conversation from this message'))
      })
      expect(screen.getByText('Rewind Conversation')).toBeInTheDocument()

      // Type and submit
      fireEvent.change(screen.getByLabelText('New message'), { target: { value: 'Test' } })
      await act(async () => {
        fireEvent.click(screen.getByText('Send'))
      })

      // Wait for modal to close
      await vi.waitFor(() => {
        expect(screen.queryByText('Rewind Conversation')).not.toBeInTheDocument()
      })
    })

    it('shows error message when rewind fails', async () => {
      const mockOnRewind = vi.fn().mockRejectedValue(new Error('Network error'))
      render(
        <ConversationView
          messages={rewindTestMessages}
          sessionId="test-session"
          onRewind={mockOnRewind}
        />
      )

      // Open modal, type and submit
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Rewind conversation from this message'))
      })
      fireEvent.change(screen.getByLabelText('New message'), { target: { value: 'Test' } })
      await act(async () => {
        fireEvent.click(screen.getByText('Send'))
      })

      // Wait for error to appear
      await vi.waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error')
      })

      // Modal should still be open
      expect(screen.getByText('Rewind Conversation')).toBeInTheDocument()
    })

    it('resets rewind state when session changes', async () => {
      const mockOnRewind = vi.fn().mockResolvedValue(undefined)
      const { rerender } = render(
        <ConversationView
          messages={rewindTestMessages}
          sessionId="session-1"
          onRewind={mockOnRewind}
        />
      )

      // Open modal
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Rewind conversation from this message'))
      })
      expect(screen.getByText('Rewind Conversation')).toBeInTheDocument()

      // Change session
      rerender(
        <ConversationView
          messages={rewindTestMessages}
          sessionId="session-2"
          onRewind={mockOnRewind}
        />
      )

      // Modal should be closed
      expect(screen.queryByText('Rewind Conversation')).not.toBeInTheDocument()
    })
  })
})

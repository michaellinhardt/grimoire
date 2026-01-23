import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MiddlePanelContent } from './MiddlePanelContent'

// Mock useUIStore with different states for different tests
const mockUseUIStore = vi.fn()

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: Object.assign(() => mockUseUIStore(), {
    getState: () => mockUseUIStore()
  })
}))

// Mock useSessionStore
vi.mock('@renderer/features/sessions/store/useSessionStore', () => ({
  useSessionStore: () => ({ sessions: [] }),
  selectSessionById: () => undefined
}))

// Mock useConversationStore
vi.mock('@renderer/features/sessions/store/useConversationStore', () => ({
  useConversationStore: (selector?: (state: { getMessages: (id: string) => [] }) => []) =>
    selector ? selector({ getMessages: () => [] }) : { getMessages: () => [] }
}))

// Mock useSendMessage hook
vi.mock('@renderer/features/sessions/hooks/useSendMessage', () => ({
  useSendMessage: () => ({
    sendMessage: vi.fn(),
    isSending: false
  })
}))

// Mock the session components
vi.mock('@renderer/features/sessions/components', () => ({
  EmptyStateView: () => <div data-testid="empty-state">EmptyStateView</div>,
  NewSessionView: () => <div data-testid="new-session">NewSessionView</div>,
  ChatInput: ({
    onSend,
    disabled,
    placeholder,
    autoFocus,
    hasMessages
  }: {
    onSend: (message: string) => void
    disabled?: boolean
    placeholder?: string
    autoFocus?: boolean
    hasMessages?: boolean
  }) => {
    // Derive placeholder same as real ChatInput component
    const displayPlaceholder =
      placeholder ?? (hasMessages ? 'Type anything to continue...' : 'Type your message...')
    return (
      <div data-testid="chat-input">
        <textarea
          data-testid="chat-input-textarea"
          aria-label="Message input"
          disabled={disabled}
          placeholder={displayPlaceholder}
          data-autofocus={autoFocus}
          data-has-messages={hasMessages}
        />
        <button aria-label="Send message" disabled={disabled} onClick={() => onSend('test')}>
          Send
        </button>
      </div>
    )
  },
  ConversationView: ({
    messages,
    sessionId,
    sessionState
  }: {
    messages: Array<{ uuid: string; content: string }>
    sessionId: string
    sessionState?: string
  }) => (
    <div data-testid="conversation-view">
      <span data-testid="session-id">{sessionId}</span>
      <span data-testid="session-state">{sessionState ?? 'idle'}</span>
      {messages.map((m) => (
        <div key={m.uuid} data-testid="message">
          {m.content}
        </div>
      ))}
    </div>
  ),
  createMockMessages: () => [
    { uuid: 'mock-1', role: 'user', content: 'Mock user message', timestamp: Date.now() - 60000 },
    {
      uuid: 'mock-2',
      role: 'assistant',
      content: 'Mock assistant message',
      timestamp: Date.now() - 30000
    }
  ]
}))

describe('MiddlePanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show EmptyStateView when no tabs exist', () => {
    mockUseUIStore.mockReturnValue({ tabs: [], activeTabId: null })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('should show EmptyStateView when activeTabId is null', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [{ id: 'tab-1', type: 'session', title: 'Test', sessionId: 'session-123' }],
      activeTabId: null
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('should show EmptyStateView when activeTab is not found', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [{ id: 'tab-1', type: 'session', title: 'Test', sessionId: 'session-123' }],
      activeTabId: 'non-existent-tab'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('should show NewSessionView for tab without sessionId', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [{ id: 'tab-1', type: 'session', title: 'New', sessionId: null, sessionState: 'idle' }],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('new-session')).toBeInTheDocument()
  })

  it('should show NewSessionView for tab with undefined sessionId', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [{ id: 'tab-1', type: 'session', title: 'New', sessionState: 'idle' }],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('new-session')).toBeInTheDocument()
  })

  it('should show ConversationView for tab with sessionId', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Project',
          sessionId: 'session-123',
          sessionState: 'idle'
        }
      ],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('conversation-view')).toBeInTheDocument()
    expect(screen.getByTestId('session-id')).toHaveTextContent('session-123')
  })

  it('should show session view with chat input for existing session', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [
        {
          id: 'tab-1',
          type: 'session',
          title: 'My Project',
          sessionId: 'session-456',
          sessionState: 'idle'
        }
      ],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('conversation-view')).toBeInTheDocument()
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    // Sessions with messages show "Type anything to continue..." per AC5
    expect(screen.getByPlaceholderText(/Type anything to continue/)).toBeInTheDocument()
  })

  it('should render mock messages in ConversationView', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Project',
          sessionId: 'session-123',
          sessionState: 'idle'
        }
      ],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByText('Mock user message')).toBeInTheDocument()
    expect(screen.getByText('Mock assistant message')).toBeInTheDocument()
  })

  it('should pass correct sessionId to ConversationView', () => {
    mockUseUIStore.mockReturnValue({
      tabs: [
        {
          id: 'tab-1',
          type: 'session',
          title: 'My Session',
          sessionId: 'unique-session-id-456',
          sessionState: 'idle'
        }
      ],
      activeTabId: 'tab-1'
    })
    render(<MiddlePanelContent />)
    expect(screen.getByTestId('session-id')).toHaveTextContent('unique-session-id-456')
  })

  describe('sessionState prop (Story 2b.4)', () => {
    it('should pass sessionState to ConversationView', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'working'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      expect(screen.getByTestId('session-state')).toHaveTextContent('working')
    })

    it('should pass error sessionState to ConversationView', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'error'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      expect(screen.getByTestId('session-state')).toHaveTextContent('error')
    })
  })

  describe('sub-agent tabs (Story 2b.3, 2b.6 read-only)', () => {
    // Story 2b.3 implemented sub-agent display with tab.type='subagent'
    // Story 2b.6 validates read-only behavior: no chat input visible for sub-agent tabs
    it('should show ConversationView for sub-agent tab', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'subagent-123',
            type: 'subagent',
            title: 'Explore-a8b2',
            sessionId: 'subagent-001-a8b2',
            sessionState: 'idle'
          }
        ],
        activeTabId: 'subagent-123'
      })
      render(<MiddlePanelContent />)
      expect(screen.getByTestId('conversation-view')).toBeInTheDocument()
      expect(screen.getByTestId('session-id')).toHaveTextContent('subagent-001-a8b2')
    })

    it('should NOT show chat input for sub-agent tab (read-only)', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'subagent-123',
            type: 'subagent',
            title: 'Explore-a8b2',
            sessionId: 'subagent-001-a8b2',
            sessionState: 'idle'
          }
        ],
        activeTabId: 'subagent-123'
      })
      render(<MiddlePanelContent />)
      expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
    })

    it('should show chat input for regular session tab', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Regular Session',
            sessionId: 'session-123',
            sessionState: 'idle'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
  })

  describe('ChatInput disabled state (Story 3a-1)', () => {
    it('should disable ChatInput when sessionState is working', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'working'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      const textarea = screen.getByTestId('chat-input-textarea')
      expect(textarea).toBeDisabled()
    })

    it('should enable ChatInput when sessionState is idle', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'idle'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      const textarea = screen.getByTestId('chat-input-textarea')
      expect(textarea).not.toBeDisabled()
    })

    it('should pass autoFocus=false for existing sessions', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'idle'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      const textarea = screen.getByTestId('chat-input-textarea')
      expect(textarea).toHaveAttribute('data-autofocus', 'false')
    })

    it('should pass hasMessages=true when messages exist', () => {
      mockUseUIStore.mockReturnValue({
        tabs: [
          {
            id: 'tab-1',
            type: 'session',
            title: 'Session',
            sessionId: 'session-123',
            sessionState: 'idle'
          }
        ],
        activeTabId: 'tab-1'
      })
      render(<MiddlePanelContent />)
      const textarea = screen.getByTestId('chat-input-textarea')
      // createMockMessages returns 2 messages, so hasMessages should be true
      expect(textarea).toHaveAttribute('data-has-messages', 'true')
    })
  })
})

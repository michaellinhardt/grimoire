import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MiddlePanelContent } from './MiddlePanelContent'

// Mock useUIStore with different states for different tests
const mockUseUIStore = vi.fn()

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: () => mockUseUIStore()
}))

// Mock the session components
vi.mock('@renderer/features/sessions/components', () => ({
  EmptyStateView: () => <div data-testid="empty-state">EmptyStateView</div>,
  NewSessionView: () => <div data-testid="new-session">NewSessionView</div>,
  ChatInputPlaceholder: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="chat-input-placeholder">{placeholder || 'Type your message...'}</div>
  ),
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

  it('should show session view with chat input placeholder for existing session', () => {
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
    expect(screen.getByTestId('chat-input-placeholder')).toBeInTheDocument()
    expect(screen.getByText(/Type your message/)).toBeInTheDocument()
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

  describe('sub-agent tabs (Story 2b.3)', () => {
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
      expect(screen.queryByTestId('chat-input-placeholder')).not.toBeInTheDocument()
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
      expect(screen.getByTestId('chat-input-placeholder')).toBeInTheDocument()
    })
  })
})

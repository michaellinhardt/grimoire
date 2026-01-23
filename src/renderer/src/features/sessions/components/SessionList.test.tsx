import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionList } from './SessionList'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

// Mock session data
const createMockSession = (overrides: Partial<SessionWithExists> = {}): SessionWithExists => ({
  id: overrides.id ?? 'test-session-' + Math.random().toString(36).slice(2),
  folderPath: '/Users/test/myproject',
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 3600000,
  lastAccessedAt: Date.now() - 3600000,
  archived: false,
  isPinned: false,
  forkedFromSessionId: null,
  isHidden: false,
  exists: true,
  ...overrides
})

// Store mocks
const mockLoadSessions = vi.fn()
const mockFocusOrOpenSession = vi.fn()

let mockSessionStoreState = {
  sessions: [] as SessionWithExists[],
  isLoading: false,
  loadSessions: mockLoadSessions
}

let mockUIStoreState = {
  focusOrOpenSession: mockFocusOrOpenSession,
  tabs: [] as Array<{ id: string; sessionId: string | null }>,
  activeTabId: null as string | null,
  showArchived: false
}

// Mock stores
vi.mock('../store/useSessionStore', () => ({
  useSessionStore: () => mockSessionStoreState
}))

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: () => mockUIStoreState
}))

// Mock window.grimoireAPI
const mockUpdateLastAccessed = vi.fn().mockResolvedValue({ success: true })
const mockGetActiveProcesses = vi.fn().mockResolvedValue([])
const mockArchive = vi.fn().mockResolvedValue({ success: true })
const mockUnarchive = vi.fn().mockResolvedValue({ success: true })
const mockOnInstanceStateChanged = vi.fn(() => vi.fn()) // Returns cleanup function

Object.defineProperty(window, 'grimoireAPI', {
  value: {
    sessions: {
      updateLastAccessed: mockUpdateLastAccessed,
      getActiveProcesses: mockGetActiveProcesses,
      archive: mockArchive,
      unarchive: mockUnarchive,
      onInstanceStateChanged: mockOnInstanceStateChanged
    }
  },
  writable: true
})

describe('SessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock states
    mockSessionStoreState = {
      sessions: [],
      isLoading: false,
      loadSessions: mockLoadSessions
    }

    mockUIStoreState = {
      focusOrOpenSession: mockFocusOrOpenSession,
      tabs: [],
      activeTabId: null,
      showArchived: false
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls loadSessions on mount', async () => {
    await act(async () => {
      render(<SessionList />)
    })
    expect(mockLoadSessions).toHaveBeenCalledTimes(1)
  })

  it('shows loading state when isLoading is true', async () => {
    mockSessionStoreState.isLoading = true
    await act(async () => {
      render(<SessionList />)
    })
    expect(screen.getByText('Loading sessions...')).toBeInTheDocument()
  })

  it('shows empty state when no sessions', async () => {
    mockSessionStoreState.sessions = []
    await act(async () => {
      render(<SessionList />)
    })
    expect(screen.getByText('No sessions found')).toBeInTheDocument()
  })

  it('renders sessions when available', async () => {
    mockSessionStoreState.sessions = [
      createMockSession({ id: 'session-a', folderPath: '/Users/test/project-a' }),
      createMockSession({ id: 'session-b', folderPath: '/Users/test/project-b' })
    ]
    await act(async () => {
      render(<SessionList />)
    })
    expect(screen.getByText('project-a')).toBeInTheDocument()
    expect(screen.getByText('project-b')).toBeInTheDocument()
  })

  it('filters out archived sessions when showArchived is false', async () => {
    mockUIStoreState.showArchived = false
    mockSessionStoreState.sessions = [
      createMockSession({
        id: 'active',
        folderPath: '/Users/test/active-project',
        archived: false
      }),
      createMockSession({
        id: 'archived',
        folderPath: '/Users/test/archived-project',
        archived: true
      })
    ]
    await act(async () => {
      render(<SessionList />)
    })
    expect(screen.getByText('active-project')).toBeInTheDocument()
    expect(screen.queryByText('archived-project')).not.toBeInTheDocument()
  })

  it('shows archived sessions when showArchived is true', async () => {
    mockUIStoreState.showArchived = true
    mockSessionStoreState.sessions = [
      createMockSession({
        id: 'active',
        folderPath: '/Users/test/active-project',
        archived: false
      }),
      createMockSession({
        id: 'archived',
        folderPath: '/Users/test/archived-project',
        archived: true
      })
    ]
    await act(async () => {
      render(<SessionList />)
    })
    expect(screen.getByText('active-project')).toBeInTheDocument()
    expect(screen.getByText('archived-project')).toBeInTheDocument()
  })

  it('filters out hidden sessions', async () => {
    mockSessionStoreState.sessions = [
      createMockSession({
        id: 'visible',
        folderPath: '/Users/test/visible-project',
        isHidden: false
      }),
      createMockSession({ id: 'hidden', folderPath: '/Users/test/hidden-project', isHidden: true })
    ]
    await act(async () => {
      render(<SessionList />)
    })
    expect(screen.getByText('visible-project')).toBeInTheDocument()
    expect(screen.queryByText('hidden-project')).not.toBeInTheDocument()
  })

  it('shows orphaned sessions with warning (does NOT filter them out)', async () => {
    mockSessionStoreState.sessions = [
      createMockSession({
        id: 'orphaned',
        folderPath: '/Users/test/orphaned-project',
        exists: false
      })
    ]
    await act(async () => {
      render(<SessionList />)
    })
    expect(screen.getByText('orphaned-project')).toBeInTheDocument()
    expect(screen.getByLabelText('Folder not found')).toBeInTheDocument()
  })

  it('sorts pinned sessions first', async () => {
    const now = Date.now()
    mockSessionStoreState.sessions = [
      createMockSession({
        id: 'not-pinned',
        folderPath: '/Users/test/not-pinned',
        isPinned: false,
        lastAccessedAt: now - 1000
      }),
      createMockSession({
        id: 'pinned',
        folderPath: '/Users/test/pinned',
        isPinned: true,
        lastAccessedAt: now - 10000
      })
    ]
    await act(async () => {
      render(<SessionList />)
    })

    // Find the main session buttons (ones containing project names)
    const allText = screen.getByText('not-pinned')
    const pinnedText = screen.getByText('pinned')

    // The pinned one should appear before the not-pinned one in the DOM
    expect(
      pinnedText.compareDocumentPosition(allText) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('sorts by lastAccessedAt descending within same pin status', async () => {
    const now = Date.now()
    mockSessionStoreState.sessions = [
      createMockSession({
        id: 'older',
        folderPath: '/Users/test/older',
        isPinned: false,
        lastAccessedAt: now - 10000
      }),
      createMockSession({
        id: 'newer',
        folderPath: '/Users/test/newer',
        isPinned: false,
        lastAccessedAt: now - 1000
      })
    ]
    await act(async () => {
      render(<SessionList />)
    })

    const olderText = screen.getByText('older')
    const newerText = screen.getByText('newer')

    // Newer should appear before older in the DOM
    expect(
      newerText.compareDocumentPosition(olderText) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('calls focusOrOpenSession when clicking a session', async () => {
    const session = createMockSession({ id: 'test-session', folderPath: '/Users/test/myproject' })
    mockSessionStoreState.sessions = [session]

    await act(async () => {
      render(<SessionList />)
    })

    // Find the main element by the project name (div with role="button")
    const sessionText = screen.getByText('myproject')
    const sessionElement = sessionText.closest('[role="button"]')

    await act(async () => {
      fireEvent.click(sessionElement!)
    })

    expect(mockFocusOrOpenSession).toHaveBeenCalledWith(session.id, 'myproject')
  })

  it('calls updateLastAccessed when clicking a session', async () => {
    const session = createMockSession({ id: 'test-session', folderPath: '/Users/test/myproject' })
    mockSessionStoreState.sessions = [session]

    await act(async () => {
      render(<SessionList />)
    })

    const sessionText = screen.getByText('myproject')
    const sessionElement = sessionText.closest('[role="button"]')

    await act(async () => {
      fireEvent.click(sessionElement!)
    })

    // updateLastAccessed is called synchronously (fire-and-forget pattern)
    expect(mockUpdateLastAccessed).toHaveBeenCalledWith(session.id)
  })

  it('calls getActiveProcesses on mount', async () => {
    await act(async () => {
      render(<SessionList />)
    })

    // Initial fetch should happen synchronously on mount
    expect(mockGetActiveProcesses).toHaveBeenCalled()
  })

  it('marks session as working when in active processes', async () => {
    const session = createMockSession({
      id: 'working-session',
      folderPath: '/Users/test/working-project'
    })
    mockSessionStoreState.sessions = [session]
    mockGetActiveProcesses.mockResolvedValue([session.id])

    await act(async () => {
      render(<SessionList />)
    })

    // Wait for the async effect to complete
    await waitFor(() => {
      expect(screen.getByLabelText('Session is working')).toBeInTheDocument()
    })
  })

  it('highlights active session when its tab is the active tab', async () => {
    const session = createMockSession({
      id: 'active-session',
      folderPath: '/Users/test/active-session'
    })
    mockSessionStoreState.sessions = [session]
    mockUIStoreState.tabs = [{ id: 'tab-1', sessionId: session.id }]
    mockUIStoreState.activeTabId = 'tab-1'

    await act(async () => {
      render(<SessionList />)
    })

    const sessionText = screen.getByText('active-session')
    const sessionElement = sessionText.closest('[role="button"]')
    expect(sessionElement).toHaveClass('bg-[var(--accent-muted)]')
  })

  it('does not highlight session when its tab exists but is not the active tab', async () => {
    const session = createMockSession({
      id: 'inactive-session',
      folderPath: '/Users/test/inactive-session'
    })
    mockSessionStoreState.sessions = [session]
    mockUIStoreState.tabs = [
      { id: 'tab-1', sessionId: session.id },
      { id: 'tab-2', sessionId: null }
    ]
    mockUIStoreState.activeTabId = 'tab-2'

    await act(async () => {
      render(<SessionList />)
    })

    const sessionText = screen.getByText('inactive-session')
    const sessionElement = sessionText.closest('[role="button"]')
    expect(sessionElement).not.toHaveClass('bg-[var(--accent-muted)]')
  })

  // Story 2a.3: Archive functionality tests
  describe('Archive functionality', () => {
    it('calls archive IPC and reloads sessions when archiving', async () => {
      const user = userEvent.setup()
      const session = createMockSession({
        id: 'test-id',
        folderPath: '/Users/test/project',
        archived: false
      })
      mockSessionStoreState.sessions = [session]

      await act(async () => {
        render(<SessionList />)
      })

      // Open the 3-dot menu and click Archive
      await user.click(screen.getByLabelText('Session options'))
      await user.click(screen.getByText('Archive'))

      await waitFor(() => {
        expect(mockArchive).toHaveBeenCalledWith('test-id')
        expect(mockLoadSessions).toHaveBeenCalled()
      })
    })

    it('calls unarchive IPC and reloads sessions when unarchiving', async () => {
      const user = userEvent.setup()
      mockUIStoreState.showArchived = true
      const session = createMockSession({
        id: 'archived-id',
        folderPath: '/Users/test/archived-project',
        archived: true
      })
      mockSessionStoreState.sessions = [session]

      await act(async () => {
        render(<SessionList />)
      })

      // Open the 3-dot menu and click Unarchive
      await user.click(screen.getByLabelText('Session options'))
      await user.click(screen.getByText('Unarchive'))

      await waitFor(() => {
        expect(mockUnarchive).toHaveBeenCalledWith('archived-id')
        expect(mockLoadSessions).toHaveBeenCalled()
      })
    })

    it('passes onArchive and onUnarchive props to SessionListItem', async () => {
      const session = createMockSession({ id: 'test-session', folderPath: '/Users/test/project' })
      mockSessionStoreState.sessions = [session]

      await act(async () => {
        render(<SessionList />)
      })

      // The 3-dot menu button should be rendered (verifies props are passed)
      expect(screen.getByLabelText('Session options')).toBeInTheDocument()
    })

    it('handles archive failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockArchive.mockRejectedValue(new Error('Archive IPC failed'))
      const user = userEvent.setup()
      const session = createMockSession({
        id: 'test-id',
        folderPath: '/Users/test/project',
        archived: false
      })
      mockSessionStoreState.sessions = [session]

      await act(async () => {
        render(<SessionList />)
      })

      await user.click(screen.getByLabelText('Session options'))
      await user.click(screen.getByText('Archive'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to archive session:', expect.any(Error))
      })

      // loadSessions should NOT have been called on failure
      expect(mockLoadSessions).toHaveBeenCalledTimes(1) // Only the initial mount call

      consoleSpy.mockRestore()
    })

    it('handles unarchive failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockUnarchive.mockRejectedValue(new Error('Unarchive IPC failed'))
      const user = userEvent.setup()
      mockUIStoreState.showArchived = true
      const session = createMockSession({
        id: 'archived-id',
        folderPath: '/Users/test/archived-project',
        archived: true
      })
      mockSessionStoreState.sessions = [session]

      await act(async () => {
        render(<SessionList />)
      })

      await user.click(screen.getByLabelText('Session options'))
      await user.click(screen.getByText('Unarchive'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to unarchive session:', expect.any(Error))
      })

      // loadSessions should NOT have been called on failure
      expect(mockLoadSessions).toHaveBeenCalledTimes(1) // Only the initial mount call

      consoleSpy.mockRestore()
    })
  })
})

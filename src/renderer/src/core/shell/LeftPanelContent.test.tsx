import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeftPanelContent } from './LeftPanelContent'

// Mock stores
const mockSetLeftPanelCollapsed = vi.fn()
const mockSetShowArchived = vi.fn()
const mockLoadSessions = vi.fn()
const mockFocusOrOpenSession = vi.fn()

let mockUIStoreState = {
  setLeftPanelCollapsed: mockSetLeftPanelCollapsed,
  showArchived: false,
  setShowArchived: mockSetShowArchived,
  focusOrOpenSession: mockFocusOrOpenSession
}

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: Object.assign(() => mockUIStoreState, {
    getState: () => mockUIStoreState
  })
}))

vi.mock('@renderer/features/sessions/store/useSessionStore', () => ({
  useSessionStore: Object.assign(
    () => ({
      sessions: [],
      isLoading: false,
      loadSessions: mockLoadSessions
    }),
    {
      getState: () => ({ loadSessions: mockLoadSessions })
    }
  )
}))

// Mock SessionList to avoid complex nested rendering
vi.mock('@renderer/features/sessions/components', () => ({
  SessionList: () => <div data-testid="session-list">SessionList Mock</div>
}))

// Mock window.grimoireAPI
const mockSelectFolder = vi.fn()
const mockCreate = vi.fn()
const mockList = vi.fn()
const mockGetActiveProcesses = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  mockUIStoreState = {
    setLeftPanelCollapsed: mockSetLeftPanelCollapsed,
    showArchived: false,
    setShowArchived: mockSetShowArchived,
    focusOrOpenSession: mockFocusOrOpenSession
  }

  mockSelectFolder.mockResolvedValue({ canceled: false, folderPath: '/test/project' })
  mockCreate.mockResolvedValue({ sessionId: 'new-session-uuid' })
  mockList.mockResolvedValue([])
  mockGetActiveProcesses.mockResolvedValue([])

  Object.defineProperty(window, 'grimoireAPI', {
    writable: true,
    configurable: true,
    value: {
      sessions: {
        create: mockCreate,
        list: mockList,
        getActiveProcesses: mockGetActiveProcesses
      },
      dialog: {
        selectFolder: mockSelectFolder
      }
    }
  })
})

describe('LeftPanelContent', () => {
  it('renders Sessions title in topbar', () => {
    render(<LeftPanelContent />)
    expect(screen.getByText('Sessions')).toBeInTheDocument()
  })

  it('renders new session button with correct aria-label', () => {
    render(<LeftPanelContent />)
    expect(screen.getByLabelText('New session')).toBeInTheDocument()
  })

  it('renders show archived toggle button', () => {
    render(<LeftPanelContent />)
    expect(screen.getByLabelText('Show archived sessions')).toBeInTheDocument()
  })

  it('renders SessionList component', () => {
    render(<LeftPanelContent />)
    expect(screen.getByTestId('session-list')).toBeInTheDocument()
  })

  describe('New Session Flow', () => {
    it('opens folder picker when new session button is clicked', async () => {
      const user = userEvent.setup()
      render(<LeftPanelContent />)

      await user.click(screen.getByLabelText('New session'))

      expect(mockSelectFolder).toHaveBeenCalledTimes(1)
    })

    it('creates session and opens tab when folder is selected', async () => {
      const user = userEvent.setup()
      render(<LeftPanelContent />)

      await user.click(screen.getByLabelText('New session'))

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith('/test/project')
        expect(mockLoadSessions).toHaveBeenCalled()
        expect(mockFocusOrOpenSession).toHaveBeenCalledWith('new-session-uuid', 'project')
      })
    })

    it('does not create session when folder picker is canceled', async () => {
      mockSelectFolder.mockResolvedValue({ canceled: true, folderPath: null })
      const user = userEvent.setup()
      render(<LeftPanelContent />)

      await user.click(screen.getByLabelText('New session'))

      await waitFor(() => {
        expect(mockSelectFolder).toHaveBeenCalled()
      })

      expect(mockCreate).not.toHaveBeenCalled()
      expect(mockLoadSessions).not.toHaveBeenCalled()
      expect(mockFocusOrOpenSession).not.toHaveBeenCalled()
    })

    it('handles folder picker returning null folderPath', async () => {
      mockSelectFolder.mockResolvedValue({ canceled: false, folderPath: null })
      const user = userEvent.setup()
      render(<LeftPanelContent />)

      await user.click(screen.getByLabelText('New session'))

      await waitFor(() => {
        expect(mockSelectFolder).toHaveBeenCalled()
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('logs error when session creation fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockCreate.mockRejectedValue(new Error('IPC create failed'))
      const user = userEvent.setup()
      render(<LeftPanelContent />)

      await user.click(screen.getByLabelText('New session'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to create new session:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('logs error when folder picker fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSelectFolder.mockRejectedValue(new Error('Dialog IPC failed'))
      const user = userEvent.setup()
      render(<LeftPanelContent />)

      await user.click(screen.getByLabelText('New session'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to create new session:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Show Archived Toggle', () => {
    it('calls setShowArchived when toggle is clicked', async () => {
      const user = userEvent.setup()
      render(<LeftPanelContent />)

      await user.click(screen.getByLabelText('Show archived sessions'))

      expect(mockSetShowArchived).toHaveBeenCalledWith(true)
    })

    it('shows correct aria-label when archived sessions are shown', () => {
      mockUIStoreState.showArchived = true
      render(<LeftPanelContent />)

      expect(screen.getByLabelText('Hide archived sessions')).toBeInTheDocument()
    })

    it('has aria-pressed attribute reflecting showArchived state', () => {
      render(<LeftPanelContent />)
      const toggleButton = screen.getByLabelText('Show archived sessions')
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false')
    })

    it('has aria-pressed true when showArchived is true', () => {
      mockUIStoreState.showArchived = true
      render(<LeftPanelContent />)
      const toggleButton = screen.getByLabelText('Hide archived sessions')
      expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('applies accent color when showArchived is true', () => {
      mockUIStoreState.showArchived = true
      render(<LeftPanelContent />)
      const toggleButton = screen.getByLabelText('Hide archived sessions')
      expect(toggleButton.className).toContain('text-[var(--accent)]')
    })

    it('applies muted color when showArchived is false', () => {
      render(<LeftPanelContent />)
      const toggleButton = screen.getByLabelText('Show archived sessions')
      expect(toggleButton.className).toContain('text-[var(--text-muted)]')
    })
  })
})

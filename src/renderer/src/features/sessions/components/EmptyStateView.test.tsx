import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EmptyStateView } from './EmptyStateView'

// grimoireAPI is on window, NOT a module import - mock via Object.defineProperty
const mockSelectFolder = vi.fn().mockResolvedValue({ canceled: false, folderPath: '/test/path' })
const mockCreate = vi.fn().mockResolvedValue({ sessionId: 'new-session-id' })
const mockLoadSessions = vi.fn()
const mockFocusOrOpenSession = vi.fn()

// Mock Zustand stores - use @renderer alias consistently
vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: {
    getState: () => ({
      focusOrOpenSession: mockFocusOrOpenSession
    })
  }
}))

vi.mock('@renderer/features/sessions/store/useSessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      loadSessions: mockLoadSessions
    })
  }
}))

beforeEach(() => {
  vi.clearAllMocks()

  Object.defineProperty(window, 'grimoireAPI', {
    writable: true,
    configurable: true,
    value: {
      sessions: {
        create: mockCreate,
        list: vi.fn().mockResolvedValue([]),
        getActiveProcesses: vi.fn().mockResolvedValue([])
      },
      dialog: {
        selectFolder: mockSelectFolder
      }
    }
  })
})

describe('EmptyStateView', () => {
  it('should render the empty state message and button', () => {
    render(<EmptyStateView />)
    expect(screen.getByText('Select a session or start a new one')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new session/i })).toBeInTheDocument()
  })

  it('should render the MessageSquare icon', () => {
    render(<EmptyStateView />)
    // The icon should be present - lucide-react icons render as SVG
    const container = document.querySelector('.flex-1.flex.flex-col')
    expect(container).toBeInTheDocument()
    // Check for SVG element (the icon)
    const svg = container?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('should call folder picker when New Session clicked', async () => {
    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))
    expect(mockSelectFolder).toHaveBeenCalled()
  })

  it('should create session and open tab after folder selection', async () => {
    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))

    // Wait for the full async chain to complete
    await waitFor(() => {
      expect(mockFocusOrOpenSession).toHaveBeenCalledWith('new-session-id', 'path')
    })

    // Verify the intermediate steps also happened
    expect(mockSelectFolder).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith('/test/path')
    expect(mockLoadSessions).toHaveBeenCalled()
  })

  it('should not create session when folder picker is canceled', async () => {
    mockSelectFolder.mockResolvedValueOnce({ canceled: true, folderPath: null })
    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))

    // Give time for any async operations (there shouldn't be any after cancel)
    await waitFor(() => {
      expect(mockSelectFolder).toHaveBeenCalled()
    })

    // These should NOT have been called due to cancellation
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockLoadSessions).not.toHaveBeenCalled()
    expect(mockFocusOrOpenSession).not.toHaveBeenCalled()
  })

  it('should handle IPC errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreate.mockRejectedValueOnce(new Error('IPC failed'))

    const user = userEvent.setup()
    render(<EmptyStateView />)
    await user.click(screen.getByRole('button', { name: /new session/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create new session:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })
})

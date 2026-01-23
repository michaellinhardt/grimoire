import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionListItem } from './SessionListItem'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

const createMockSession = (overrides: Partial<SessionWithExists> = {}): SessionWithExists => ({
  id: 'test-session-id',
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

describe('SessionListItem', () => {
  const mockOnClick = vi.fn()
  const mockOnArchive = vi.fn()
  const mockOnUnarchive = vi.fn()

  const defaultProps = {
    isActive: false,
    isWorking: false,
    onClick: mockOnClick,
    onArchive: mockOnArchive,
    onUnarchive: mockOnUnarchive
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders session display name from folder path', () => {
    const session = createMockSession({ folderPath: '/Users/test/awesome-project' })
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.getByText('awesome-project')).toBeInTheDocument()
  })

  it('shows folder path below name', () => {
    const session = createMockSession({ folderPath: '/Users/test/myproject' })
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.getByText('/Users/test/myproject')).toBeInTheDocument()
  })

  it('shows relative timestamp', () => {
    const session = createMockSession({ lastAccessedAt: Date.now() - 3600000 }) // 1 hour ago
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.getByText('1h ago')).toBeInTheDocument()
  })

  it('shows pin icon when isPinned is true', () => {
    const session = createMockSession({ isPinned: true })
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.getByLabelText('Pinned session')).toBeInTheDocument()
  })

  it('does not show pin icon when isPinned is false', () => {
    const session = createMockSession({ isPinned: false })
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.queryByLabelText('Pinned session')).not.toBeInTheDocument()
  })

  it('shows lightning bolt when isWorking is true', () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} isWorking={true} />)
    expect(screen.getByLabelText('Session is working')).toBeInTheDocument()
  })

  it('does not show lightning bolt when isWorking is false', () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.queryByLabelText('Session is working')).not.toBeInTheDocument()
  })

  it('shows warning icon when exists is false (orphaned)', () => {
    const session = createMockSession({ exists: false })
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.getByLabelText('Folder not found')).toBeInTheDocument()
  })

  it('does not show warning icon when exists is true', () => {
    const session = createMockSession({ exists: true })
    render(<SessionListItem session={session} {...defaultProps} />)
    expect(screen.queryByLabelText('Folder not found')).not.toBeInTheDocument()
  })

  it('applies different styles to folder path when orphaned', () => {
    const session = createMockSession({ exists: false, folderPath: '/orphaned/path' })
    render(<SessionListItem session={session} {...defaultProps} />)
    const pathElement = screen.getByText('/orphaned/path')
    expect(pathElement).toHaveClass('text-[var(--error)]')
  })

  it('applies normal styles to folder path when not orphaned', () => {
    const session = createMockSession({ exists: true, folderPath: '/existing/path' })
    render(<SessionListItem session={session} {...defaultProps} />)
    const pathElement = screen.getByText('/existing/path')
    expect(pathElement).toHaveClass('text-[var(--text-muted)]')
  })

  it('calls onClick when clicked', () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} />)
    // Find the main element that contains the session name (div with role="button")
    const sessionElement = screen.getByText('myproject').closest('[role="button"]')
    fireEvent.click(sessionElement!)
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('has accessible button role', () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} />)
    // Main container has role="button", plus the 3-dot menu has a real button
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('applies active state styles when isActive is true', () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} isActive={true} />)
    const mainElement = screen.getByText('myproject').closest('[role="button"]')
    expect(mainElement).toHaveClass('bg-[var(--accent-muted)]')
    expect(mainElement).toHaveClass('border-[var(--accent)]')
  })

  it('applies working state border when isWorking is true', () => {
    const session = createMockSession()
    render(<SessionListItem session={session} {...defaultProps} isWorking={true} />)
    const mainElement = screen.getByText('myproject').closest('[role="button"]')
    expect(mainElement).toHaveClass('border-l-[var(--success)]')
  })

  // Story 2a.3: Archive functionality tests
  describe('Archive functionality', () => {
    it('shows 3-dot menu button', () => {
      const session = createMockSession()
      render(<SessionListItem session={session} {...defaultProps} />)
      const optionsButton = screen.getByLabelText('Session options')
      expect(optionsButton).toBeInTheDocument()
    })

    it('opens menu without triggering onClick when 3-dot button is clicked', async () => {
      const session = createMockSession()
      const user = userEvent.setup()
      render(<SessionListItem session={session} {...defaultProps} />)

      await user.click(screen.getByLabelText('Session options'))
      expect(mockOnClick).not.toHaveBeenCalled()
      expect(screen.getByText('Archive')).toBeInTheDocument()
    })

    it('shows archived visual styling when session is archived', () => {
      const session = createMockSession({ archived: true })
      render(<SessionListItem session={session} {...defaultProps} />)

      const mainElement = screen.getByText('myproject').closest('[role="button"]')
      expect(mainElement?.className).toContain('opacity-60')
    })

    it('shows folder path with italic style for archived sessions', () => {
      const session = createMockSession({ archived: true })
      render(<SessionListItem session={session} {...defaultProps} />)

      const folderPath = screen.getByText('/Users/test/myproject')
      expect(folderPath.className).toContain('italic')
    })

    it('calls onArchive when Archive menu item is clicked', async () => {
      const session = createMockSession({ archived: false })
      const user = userEvent.setup()
      render(<SessionListItem session={session} {...defaultProps} />)

      await user.click(screen.getByLabelText('Session options'))
      await user.click(screen.getByText('Archive'))
      expect(mockOnArchive).toHaveBeenCalledTimes(1)
    })

    it('calls onUnarchive when Unarchive menu item is clicked', async () => {
      const session = createMockSession({ archived: true })
      const user = userEvent.setup()
      render(<SessionListItem session={session} {...defaultProps} />)

      await user.click(screen.getByLabelText('Session options'))
      await user.click(screen.getByText('Unarchive'))
      expect(mockOnUnarchive).toHaveBeenCalledTimes(1)
    })

    it('shows Archive option for non-archived session', async () => {
      const session = createMockSession({ archived: false })
      const user = userEvent.setup()
      render(<SessionListItem session={session} {...defaultProps} />)

      await user.click(screen.getByLabelText('Session options'))
      expect(screen.getByText('Archive')).toBeInTheDocument()
      expect(screen.queryByText('Unarchive')).not.toBeInTheDocument()
    })

    it('shows Unarchive option for archived session', async () => {
      const session = createMockSession({ archived: true })
      const user = userEvent.setup()
      render(<SessionListItem session={session} {...defaultProps} />)

      await user.click(screen.getByLabelText('Session options'))
      expect(screen.getByText('Unarchive')).toBeInTheDocument()
      expect(screen.queryByText('Archive')).not.toBeInTheDocument()
    })
  })

  // Story 2a.3: Right-click context menu tests
  describe('Right-click context menu', () => {
    it('opens context menu on right-click', async () => {
      const session = createMockSession({ archived: false })
      render(<SessionListItem session={session} {...defaultProps} />)

      const mainElement = screen.getByText('myproject').closest('[role="button"]')
      fireEvent.contextMenu(mainElement!)

      // Context menu should show Archive option for non-archived session
      expect(await screen.findByText('Archive')).toBeInTheDocument()
    })

    it('shows Unarchive in context menu for archived session', async () => {
      const session = createMockSession({ archived: true })
      render(<SessionListItem session={session} {...defaultProps} />)

      const mainElement = screen.getByText('myproject').closest('[role="button"]')
      fireEvent.contextMenu(mainElement!)

      expect(await screen.findByText('Unarchive')).toBeInTheDocument()
      expect(screen.queryByText('Archive')).not.toBeInTheDocument()
    })

    it('calls onArchive when Archive is selected from context menu', async () => {
      const session = createMockSession({ archived: false })
      const user = userEvent.setup()
      render(<SessionListItem session={session} {...defaultProps} />)

      const mainElement = screen.getByText('myproject').closest('[role="button"]')
      fireEvent.contextMenu(mainElement!)

      // Wait for context menu to appear and click Archive
      const archiveItem = await screen.findByText('Archive')
      await user.click(archiveItem)
      expect(mockOnArchive).toHaveBeenCalledTimes(1)
    })

    it('calls onUnarchive when Unarchive is selected from context menu', async () => {
      const session = createMockSession({ archived: true })
      const user = userEvent.setup()
      render(<SessionListItem session={session} {...defaultProps} />)

      const mainElement = screen.getByText('myproject').closest('[role="button"]')
      fireEvent.contextMenu(mainElement!)

      // Wait for context menu to appear and click Unarchive
      const unarchiveItem = await screen.findByText('Unarchive')
      await user.click(unarchiveItem)
      expect(mockOnUnarchive).toHaveBeenCalledTimes(1)
    })
  })
})

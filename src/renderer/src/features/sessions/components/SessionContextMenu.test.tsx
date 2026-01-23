import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionContextMenu } from './SessionContextMenu'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

const createMockSession = (overrides: Partial<SessionWithExists> = {}): SessionWithExists => ({
  id: 'test-session-id',
  folderPath: '/test/path',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastAccessedAt: null,
  archived: false,
  isPinned: false,
  forkedFromSessionId: null,
  isHidden: false,
  exists: true,
  ...overrides
})

describe('SessionContextMenu', () => {
  const mockOnArchive = vi.fn()
  const mockOnUnarchive = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Archive option for non-archived session', async () => {
    const session = createMockSession({ archived: false })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    expect(screen.getByText('Archive')).toBeInTheDocument()
    expect(screen.queryByText('Unarchive')).not.toBeInTheDocument()
  })

  it('renders Unarchive option for archived session', async () => {
    const session = createMockSession({ archived: true })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    expect(screen.getByText('Unarchive')).toBeInTheDocument()
    expect(screen.queryByText('Archive')).not.toBeInTheDocument()
  })

  it('calls onArchive when Archive is clicked', async () => {
    const session = createMockSession({ archived: false })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    await user.click(screen.getByText('Archive'))
    expect(mockOnArchive).toHaveBeenCalledTimes(1)
  })

  it('calls onUnarchive when Unarchive is clicked', async () => {
    const session = createMockSession({ archived: true })
    const user = userEvent.setup()

    render(
      <SessionContextMenu
        session={session}
        trigger={<button>Open Menu</button>}
        onArchive={mockOnArchive}
        onUnarchive={mockOnUnarchive}
      />
    )

    await user.click(screen.getByText('Open Menu'))
    await user.click(screen.getByText('Unarchive'))
    expect(mockOnUnarchive).toHaveBeenCalledTimes(1)
  })
})

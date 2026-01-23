import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { TabBar } from './TabBar'
import type { Tab } from '@renderer/shared/store/useUIStore'

// Mock useUIStore
const mockAddTab = vi.fn()
const mockCloseTab = vi.fn()
const mockSetActiveTabId = vi.fn()
const mockSetLeftPanelCollapsed = vi.fn()
const mockSetRightPanelCollapsed = vi.fn()

let mockTabs: Tab[] = []
let mockActiveTabId: string | null = null
let mockLeftPanelCollapsed = false
let mockRightPanelCollapsed = false

vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: () => ({
    tabs: mockTabs,
    activeTabId: mockActiveTabId,
    addTab: mockAddTab,
    closeTab: mockCloseTab,
    setActiveTabId: mockSetActiveTabId,
    leftPanelCollapsed: mockLeftPanelCollapsed,
    rightPanelCollapsed: mockRightPanelCollapsed,
    setLeftPanelCollapsed: mockSetLeftPanelCollapsed,
    setRightPanelCollapsed: mockSetRightPanelCollapsed
  })
}))

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabs = []
    mockActiveTabId = null
    mockLeftPanelCollapsed = false
    mockRightPanelCollapsed = false
  })

  it('renders empty tab bar', () => {
    render(<TabBar />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByLabelText('New tab')).toBeInTheDocument()
  })

  it('renders tabs', () => {
    mockTabs = [
      {
        id: 'tab-1',
        type: 'session',
        title: 'Session 1',
        sessionId: 'session-1',
        sessionState: 'idle'
      },
      {
        id: 'tab-2',
        type: 'session',
        title: 'Session 2',
        sessionId: 'session-2',
        sessionState: 'idle'
      }
    ]
    mockActiveTabId = 'tab-1'

    render(<TabBar />)

    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 2')).toBeInTheDocument()
  })

  it('marks active tab with aria-selected', () => {
    mockTabs = [
      {
        id: 'tab-1',
        type: 'session',
        title: 'Session 1',
        sessionId: 'session-1',
        sessionState: 'idle'
      },
      {
        id: 'tab-2',
        type: 'session',
        title: 'Session 2',
        sessionId: 'session-2',
        sessionState: 'idle'
      }
    ]
    mockActiveTabId = 'tab-1'

    render(<TabBar />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls setActiveTabId when clicking a tab', () => {
    mockTabs = [
      {
        id: 'tab-1',
        type: 'session',
        title: 'Session 1',
        sessionId: 'session-1',
        sessionState: 'idle'
      },
      {
        id: 'tab-2',
        type: 'session',
        title: 'Session 2',
        sessionId: 'session-2',
        sessionState: 'idle'
      }
    ]
    mockActiveTabId = 'tab-1'

    render(<TabBar />)

    const secondTab = screen.getByText('Session 2').closest('[role="tab"]')!
    fireEvent.click(secondTab)

    expect(mockSetActiveTabId).toHaveBeenCalledWith('tab-2')
  })

  it('calls addTab when clicking new tab button', () => {
    render(<TabBar />)

    fireEvent.click(screen.getByLabelText('New tab'))

    expect(mockAddTab).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'session',
        title: 'New Session',
        sessionId: null,
        sessionState: 'idle'
      })
    )
  })

  describe('tab state indicators', () => {
    it('applies working class for working session', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Working',
          sessionId: 'session-1',
          sessionState: 'working'
        }
      ]
      mockActiveTabId = 'tab-1'

      const { container } = render(<TabBar />)

      const tab = container.querySelector('.tab--working')
      expect(tab).toBeInTheDocument()
    })

    it('applies error class for error session', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Error',
          sessionId: 'session-1',
          sessionState: 'error'
        }
      ]
      mockActiveTabId = 'tab-1'

      const { container } = render(<TabBar />)

      const tab = container.querySelector('.tab--error')
      expect(tab).toBeInTheDocument()
    })

    it('does not apply state class for idle session', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Idle',
          sessionId: 'session-1',
          sessionState: 'idle'
        }
      ]
      mockActiveTabId = 'tab-1'

      const { container } = render(<TabBar />)

      expect(container.querySelector('.tab--working')).not.toBeInTheDocument()
      expect(container.querySelector('.tab--error')).not.toBeInTheDocument()
    })
  })

  describe('sub-agent tab styling (Story 2b.3)', () => {
    it('applies tab--subagent class for sub-agent tabs', () => {
      mockTabs = [
        {
          id: 'subagent-123',
          type: 'subagent',
          title: 'Explore-a8b2',
          sessionId: 'subagent-001-a8b2',
          sessionState: 'idle'
        }
      ]
      mockActiveTabId = 'subagent-123'

      const { container } = render(<TabBar />)

      const subagentTab = container.querySelector('.tab--subagent')
      expect(subagentTab).toBeInTheDocument()
    })

    it('does not apply tab--subagent class for regular session tabs', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Session',
          sessionId: 'session-1',
          sessionState: 'idle'
        }
      ]
      mockActiveTabId = 'tab-1'

      const { container } = render(<TabBar />)

      expect(container.querySelector('.tab--subagent')).not.toBeInTheDocument()
    })

    it('applies both sub-agent and working classes when running', () => {
      mockTabs = [
        {
          id: 'subagent-123',
          type: 'subagent',
          title: 'Explore-a8b2',
          sessionId: 'subagent-001-a8b2',
          sessionState: 'working'
        }
      ]
      mockActiveTabId = 'subagent-123'

      const { container } = render(<TabBar />)

      // Should have both classes applied
      const tab = container.querySelector('[role="tab"]')
      expect(tab).toHaveClass('tab--subagent')
      expect(tab).toHaveClass('tab--working')
    })

    it('applies both sub-agent and error classes when errored', () => {
      mockTabs = [
        {
          id: 'subagent-123',
          type: 'subagent',
          title: 'Explore-a8b2',
          sessionId: 'subagent-001-a8b2',
          sessionState: 'error'
        }
      ]
      mockActiveTabId = 'subagent-123'

      const { container } = render(<TabBar />)

      const tab = container.querySelector('[role="tab"]')
      expect(tab).toHaveClass('tab--subagent')
      expect(tab).toHaveClass('tab--error')
    })

    it('displays sub-agent tab title correctly', () => {
      mockTabs = [
        {
          id: 'subagent-123',
          type: 'subagent',
          title: 'Explore-a8b2',
          sessionId: 'subagent-001-a8b2',
          sessionState: 'idle'
        }
      ]
      mockActiveTabId = 'subagent-123'

      render(<TabBar />)

      expect(screen.getByText('Explore-a8b2')).toBeInTheDocument()
    })
  })

  describe('close tab behavior', () => {
    it('closes idle tab immediately', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Idle Session',
          sessionId: 'session-1',
          sessionState: 'idle'
        }
      ]
      mockActiveTabId = 'tab-1'

      render(<TabBar />)

      const closeButton = screen.getByLabelText('Close Idle Session')
      fireEvent.click(closeButton)

      expect(mockCloseTab).toHaveBeenCalledWith('tab-1')
    })

    it('shows confirmation dialog for working tab', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Working Session',
          sessionId: 'session-1',
          sessionState: 'working'
        }
      ]
      mockActiveTabId = 'tab-1'

      render(<TabBar />)

      const closeButton = screen.getByLabelText('Close Working Session')
      fireEvent.click(closeButton)

      // Should not immediately close - dialog should appear
      expect(mockCloseTab).not.toHaveBeenCalled()
    })
  })

  describe('keyboard navigation', () => {
    it('supports Enter key to select tab', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Session 1',
          sessionId: 'session-1',
          sessionState: 'idle'
        },
        {
          id: 'tab-2',
          type: 'session',
          title: 'Session 2',
          sessionId: 'session-2',
          sessionState: 'idle'
        }
      ]
      mockActiveTabId = 'tab-1'

      render(<TabBar />)

      const secondTab = screen.getByText('Session 2').closest('[role="tab"]')!
      fireEvent.keyDown(secondTab, { key: 'Enter' })

      expect(mockSetActiveTabId).toHaveBeenCalledWith('tab-2')
    })

    it('supports Space key to select tab', () => {
      mockTabs = [
        {
          id: 'tab-1',
          type: 'session',
          title: 'Session 1',
          sessionId: 'session-1',
          sessionState: 'idle'
        },
        {
          id: 'tab-2',
          type: 'session',
          title: 'Session 2',
          sessionId: 'session-2',
          sessionState: 'idle'
        }
      ]
      mockActiveTabId = 'tab-1'

      render(<TabBar />)

      const secondTab = screen.getByText('Session 2').closest('[role="tab"]')!
      fireEvent.keyDown(secondTab, { key: ' ' })

      expect(mockSetActiveTabId).toHaveBeenCalledWith('tab-2')
    })
  })

  describe('panel toggle buttons', () => {
    it('shows left panel toggle when collapsed', () => {
      mockLeftPanelCollapsed = true

      render(<TabBar />)

      expect(screen.getByLabelText('Show left panel')).toBeInTheDocument()
    })

    it('shows right panel toggle when collapsed', () => {
      mockRightPanelCollapsed = true

      render(<TabBar />)

      expect(screen.getByLabelText('Show right panel')).toBeInTheDocument()
    })

    it('does not show left panel toggle when expanded', () => {
      mockLeftPanelCollapsed = false

      render(<TabBar />)

      expect(screen.queryByLabelText('Show left panel')).not.toBeInTheDocument()
    })

    it('calls setLeftPanelCollapsed when clicking toggle', () => {
      mockLeftPanelCollapsed = true

      render(<TabBar />)

      fireEvent.click(screen.getByLabelText('Show left panel'))

      expect(mockSetLeftPanelCollapsed).toHaveBeenCalledWith(false)
    })
  })
})

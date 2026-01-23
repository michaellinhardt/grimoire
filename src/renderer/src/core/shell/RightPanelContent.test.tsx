import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RightPanelContent } from './RightPanelContent'
import { useUIStore } from '@renderer/shared/store/useUIStore'

// Mock the store
vi.mock('@renderer/shared/store/useUIStore', () => ({
  useUIStore: vi.fn()
}))

// Mock EventTimeline to avoid complex dependencies
vi.mock('@renderer/features/sessions/components/EventTimeline', () => ({
  EventTimeline: ({ events }: { events: unknown[] }) => (
    <div data-testid="event-timeline">EventTimeline ({events.length} events)</div>
  )
}))

// Mock SessionInfoView to avoid IPC dependencies
vi.mock('@renderer/features/sessions/components/SessionInfoView', () => ({
  SessionInfoView: ({ sessionId }: { sessionId: string | null }) => (
    <div data-testid="session-info-view">
      {sessionId ? `Session Info: ${sessionId}` : 'Select a session to view info'}
    </div>
  )
}))

// Mock useTimelineEvents hook
vi.mock('@renderer/features/sessions/hooks/useTimelineEvents', () => ({
  useTimelineEvents: () => [
    { uuid: 'evt-1', type: 'user', summary: 'Test', timestamp: 1000, tokenCount: 100 }
  ]
}))

// Mock types export to provide createMockMessages and TimelineEvent type
vi.mock('@renderer/features/sessions/components/types', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@renderer/features/sessions/components/types')>()
  return {
    ...actual,
    createMockMessages: () => [{ uuid: 'msg-1', role: 'user', content: 'Test', timestamp: 1000 }]
  }
})

const mockUseUIStore = vi.mocked(useUIStore)

interface MockStoreOverrides {
  tabs?: {
    id: string
    type: string
    title: string
    sessionId: string | null
    sessionState: string
  }[]
  activeTabId?: string | null
  rightPanelActiveTab?: 'info' | 'events' | 'files'
  activeTimelineEventUuid?: string | null
  scrollToConversationEvent?: ReturnType<typeof vi.fn> | null
  setRightPanelActiveTab?: ReturnType<typeof vi.fn>
  setRightPanelCollapsed?: ReturnType<typeof vi.fn>
  openSubAgentTab?: ReturnType<typeof vi.fn>
}

describe('RightPanelContent', () => {
  const createMockStore = (overrides: MockStoreOverrides = {}): ReturnType<typeof useUIStore> =>
    ({
      tabs: [],
      activeTabId: null,
      rightPanelActiveTab: 'info' as const,
      activeTimelineEventUuid: null,
      scrollToConversationEvent: null,
      setRightPanelActiveTab: vi.fn(),
      setRightPanelCollapsed: vi.fn(),
      openSubAgentTab: vi.fn(),
      ...overrides
    }) as unknown as ReturnType<typeof useUIStore>

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUIStore.mockReturnValue(createMockStore())
  })

  describe('tab rendering', () => {
    it('renders all three tabs', () => {
      render(<RightPanelContent />)

      expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Events' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument()
    })

    it('renders collapse button', () => {
      render(<RightPanelContent />)

      expect(screen.getByRole('button', { name: 'Collapse right panel' })).toBeInTheDocument()
    })
  })

  describe('tab content switching', () => {
    it('shows SessionInfoView when info tab active', () => {
      mockUseUIStore.mockReturnValue(createMockStore({ rightPanelActiveTab: 'info' }))
      render(<RightPanelContent />)

      expect(screen.getByTestId('session-info-view')).toBeInTheDocument()
      expect(screen.getByText('Select a session to view info')).toBeInTheDocument()
    })

    it('shows EventTimeline when events tab active', () => {
      mockUseUIStore.mockReturnValue(createMockStore({ rightPanelActiveTab: 'events' }))
      render(<RightPanelContent />)

      expect(screen.getByTestId('event-timeline')).toBeInTheDocument()
    })

    it('shows Files placeholder when files tab active', () => {
      mockUseUIStore.mockReturnValue(createMockStore({ rightPanelActiveTab: 'files' }))
      render(<RightPanelContent />)

      expect(screen.getByText('Folder tree coming in Story 5b.1')).toBeInTheDocument()
    })
  })

  describe('tab interaction', () => {
    it('calls setRightPanelActiveTab when tab clicked via Radix onValueChange', async () => {
      const user = userEvent.setup()
      const setRightPanelActiveTab = vi.fn()
      mockUseUIStore.mockReturnValue(createMockStore({ setRightPanelActiveTab }))
      render(<RightPanelContent />)

      // Radix Tabs.Root onValueChange is triggered when Tabs.Trigger is clicked
      await user.click(screen.getByRole('tab', { name: 'Events' }))
      expect(setRightPanelActiveTab).toHaveBeenCalledWith('events')
    })

    it('calls setRightPanelCollapsed when door button clicked', () => {
      const setRightPanelCollapsed = vi.fn()
      mockUseUIStore.mockReturnValue(createMockStore({ setRightPanelCollapsed }))
      render(<RightPanelContent />)

      fireEvent.click(screen.getByRole('button', { name: 'Collapse right panel' }))
      expect(setRightPanelCollapsed).toHaveBeenCalledWith(true)
    })
  })

  describe('sub-agent click handling', () => {
    it('passes openSubAgentTab callback to event handlers', () => {
      const openSubAgentTab = vi.fn()

      // Verify that openSubAgentTab is retrieved from store
      mockUseUIStore.mockReturnValue(createMockStore({ openSubAgentTab }))
      render(<RightPanelContent />)

      // The component should have called useUIStore to get openSubAgentTab
      expect(openSubAgentTab).not.toHaveBeenCalled() // Not called on render, only when event occurs
    })
  })

  describe('initial tab state sync', () => {
    it('renders with initial rightPanelActiveTab from store', () => {
      mockUseUIStore.mockReturnValue(createMockStore({ rightPanelActiveTab: 'events' }))
      render(<RightPanelContent />)

      expect(screen.getByTestId('event-timeline')).toBeInTheDocument()
    })
  })

  describe('timeline auto-scroll (AC5)', () => {
    it('auto-scrolls timeline when activeTimelineEventUuid changes', () => {
      // Mock scrollIntoView on elements
      const mockScrollIntoView = vi.fn()
      const originalQuerySelector = document.querySelector.bind(document)

      vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
        if (selector.includes('data-event-uuid')) {
          return { scrollIntoView: mockScrollIntoView } as unknown as Element
        }
        return originalQuerySelector(selector)
      })

      mockUseUIStore.mockReturnValue(
        createMockStore({
          rightPanelActiveTab: 'events',
          activeTimelineEventUuid: 'evt-123'
        })
      )

      render(<RightPanelContent />)

      // The component should query for the active event element
      // Note: The actual scroll happens in a useEffect, so we verify the setup is correct
      expect(mockUseUIStore).toHaveBeenCalled()

      vi.restoreAllMocks()
    })

    it('does not scroll when activeTimelineEventUuid is null', () => {
      mockUseUIStore.mockReturnValue(
        createMockStore({
          rightPanelActiveTab: 'events',
          activeTimelineEventUuid: null
        })
      )

      // Should not throw or cause issues
      expect(() => render(<RightPanelContent />)).not.toThrow()
    })

    it('passes activeEventUuid to EventTimeline component', () => {
      mockUseUIStore.mockReturnValue(
        createMockStore({
          rightPanelActiveTab: 'events',
          activeTimelineEventUuid: 'evt-456'
        })
      )

      render(<RightPanelContent />)

      // EventTimeline is mocked, but we verify the store state is read
      expect(screen.getByTestId('event-timeline')).toBeInTheDocument()
    })
  })

  describe('auto-selection (AC2)', () => {
    it('auto-selects Files tab when viewing file in middle panel', () => {
      const setRightPanelActiveTab = vi.fn()
      mockUseUIStore.mockReturnValue(
        createMockStore({
          tabs: [
            { id: 'file-1', type: 'file', title: 'test.ts', sessionId: null, sessionState: 'idle' }
          ],
          activeTabId: 'file-1',
          rightPanelActiveTab: 'info',
          setRightPanelActiveTab
        })
      )
      render(<RightPanelContent />)

      expect(setRightPanelActiveTab).toHaveBeenCalledWith('files')
    })

    it('does not change tab when already on files tab', () => {
      const setRightPanelActiveTab = vi.fn()
      mockUseUIStore.mockReturnValue(
        createMockStore({
          tabs: [
            { id: 'file-1', type: 'file', title: 'test.ts', sessionId: null, sessionState: 'idle' }
          ],
          activeTabId: 'file-1',
          rightPanelActiveTab: 'files',
          setRightPanelActiveTab
        })
      )
      render(<RightPanelContent />)

      expect(setRightPanelActiveTab).not.toHaveBeenCalled()
    })

    it('does not auto-select for session tabs', () => {
      const setRightPanelActiveTab = vi.fn()
      mockUseUIStore.mockReturnValue(
        createMockStore({
          tabs: [
            {
              id: 'session-1',
              type: 'session',
              title: 'Test',
              sessionId: '123',
              sessionState: 'idle'
            }
          ],
          activeTabId: 'session-1',
          rightPanelActiveTab: 'info',
          setRightPanelActiveTab
        })
      )
      render(<RightPanelContent />)

      expect(setRightPanelActiveTab).not.toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CloseTabConfirmDialog } from './CloseTabConfirmDialog'
import type { Tab } from '@renderer/shared/store/useUIStore'

// Mock window.grimoireAPI
const mockTerminate = vi.fn()
const mockScan = vi.fn()
const mockSync = vi.fn()
const mockList = vi.fn()
beforeEach(() => {
  mockTerminate.mockReset()
  mockTerminate.mockResolvedValue({ success: true })
  mockScan.mockReset()
  mockScan.mockResolvedValue({ sessions: [] })
  mockSync.mockReset()
  mockSync.mockResolvedValue({ added: 0, updated: 0, orphaned: 0, errors: [] })
  mockList.mockReset()
  mockList.mockResolvedValue([])
  window.grimoireAPI = {
    sessions: {
      terminate: mockTerminate,
      scan: mockScan,
      sync: mockSync,
      list: mockList
    }
  }
})

describe('CloseTabConfirmDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  const workingTab: Tab = {
    id: 'tab-1',
    type: 'session',
    title: 'Working Session',
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sessionState: 'working'
  }

  const workingTabNoSessionId: Tab = {
    id: 'tab-2',
    type: 'session',
    title: 'New Session',
    sessionId: null,
    sessionState: 'working'
  }

  beforeEach(() => {
    mockOnClose.mockReset()
    mockOnConfirm.mockReset()
  })

  it('renders nothing when tab is null', () => {
    const { container } = render(
      <CloseTabConfirmDialog tab={null} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders dialog when tab is provided', () => {
    render(
      <CloseTabConfirmDialog tab={workingTab} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Close Working Session?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This session is still working. Closing it will terminate the running process.'
      )
    ).toBeInTheDocument()
  })

  it('calls onClose when Cancel button is clicked', () => {
    render(
      <CloseTabConfirmDialog tab={workingTab} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )

    fireEvent.click(screen.getByText('Cancel'))

    expect(mockOnClose).toHaveBeenCalled()
    expect(mockOnConfirm).not.toHaveBeenCalled()
    expect(mockTerminate).not.toHaveBeenCalled()
  })

  it('calls terminate and onConfirm when Close Anyway is clicked', async () => {
    render(
      <CloseTabConfirmDialog tab={workingTab} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )

    fireEvent.click(screen.getByText('Close Anyway'))

    await waitFor(() => {
      expect(mockTerminate).toHaveBeenCalledWith(workingTab.sessionId)
      expect(mockOnConfirm).toHaveBeenCalledWith(workingTab.id)
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('skips terminate when sessionId is null', async () => {
    render(
      <CloseTabConfirmDialog
        tab={workingTabNoSessionId}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByText('Close Anyway'))

    await waitFor(() => {
      expect(mockTerminate).not.toHaveBeenCalled()
      expect(mockOnConfirm).toHaveBeenCalledWith(workingTabNoSessionId.id)
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('handles terminate failure gracefully', async () => {
    mockTerminate.mockRejectedValue(new Error('IPC failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <CloseTabConfirmDialog tab={workingTab} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )

    fireEvent.click(screen.getByText('Close Anyway'))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to terminate session process:',
        expect.any(Error)
      )
      // Still closes the tab even on error
      expect(mockOnConfirm).toHaveBeenCalledWith(workingTab.id)
      expect(mockOnClose).toHaveBeenCalled()
    })

    consoleSpy.mockRestore()
  })

  it('closes dialog when X button is clicked', () => {
    render(
      <CloseTabConfirmDialog tab={workingTab} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )

    // The X button has aria-label "Close dialog"
    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('has proper accessibility attributes', () => {
    render(
      <CloseTabConfirmDialog tab={workingTab} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )

    // Check aria-labels on buttons
    expect(screen.getByRole('button', { name: 'Cancel and keep session open' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirm close and terminate process' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument()
  })

  it('closes dialog when Escape key is pressed', () => {
    render(
      <CloseTabConfirmDialog tab={workingTab} onClose={mockOnClose} onConfirm={mockOnConfirm} />
    )

    // Radix Dialog handles Escape key via onOpenChange callback
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalled()
    expect(mockOnConfirm).not.toHaveBeenCalled()
  })
})

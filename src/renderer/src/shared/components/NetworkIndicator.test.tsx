import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { NetworkIndicator } from './NetworkIndicator'

// Mock the hook
vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn()
}))

import { useNetworkStatus } from '../hooks/useNetworkStatus'

const mockUseNetworkStatus = vi.mocked(useNetworkStatus)

// Wrapper with Tooltip.Provider
function TestWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Tooltip.Provider>{children}</Tooltip.Provider>
}

describe('NetworkIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows green indicator when online', () => {
    mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    const indicator = screen.getByTestId('network-indicator')
    expect(indicator).toHaveClass('bg-[var(--success)]/50')
    expect(indicator).not.toHaveClass('animate-pulse')
  })

  it('shows red pulsing indicator when offline', () => {
    mockUseNetworkStatus.mockReturnValue({ online: false, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    const indicator = screen.getByTestId('network-indicator')
    expect(indicator).toHaveClass('bg-[var(--error)]')
    expect(indicator).toHaveClass('animate-pulse')
  })

  it('has correct aria-label when online', () => {
    mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    expect(screen.getByLabelText('Online')).toBeInTheDocument()
  })

  it('has correct aria-label when offline', () => {
    mockUseNetworkStatus.mockReturnValue({ online: false, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    expect(screen.getByLabelText('Offline')).toBeInTheDocument()
  })

  it('has status role for accessibility', () => {
    mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders with test id for easy selection', () => {
    mockUseNetworkStatus.mockReturnValue({ online: true, lastChecked: Date.now() })
    render(<NetworkIndicator />, { wrapper: TestWrapper })

    expect(screen.getByTestId('network-indicator')).toBeInTheDocument()
  })
})

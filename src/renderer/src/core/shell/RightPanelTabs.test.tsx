import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as Tabs from '@radix-ui/react-tabs'
import { RightPanelTabs } from './RightPanelTabs'

/**
 * Helper wrapper to provide Tabs.Root context required by RightPanelTabs.
 * RightPanelTabs contains Tabs.List which must be inside Tabs.Root.
 */
function TabsWrapper({
  value,
  onValueChange,
  children
}: {
  value: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}): React.ReactElement {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      {children}
    </Tabs.Root>
  )
}

describe('RightPanelTabs', () => {
  const defaultProps = {
    onCollapse: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders three tab triggers', () => {
    render(
      <TabsWrapper value="info">
        <RightPanelTabs {...defaultProps} />
      </TabsWrapper>
    )

    expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Events' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument()
  })

  it('shows active state for current tab (via Tabs.Root value)', () => {
    render(
      <TabsWrapper value="events">
        <RightPanelTabs {...defaultProps} />
      </TabsWrapper>
    )

    const eventsTab = screen.getByRole('tab', { name: 'Events' })
    expect(eventsTab).toHaveAttribute('data-state', 'active')

    const infoTab = screen.getByRole('tab', { name: 'Info' })
    expect(infoTab).toHaveAttribute('data-state', 'inactive')
  })

  it('triggers onValueChange on parent Tabs.Root when tab clicked', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <TabsWrapper value="info" onValueChange={onValueChange}>
        <RightPanelTabs {...defaultProps} />
      </TabsWrapper>
    )

    await user.click(screen.getByRole('tab', { name: 'Events' }))
    expect(onValueChange).toHaveBeenCalledWith('events')

    await user.click(screen.getByRole('tab', { name: 'Files' }))
    expect(onValueChange).toHaveBeenCalledWith('files')
  })

  it('renders collapse button', () => {
    render(
      <TabsWrapper value="info">
        <RightPanelTabs {...defaultProps} />
      </TabsWrapper>
    )

    expect(screen.getByRole('button', { name: 'Collapse right panel' })).toBeInTheDocument()
  })

  it('calls onCollapse when door button clicked', () => {
    const onCollapse = vi.fn()
    render(
      <TabsWrapper value="info">
        <RightPanelTabs {...defaultProps} onCollapse={onCollapse} />
      </TabsWrapper>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse right panel' }))
    expect(onCollapse).toHaveBeenCalled()
  })

  it('has accessible tab list', () => {
    render(
      <TabsWrapper value="info">
        <RightPanelTabs {...defaultProps} />
      </TabsWrapper>
    )

    expect(screen.getByRole('tablist', { name: 'Right panel views' })).toBeInTheDocument()
  })
})

import { Group, Panel, Separator, usePanelRef, useDefaultLayout } from 'react-resizable-panels'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { Ribbon } from './Ribbon'
import { TabBar } from './TabBar'
import { LeftPanelContent } from './LeftPanelContent'
import { MiddlePanelContent } from './MiddlePanelContent'
import { RightPanelContent } from './RightPanelContent'

// Panel IDs for layout persistence
const LEFT_PANEL_ID = 'left'
const MIDDLE_PANEL_ID = 'middle'
const RIGHT_PANEL_ID = 'right'
const GROUP_ID = 'grimoire-shell'

export function Shell(): ReactElement {
  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()
  const { leftPanelCollapsed, rightPanelCollapsed, setLeftPanelCollapsed, setRightPanelCollapsed } =
    useUIStore()

  // Use the hook for layout persistence
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: GROUP_ID,
    panelIds: [LEFT_PANEL_ID, MIDDLE_PANEL_ID, RIGHT_PANEL_ID],
    storage: localStorage
  })

  // Sync store state with panel - collapse/expand
  useEffect(() => {
    if (leftPanelCollapsed) {
      leftPanelRef.current?.collapse()
    } else {
      leftPanelRef.current?.expand()
    }
  }, [leftPanelCollapsed, leftPanelRef])

  useEffect(() => {
    if (rightPanelCollapsed) {
      rightPanelRef.current?.collapse()
    } else {
      rightPanelRef.current?.expand()
    }
  }, [rightPanelCollapsed, rightPanelRef])

  // Handle panel collapse events from the library (e.g., when resized to min)
  const handleLeftPanelResize = (): void => {
    const panel = leftPanelRef.current
    if (panel) {
      const isCollapsed = panel.isCollapsed()
      if (isCollapsed !== leftPanelCollapsed) {
        setLeftPanelCollapsed(isCollapsed)
      }
    }
  }

  const handleRightPanelResize = (): void => {
    const panel = rightPanelRef.current
    if (panel) {
      const isCollapsed = panel.isCollapsed()
      if (isCollapsed !== rightPanelCollapsed) {
        setRightPanelCollapsed(isCollapsed)
      }
    }
  }

  return (
    <div className="flex h-screen bg-[var(--bg-base)]">
      <Ribbon />
      <Group
        id={GROUP_ID}
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="flex-1"
      >
        <Panel
          panelRef={leftPanelRef}
          id={LEFT_PANEL_ID}
          defaultSize={20}
          minSize={17}
          maxSize={23}
          collapsible
          collapsedSize={0}
          onResize={handleLeftPanelResize}
        >
          <LeftPanelContent />
        </Panel>
        <Separator className="w-1 bg-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors data-[active]:bg-[var(--accent)]" />
        <Panel id={MIDDLE_PANEL_ID} minSize={30}>
          <div className="flex flex-col h-full">
            <TabBar />
            <MiddlePanelContent />
          </div>
        </Panel>
        <Separator className="w-1 bg-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors data-[active]:bg-[var(--accent)]" />
        <Panel
          panelRef={rightPanelRef}
          id={RIGHT_PANEL_ID}
          defaultSize={21}
          minSize={19}
          maxSize={24}
          collapsible
          collapsedSize={0}
          onResize={handleRightPanelResize}
        >
          <RightPanelContent />
        </Panel>
      </Group>
    </div>
  )
}

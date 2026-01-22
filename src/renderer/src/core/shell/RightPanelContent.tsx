import type { ReactElement } from 'react'
import { PanelTopbar } from './PanelTopbar'
import { useUIStore } from '@renderer/shared/store/useUIStore'

export function RightPanelContent(): ReactElement {
  const { setRightPanelCollapsed } = useUIStore()

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <PanelTopbar
        title="Info / Events"
        side="right"
        onCollapse={() => setRightPanelCollapsed(true)}
      />
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">Session info and events will appear here</p>
      </div>
    </div>
  )
}

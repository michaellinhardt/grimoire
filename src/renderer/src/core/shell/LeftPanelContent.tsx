import type { ReactElement } from 'react'
import { PanelTopbar } from './PanelTopbar'
import { useUIStore } from '@renderer/shared/store/useUIStore'

export function LeftPanelContent(): ReactElement {
  const { setLeftPanelCollapsed } = useUIStore()

  return (
    <div className="h-full flex flex-col bg-[var(--bg-base)]">
      <PanelTopbar title="Sessions" side="left" onCollapse={() => setLeftPanelCollapsed(true)} />
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">Sessions will appear here</p>
      </div>
    </div>
  )
}

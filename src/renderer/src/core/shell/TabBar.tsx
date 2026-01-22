import { useState } from 'react'
import { PanelLeft, PanelRight, Plus, X } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { useUIStore, Tab } from '@renderer/shared/store/useUIStore'
import { CloseTabConfirmDialog } from './CloseTabConfirmDialog'
import type { KeyboardEvent, ReactElement } from 'react'

export function TabBar(): ReactElement {
  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTabId,
    leftPanelCollapsed,
    rightPanelCollapsed,
    setLeftPanelCollapsed,
    setRightPanelCollapsed
  } = useUIStore()

  const [confirmCloseTab, setConfirmCloseTab] = useState<Tab | null>(null)

  const handleCloseTab = (tab: Tab): void => {
    if (tab.sessionState === 'working') {
      setConfirmCloseTab(tab) // Show dialog
    } else {
      closeTab(tab.id) // Close immediately
    }
  }

  // Handle keyboard navigation within tabs (Arrow Left/Right)
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const tabButtons = e.currentTarget.querySelectorAll('[data-tab-button]')
    const currentIndex = Array.from(tabButtons).findIndex((btn) => btn === document.activeElement)

    if (currentIndex === -1) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = currentIndex < tabButtons.length - 1 ? currentIndex + 1 : 0
      ;(tabButtons[nextIndex] as HTMLElement).focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabButtons.length - 1
      ;(tabButtons[prevIndex] as HTMLElement).focus()
    }
  }

  const handleAddTab = (): void => {
    addTab({
      id: crypto.randomUUID(),
      type: 'session',
      title: 'New Session',
      sessionId: null,
      sessionState: 'idle'
    })
  }

  return (
    <div
      className="h-10 flex items-center border-b border-[var(--border)] bg-[var(--bg-elevated)]"
      role="tablist"
      aria-label="Session tabs"
      onKeyDown={handleKeyDown}
    >
      {/* Left door button when panel collapsed */}
      {leftPanelCollapsed && (
        <button
          onClick={() => setLeftPanelCollapsed(false)}
          className={cn(
            'w-8 h-8 flex items-center justify-center',
            'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset'
          )}
          aria-label="Show left panel"
        >
          <PanelLeft size={16} />
        </button>
      )}

      {/* Tabs */}
      <div className="flex-1 flex items-center overflow-x-auto h-full">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-tab-button
            role="tab"
            aria-selected={tab.id === activeTabId}
            tabIndex={0}
            onClick={() => setActiveTabId(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                setActiveTabId(tab.id)
              }
            }}
            className={cn(
              'group h-full px-3 flex items-center gap-2 border-r border-[var(--border)] cursor-pointer',
              'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset',
              tab.id === activeTabId &&
                'text-[var(--text-primary)] border-b-2 border-b-[var(--accent)]',
              tab.sessionState === 'working' && 'tab--working',
              tab.sessionState === 'error' && 'tab--error'
            )}
          >
            <span className="text-sm truncate max-w-[120px]">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCloseTab(tab)
              }}
              tabIndex={-1}
              className={cn(
                'opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-[var(--radius-sm)]',
                'hover:bg-[var(--bg-hover)]',
                'focus-visible:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
              )}
              aria-label={`Close ${tab.title}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add tab button */}
      <button
        onClick={handleAddTab}
        className={cn(
          'w-8 h-8 flex items-center justify-center',
          'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset'
        )}
        aria-label="New tab"
      >
        <Plus size={16} />
      </button>

      {/* Right door button when panel collapsed */}
      {rightPanelCollapsed && (
        <button
          onClick={() => setRightPanelCollapsed(false)}
          className={cn(
            'w-8 h-8 flex items-center justify-center',
            'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset'
          )}
          aria-label="Show right panel"
        >
          <PanelRight size={16} />
        </button>
      )}

      {/* Close confirmation dialog for working sessions */}
      <CloseTabConfirmDialog
        tab={confirmCloseTab}
        onClose={() => setConfirmCloseTab(null)}
        onConfirm={(tabId) => closeTab(tabId)}
      />
    </div>
  )
}

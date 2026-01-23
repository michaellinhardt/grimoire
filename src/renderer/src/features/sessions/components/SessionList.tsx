import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '@renderer/shared/store/useUIStore'
import { SessionListItem } from './SessionListItem'
import { getSessionDisplayName } from '@renderer/shared/utils/getSessionDisplayName'
import type { SessionWithExists } from '../../../../../shared/types/ipc'

export function SessionList(): ReactElement {
  const { sessions, isLoading, loadSessions } = useSessionStore()
  const { focusOrOpenSession, tabs, activeTabId, showArchived } = useUIStore()
  const [activeProcesses, setActiveProcesses] = useState<string[]>([])
  const [sessionStates, setSessionStates] = useState<Map<string, 'idle' | 'working' | 'error'>>(
    new Map()
  )

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Poll for active processes (MVP approach)
  // Empty dependency array is intentional - poll setup runs once on mount
  // Polling handles dynamic state internally via setInterval
  useEffect(() => {
    // Immediate fetch on mount
    window.grimoireAPI.sessions.getActiveProcesses().then(setActiveProcesses).catch(console.error)

    // Poll every 2 seconds
    const poll = setInterval(async () => {
      try {
        const active = await window.grimoireAPI.sessions.getActiveProcesses()
        setActiveProcesses(active)
      } catch (error) {
        console.error('Failed to poll active processes:', error)
      }
    }, 2000)
    return () => clearInterval(poll)
  }, []) // Intentionally empty - see comment above

  // Subscribe to instance state changes to track error states
  useEffect(() => {
    const unsubscribe = window.grimoireAPI.sessions.onInstanceStateChanged((event) => {
      setSessionStates((prev) => {
        const updated = new Map(prev)
        updated.set(event.sessionId, event.state)
        return updated
      })
    })
    return unsubscribe
  }, [])

  // Filter sessions: show non-hidden, and include archived only if toggle is on
  const visibleSessions = sessions.filter((s) => !s.isHidden && (showArchived || !s.archived))

  // Sort: pinned first, then by lastAccessedAt descending
  const sortedSessions = [...visibleSessions].sort((a, b) => {
    // Pinned sessions always come first
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    // Then sort by lastAccessedAt (most recent first)
    return (b.lastAccessedAt || b.updatedAt) - (a.lastAccessedAt || a.updatedAt)
  })

  // Check if session is THE CURRENTLY ACTIVE TAB (not just open in any tab)
  const isSessionActive = (sessionId: string): boolean => {
    if (!activeTabId) return false
    const activeTab = tabs.find((t) => t.id === activeTabId)
    return activeTab?.sessionId === sessionId
  }

  const handleSessionClick = (session: SessionWithExists): void => {
    const displayName = getSessionDisplayName(session.folderPath)
    focusOrOpenSession(session.id, displayName)
    // Fire-and-forget update (don't await to keep UI responsive)
    window.grimoireAPI.sessions.updateLastAccessed(session.id).catch(console.error)
  }

  const handleArchive = async (sessionId: string): Promise<void> => {
    try {
      await window.grimoireAPI.sessions.archive(sessionId)
      loadSessions()
    } catch (error) {
      console.error('Failed to archive session:', error)
    }
  }

  const handleUnarchive = async (sessionId: string): Promise<void> => {
    try {
      await window.grimoireAPI.sessions.unarchive(sessionId)
      loadSessions()
    } catch (error) {
      console.error('Failed to unarchive session:', error)
    }
  }

  if (isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading sessions...</div>
  }

  if (sortedSessions.length === 0) {
    return <div className="p-4 text-[var(--text-muted)]">No sessions found</div>
  }

  return (
    <ScrollArea.Root className="h-full">
      <ScrollArea.Viewport className="h-full w-full p-2">
        <div className="space-y-1">
          {sortedSessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={isSessionActive(session.id)}
              isWorking={activeProcesses.includes(session.id)}
              isError={sessionStates.get(session.id) === 'error'}
              onClick={() => handleSessionClick(session)}
              onArchive={() => handleArchive(session.id)}
              onUnarchive={() => handleUnarchive(session.id)}
            />
          ))}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="flex w-2.5 touch-none select-none bg-transparent p-0.5"
      >
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--border)]" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}

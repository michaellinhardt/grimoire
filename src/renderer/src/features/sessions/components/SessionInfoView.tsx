import { type ReactElement, useState, useEffect, useCallback, useMemo } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronRight, Copy, FolderOpen, Check } from 'lucide-react'
import { cn } from '@renderer/shared/utils/cn'
import { formatRelativeTime } from '@renderer/shared/utils/formatRelativeTime'
import { formatTokenCount } from '@renderer/shared/utils/formatTokenCount'
import { formatCost } from '@renderer/shared/utils/formatCost'
import { formatDuration } from '@renderer/shared/utils/formatDuration'
import {
  useSessionMetadataStore,
  selectMetadataBySessionId
} from '../store/useSessionMetadataStore'
import { useSessionStore, selectSessionById } from '../store/useSessionStore'

export interface SessionInfoViewProps {
  /** The session ID to display info for. When null, shows empty state. */
  sessionId: string | null
}

/** Debounce delay for real-time metadata updates (ms) */
const UPDATE_DEBOUNCE_MS = 100

/**
 * Displays detailed session metadata including timestamps, token usage,
 * cost estimates, and raw metadata in collapsible sections.
 */
export function SessionInfoView({ sessionId }: SessionInfoViewProps): ReactElement {
  const { metadata, isLoading, loadMetadata, updateMetadata } = useSessionMetadataStore()
  const { sessions } = useSessionStore()

  // State for collapsible sections
  const [tokenBreakdownOpen, setTokenBreakdownOpen] = useState(false)
  const [rawMetadataOpen, setRawMetadataOpen] = useState(false)

  // State for copy-to-clipboard feedback
  const [copied, setCopied] = useState(false)

  // Get session and metadata data
  const session = sessionId ? selectSessionById(sessions, sessionId) : undefined
  const sessionMetadata = sessionId ? selectMetadataBySessionId(metadata, sessionId) : undefined

  // Load metadata when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadMetadata(sessionId)
    }
  }, [sessionId, loadMetadata])

  // Subscribe to real-time metadata updates
  useEffect(() => {
    if (!sessionId) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let cleanupFn: (() => void) | null = null
    let isUnmounted = false

    const handleMetadataUpdate = (data: { sessionId: string }): void => {
      // Don't update if component has unmounted or sessionId has changed
      if (isUnmounted || data.sessionId !== sessionId) return

      // Debounce updates
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!isUnmounted) {
          updateMetadata(sessionId, data)
        }
      }, UPDATE_DEBOUNCE_MS)
    }

    // Subscribe to metadata updates (must exist - required API)
    if (!window.grimoireAPI.sessions.onMetadataUpdated) {
      console.warn('Real-time metadata updates not available: onMetadataUpdated API missing')
      return () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        isUnmounted = true
      }
    }

    try {
      cleanupFn = window.grimoireAPI.sessions.onMetadataUpdated(handleMetadataUpdate)
      if (!cleanupFn || typeof cleanupFn !== 'function') {
        console.warn(
          'Real-time metadata updates subscription failed: cleanup function not returned'
        )
      }
    } catch (error) {
      console.error('Failed to subscribe to metadata updates:', error)
    }

    return () => {
      isUnmounted = true
      if (debounceTimer) clearTimeout(debounceTimer)
      if (cleanupFn && typeof cleanupFn === 'function') {
        try {
          cleanupFn()
        } catch (error) {
          console.error('Error cleaning up metadata update listener:', error)
        }
      }
    }
  }, [sessionId, updateMetadata])

  // Handle copy session ID to clipboard
  const handleCopySessionId = useCallback(async () => {
    if (!sessionId) return
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy session ID:', error)
      // Show error feedback to user
      alert('Failed to copy session ID. Please try again or copy manually from the field.')
    }
  }, [sessionId])

  // Clear copied state when sessionId changes to prevent UI artifacts
  useEffect(() => {
    return () => {
      setCopied(false)
    }
  }, [sessionId])

  // Handle reveal folder in Finder
  const handleRevealFolder = useCallback(async () => {
    if (!session) return
    const folderPath = session.folderPath
    if (!folderPath) return
    try {
      const result = await window.grimoireAPI.shell.showItemInFolder(folderPath)
      if (!result.success) {
        console.error('Failed to reveal folder:', result.error)
        // Show error feedback to user
        alert(
          `Failed to reveal folder: ${result.error || 'The folder may have been moved or deleted.'}`
        )
      }
    } catch (error) {
      console.error('Failed to reveal folder:', error)
      // Show error feedback to user
      alert('Failed to reveal folder. The folder may have been moved or deleted.')
    }
  }, [session])

  // Calculate session duration (timestamps are in milliseconds)
  const duration = useMemo(() => {
    if (!session) return null
    return session.updatedAt - session.createdAt
  }, [session])

  // Format absolute date for hover tooltip
  const formatAbsoluteDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Truncate session ID for display (first 8 + last 4 chars)
  const truncatedSessionId = useMemo(() => {
    if (!sessionId) return ''
    if (sessionId.length <= 16) return sessionId
    return `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`
  }, [sessionId])

  // Build raw metadata object for display
  const rawMetadataJson = useMemo(() => {
    if (!session || !sessionMetadata) return null
    return {
      session: {
        id: session.id,
        folderPath: session.folderPath,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastAccessedAt: session.lastAccessedAt,
        archived: session.archived,
        isPinned: session.isPinned,
        forkedFromSessionId: session.forkedFromSessionId,
        isHidden: session.isHidden
      },
      metadata: {
        totalInputTokens: sessionMetadata.totalInputTokens,
        totalOutputTokens: sessionMetadata.totalOutputTokens,
        totalCostUsd: sessionMetadata.totalCostUsd,
        model: sessionMetadata.model,
        updatedAt: sessionMetadata.updatedAt
      }
    }
  }, [session, sessionMetadata])

  // Empty state when no session selected
  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">Select a session to view info</p>
      </div>
    )
  }

  // Loading state
  if (isLoading && !sessionMetadata) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">Loading session info...</p>
      </div>
    )
  }

  // No session found state
  if (!session) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-[var(--text-muted)]">Session not found</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="session-info-view">
      <div className="p-4 space-y-6">
        {/* Basic Metadata Section */}
        <section className="space-y-4">
          {/* Session ID */}
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">Session ID</label>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-elevated)] px-2 py-1 rounded">
                {truncatedSessionId}
              </code>
              <button
                type="button"
                onClick={handleCopySessionId}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="Copy full session ID"
                aria-label="Copy session ID to clipboard"
                data-testid="copy-session-id-btn"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Folder Path */}
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">Folder</label>
            <button
              type="button"
              onClick={handleRevealFolder}
              className={cn(
                'text-sm text-[var(--text-primary)] text-left',
                'hover:text-[var(--accent)] transition-colors',
                'flex items-center gap-2 group'
              )}
              title="Reveal in Finder"
              aria-label="Reveal folder in Finder"
              data-testid="reveal-folder-btn"
            >
              <span className="truncate max-w-[200px]">{session.folderPath}</span>
              <FolderOpen
                className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Created Date */}
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">Created</label>
            <p
              className="text-sm text-[var(--text-primary)]"
              title={formatAbsoluteDate(session.createdAt)}
            >
              {formatRelativeTime(session.createdAt)}
              <span className="text-[var(--text-muted)] ml-1">
                ({formatAbsoluteDate(session.createdAt)})
              </span>
            </p>
          </div>

          {/* Last Updated Date */}
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">Last Updated</label>
            <p
              className="text-sm text-[var(--text-primary)]"
              title={formatAbsoluteDate(session.updatedAt)}
            >
              {formatRelativeTime(session.updatedAt)}
              <span className="text-[var(--text-muted)] ml-1">
                ({formatAbsoluteDate(session.updatedAt)})
              </span>
            </p>
          </div>

          {/* Duration */}
          {duration !== null && (
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Duration</label>
              <p className="text-sm text-[var(--text-primary)]">{formatDuration(duration)}</p>
            </div>
          )}
        </section>

        {/* Divider */}
        <hr className="border-[var(--border)]" />

        {/* Token Usage Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Token Usage</h3>

          {sessionMetadata ? (
            <>
              {/* Token Counts */}
              <div className="flex gap-4">
                <div className="flex-1 bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
                  <p className="text-lg font-medium text-[var(--text-primary)]">
                    {formatTokenCount(sessionMetadata.totalInputTokens)} in
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Input</p>
                </div>
                <div className="flex-1 bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
                  <p className="text-lg font-medium text-[var(--text-primary)]">
                    {formatTokenCount(sessionMetadata.totalOutputTokens)} out
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Output</p>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Model</label>
                <p className="text-sm text-[var(--text-primary)] font-mono">
                  {sessionMetadata.model ?? 'Unknown'}
                </p>
              </div>

              {/* Estimated Cost */}
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Est. Cost</label>
                <p className="text-sm text-[var(--text-primary)]">
                  {formatCost(sessionMetadata.totalCostUsd)}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)] italic">Metadata not available</p>
          )}
        </section>

        {/* Divider */}
        <hr className="border-[var(--border)]" />

        {/* Collapsible Sections */}
        <section className="space-y-2">
          {/* Token Breakdown (placeholder for future per-message data) */}
          <Collapsible.Root open={tokenBreakdownOpen} onOpenChange={setTokenBreakdownOpen}>
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 py-2',
                  'text-sm text-[var(--text-primary)]',
                  'hover:bg-[var(--bg-elevated)] rounded transition-colors'
                )}
                data-testid="token-breakdown-trigger"
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-[var(--text-muted)] transition-transform duration-200',
                    tokenBreakdownOpen && 'rotate-90'
                  )}
                  aria-hidden="true"
                />
                Token Breakdown
              </button>
            </Collapsible.Trigger>
            <Collapsible.Content className="overflow-hidden">
              <div className="pl-6 py-2 text-sm text-[var(--text-muted)]">
                <p className="italic">Per-message token data not yet available.</p>
                <p className="text-xs mt-1">
                  This will show token usage per message when streaming data is captured.
                </p>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          {/* Raw Metadata */}
          <Collapsible.Root open={rawMetadataOpen} onOpenChange={setRawMetadataOpen}>
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 py-2',
                  'text-sm text-[var(--text-primary)]',
                  'hover:bg-[var(--bg-elevated)] rounded transition-colors'
                )}
                data-testid="raw-metadata-trigger"
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-[var(--text-muted)] transition-transform duration-200',
                    rawMetadataOpen && 'rotate-90'
                  )}
                  aria-hidden="true"
                />
                Raw Metadata
              </button>
            </Collapsible.Trigger>
            <Collapsible.Content className="overflow-hidden">
              <div className="pl-6 py-2">
                {rawMetadataJson ? (
                  <pre className="text-xs font-mono bg-[var(--bg-elevated)] p-3 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                    {JSON.stringify(rawMetadataJson, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] italic">No metadata available</p>
                )}
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        </section>
      </div>
    </div>
  )
}

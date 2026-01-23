import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ScanResult,
  SyncResult,
  DiscoveredSession,
  SessionWithExists,
  SessionMetadata,
  SessionMetadataUpsert
} from '../shared/types/ipc'

export interface GrimoireAPI {
  sessions: {
    terminate: (sessionId: string) => Promise<{ success: boolean }>
    scan: () => Promise<ScanResult>
    sync: (sessions: DiscoveredSession[]) => Promise<SyncResult>
    list: (options?: { includeHidden?: boolean }) => Promise<SessionWithExists[]>
    updateLastAccessed: (sessionId: string) => Promise<{ success: boolean }>
    getActiveProcesses: () => Promise<string[]>
    // New methods (Story 2a.3)
    archive: (sessionId: string) => Promise<{ success: boolean }>
    unarchive: (sessionId: string) => Promise<{ success: boolean }>
    create: (folderPath: string) => Promise<{ sessionId: string }>
    // New methods (Story 2a.5)
    hide: (sessionId: string) => Promise<{ success: boolean }>
    unhide: (sessionId: string) => Promise<{ success: boolean }>
    fork: (
      parentSessionId: string,
      options?: { hideParent?: boolean }
    ) => Promise<{ sessionId: string }>
    getLineage: (sessionId: string) => Promise<string[]>
    // New methods (Story 2a.6)
    getMetadata: (sessionId: string) => Promise<SessionMetadata | null>
    upsertMetadata: (data: SessionMetadataUpsert) => Promise<{ success: boolean }>
    // New methods (Story 2b.5)
    rewind: (data: {
      sessionId: string
      checkpointUuid: string
      newMessage: string
    }) => Promise<{ sessionId: string }>
    // New methods (Story 3a.2)
    sendMessage: (data: {
      sessionId: string
      message: string
      folderPath: string
      isNewSession?: boolean
    }) => Promise<{ success: boolean; error?: string }>
    // Abort method (Story 3a-4)
    abort: (data: { sessionId: string }) => Promise<{ success: boolean; error?: string }>
    // New methods (Story 2c.2) - Real-time metadata update event listener
    onMetadataUpdated: (callback: (data: SessionMetadata) => void) => () => void
    // Streaming event listeners (Story 3a-3)
    onStreamChunk: (
      callback: (event: { sessionId: string; type: 'text'; content: string; uuid?: string }) => void
    ) => () => void
    onStreamTool: (
      callback: (event: {
        sessionId: string
        type: 'tool_use' | 'tool_result'
        toolUse?: unknown
        toolResult?: unknown
      }) => void
    ) => () => void
    onStreamEnd: (
      callback: (event: {
        sessionId: string
        success: boolean
        error?: string
        aborted?: boolean
      }) => void
    ) => () => void
    // Stream init event listener (Story 3b-1)
    onStreamInit: (
      callback: (event: { sessionId: string; tools?: unknown[] }) => void
    ) => () => void
    // Instance state methods (Story 3b-3)
    getInstanceState: (sessionId: string) => Promise<{ state: 'idle' | 'working' | 'error' }>
    acknowledgeError: (
      sessionId: string
    ) => Promise<{ success: boolean; newState: 'idle' | 'working' | 'error' }>
    onInstanceStateChanged: (
      callback: (event: {
        sessionId: string
        state: 'idle' | 'working' | 'error'
        previousState: 'idle' | 'working' | 'error'
      }) => void
    ) => () => void
    // Check if session has active process (Story 3b-4)
    hasActiveProcess: (sessionId: string) => Promise<{ active: boolean }>
  }
  dialog: {
    selectFolder: () => Promise<{ canceled: boolean; folderPath: string | null }>
  }
  // New namespace (Story 2c.2) - Shell operations
  shell: {
    showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>
  }
  // Startup verification (Story 4-1)
  startup: {
    verify: () => Promise<{ success: boolean; failedStep?: string; error?: string }>
    onStepComplete: (
      callback: (data: { step: string; success: boolean; error?: string }) => void
    ) => () => void
    onAllComplete: (callback: (data: { success: boolean }) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    grimoireAPI: GrimoireAPI
  }
}

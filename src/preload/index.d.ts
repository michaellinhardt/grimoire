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
    // New methods (Story 2c.2) - Real-time metadata update event listener
    onMetadataUpdated: (callback: (data: SessionMetadata) => void) => () => void
  }
  dialog: {
    selectFolder: () => Promise<{ canceled: boolean; folderPath: string | null }>
  }
  // New namespace (Story 2c.2) - Shell operations
  shell: {
    showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    grimoireAPI: GrimoireAPI
  }
}

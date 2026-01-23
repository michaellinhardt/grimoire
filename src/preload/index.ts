import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Type for discovered session (matches DiscoveredSession schema structure)
// Note: Full type validation happens at IPC boundary via Zod, keeping preload thin
interface DiscoveredSessionLike {
  id: string
  filePath: string
  folderPath: string
  createdAt: number
  updatedAt: number
}

// Type for session metadata (Story 2c.2 - real-time updates)
interface SessionMetadataLike {
  sessionId: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  model: string | null
  updatedAt: number | null
}

// Grimoire-specific APIs for renderer
const grimoireAPI = {
  sessions: {
    terminate: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:terminate', { sessionId }),
    scan: () => ipcRenderer.invoke('sessions:scan'),
    sync: (sessions: DiscoveredSessionLike[]) => ipcRenderer.invoke('sessions:sync', { sessions }),
    list: (options?: { includeHidden?: boolean }) => ipcRenderer.invoke('sessions:list', options),
    updateLastAccessed: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:updateLastAccessed', sessionId),
    getActiveProcesses: (): Promise<string[]> => ipcRenderer.invoke('sessions:getActiveProcesses'),
    // New methods (Story 2a.3)
    archive: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:archive', sessionId),
    unarchive: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:unarchive', sessionId),
    create: (folderPath: string): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke('sessions:create', { folderPath }),
    // New methods (Story 2a.5)
    hide: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:hide', sessionId),
    unhide: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('sessions:unhide', sessionId),
    fork: (
      parentSessionId: string,
      options?: { hideParent?: boolean }
    ): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke('sessions:fork', { parentSessionId, ...options }),
    getLineage: (sessionId: string): Promise<string[]> =>
      ipcRenderer.invoke('sessions:getLineage', sessionId),
    // New methods (Story 2a.6)
    getMetadata: (sessionId: string) => ipcRenderer.invoke('sessions:getMetadata', sessionId),
    upsertMetadata: (data: {
      sessionId: string
      inputTokens?: number
      outputTokens?: number
      costUsd?: number
      model?: string
    }) => ipcRenderer.invoke('sessions:upsertMetadata', data),
    // New methods (Story 2b.5)
    rewind: (data: {
      sessionId: string
      checkpointUuid: string
      newMessage: string
    }): Promise<{ sessionId: string }> => ipcRenderer.invoke('sessions:rewind', data),
    // New methods (Story 3a.2)
    sendMessage: (data: {
      sessionId: string
      message: string
      folderPath: string
      isNewSession?: boolean
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sessions:sendMessage', data),
    // Abort running process (Story 3a-4)
    abort: (data: { sessionId: string }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sessions:abort', data),
    // New methods (Story 2c.2) - Real-time metadata update event listener
    onMetadataUpdated: (callback: (data: SessionMetadataLike) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: SessionMetadataLike): void =>
        callback(data)
      ipcRenderer.on('sessions:metadataUpdated', handler)
      // Return cleanup function
      return () => ipcRenderer.removeListener('sessions:metadataUpdated', handler)
    },
    // Streaming event listeners (Story 3a-3)
    onStreamChunk: (
      callback: (event: { sessionId: string; type: 'text'; content: string; uuid?: string }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { sessionId: string; type: 'text'; content: string; uuid?: string }
      ): void => callback(data)
      ipcRenderer.on('stream:chunk', handler)
      return () => ipcRenderer.removeListener('stream:chunk', handler)
    },
    onStreamTool: (
      callback: (event: {
        sessionId: string
        type: 'tool_use' | 'tool_result'
        toolUse?: unknown
        toolResult?: unknown
      }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: {
          sessionId: string
          type: 'tool_use' | 'tool_result'
          toolUse?: unknown
          toolResult?: unknown
        }
      ): void => callback(data)
      ipcRenderer.on('stream:tool', handler)
      return () => ipcRenderer.removeListener('stream:tool', handler)
    },
    onStreamEnd: (
      callback: (event: {
        sessionId: string
        success: boolean
        error?: string
        aborted?: boolean
      }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { sessionId: string; success: boolean; error?: string; aborted?: boolean }
      ): void => callback(data)
      ipcRenderer.on('stream:end', handler)
      return () => ipcRenderer.removeListener('stream:end', handler)
    },
    // Stream init event listener (Story 3b-1)
    onStreamInit: (
      callback: (event: { sessionId: string; tools?: unknown[] }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { sessionId: string; tools?: unknown[] }
      ): void => callback(data)
      ipcRenderer.on('stream:init', handler)
      return () => ipcRenderer.removeListener('stream:init', handler)
    }
  },
  // New namespace (Story 2a.3)
  dialog: {
    selectFolder: (): Promise<{ canceled: boolean; folderPath: string | null }> =>
      ipcRenderer.invoke('dialog:selectFolder')
  },
  // New namespace (Story 2c.2) - Shell operations
  shell: {
    showItemInFolder: (filePath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('shell:showItemInFolder', filePath)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('grimoireAPI', grimoireAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.grimoireAPI = grimoireAPI
}

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
    }): Promise<{ sessionId: string }> => ipcRenderer.invoke('sessions:rewind', data)
  },
  // New namespace (Story 2a.3)
  dialog: {
    selectFolder: (): Promise<{ canceled: boolean; folderPath: string | null }> =>
      ipcRenderer.invoke('dialog:selectFolder')
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

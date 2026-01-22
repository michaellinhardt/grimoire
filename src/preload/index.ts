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
    list: () => ipcRenderer.invoke('sessions:list')
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

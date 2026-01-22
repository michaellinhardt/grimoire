import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ScanResult,
  SyncResult,
  DiscoveredSession,
  SessionWithExists
} from '../shared/types/ipc'

interface GrimoireAPI {
  sessions: {
    terminate: (sessionId: string) => Promise<{ success: boolean }>
    scan: () => Promise<ScanResult>
    sync: (sessions: DiscoveredSession[]) => Promise<SyncResult>
    list: () => Promise<SessionWithExists[]>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    grimoireAPI: GrimoireAPI
  }
}

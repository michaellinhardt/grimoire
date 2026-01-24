import { ipcMain } from 'electron'
import { isOnline } from '../network-monitor'

/**
 * Registers IPC handlers for network status.
 * Channel: network:getStatus - Returns current online/offline status
 */
export function registerNetworkIPC(): void {
  ipcMain.handle('network:getStatus', () => {
    return { online: isOnline() }
  })
}

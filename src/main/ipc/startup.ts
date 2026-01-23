import { ipcMain, BrowserWindow } from 'electron'
import { runStartupVerification, type VerificationResult } from '../startup-verifier'

/**
 * Emits an event to all renderer windows.
 */
function emitToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(channel, data)
  }
}

/**
 * Registers IPC handlers for the startup namespace.
 * Follows the namespace:action pattern per architecture doc.
 */
export function registerStartupIPC(): void {
  ipcMain.handle('startup:verify', async (): Promise<VerificationResult> => {
    const result = await runStartupVerification((step, success, error) => {
      emitToRenderer('startup:stepComplete', { step, success, error })
    })

    emitToRenderer('startup:allComplete', { success: result.success })
    return result
  })
}

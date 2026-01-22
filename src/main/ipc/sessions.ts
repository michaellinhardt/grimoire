import { ipcMain } from 'electron'
import {
  TerminateRequestSchema,
  ScanResultSchema,
  SyncRequestSchema,
  SessionListSchema
} from '../../shared/types/ipc'
import { processRegistry } from '../process-registry'
import { scanClaudeConfigDir, syncSessionsToDatabase, listSessions } from '../sessions'

export function registerSessionsIPC(): void {
  ipcMain.handle('sessions:terminate', async (_, data: unknown) => {
    // Validate at IPC boundary (AR10)
    const { sessionId } = TerminateRequestSchema.parse(data)

    const child = processRegistry.get(sessionId)
    if (!child) return { success: true }

    child.kill('SIGTERM')

    // Wait up to 5s for graceful exit
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 5000))
    ])

    if (!child.killed) {
      child.kill('SIGKILL')
    }

    processRegistry.delete(sessionId)
    return { success: true }
  })

  // Session scanning handlers (Story 2a.1)
  ipcMain.handle('sessions:scan', async () => {
    const discovered = await scanClaudeConfigDir()
    return ScanResultSchema.parse({ sessions: discovered })
  })

  ipcMain.handle('sessions:sync', async (_, data: unknown) => {
    const { sessions } = SyncRequestSchema.parse(data)
    const result = await syncSessionsToDatabase(sessions)
    return result
  })

  ipcMain.handle('sessions:list', async () => {
    const sessions = await listSessions()
    return SessionListSchema.parse(sessions)
  })
}

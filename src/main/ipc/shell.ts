import { ipcMain, shell } from 'electron'
import { z } from 'zod'

const ShowItemInFolderSchema = z.string().min(1)

export function registerShellIPC(): void {
  ipcMain.handle('shell:showItemInFolder', (_event, filePath: unknown) => {
    try {
      const validated = ShowItemInFolderSchema.parse(filePath)
      shell.showItemInFolder(validated)
      return { success: true }
    } catch (error) {
      // Extract meaningful error message for Zod validation or other errors
      let errorMessage = 'Failed to reveal folder'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'errors' in error) {
        // Zod validation error - extract first error message
        const validationError = (error as { errors?: Array<{ message: string }> }).errors?.[0]
          ?.message
        if (validationError) {
          errorMessage = `Invalid file path: ${validationError}`
        }
      }
      console.error('Failed to reveal folder:', error)
      return { success: false, error: errorMessage }
    }
  })
}

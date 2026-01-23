import { ipcMain, dialog } from 'electron'

export function registerDialogIPC(): void {
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Folder'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, folderPath: null }
    }

    return { canceled: false, folderPath: result.filePaths[0] }
  })
}

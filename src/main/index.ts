import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase, closeDatabase } from './db'
import { registerSessionsIPC, registerDialogIPC, registerShellIPC } from './ipc'
import { processRegistry } from './process-registry'

// Flag to prevent infinite loop when app.quit() triggers before-quit again
let isQuitting = false

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerSessionsIPC()
  registerDialogIPC()
  registerShellIPC()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.grimoire')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Debug flag for process lifecycle logging (Story 3b-4)
const DEBUG_LIFECYCLE = process.env.DEBUG_PROCESS_LIFECYCLE === '1'

// Graceful shutdown: terminate all child processes before quitting (Story 3b-4 AC#5)
app.on('before-quit', async (event) => {
  if (isQuitting) return
  if (processRegistry.size === 0) return

  event.preventDefault()
  isQuitting = true

  if (DEBUG_LIFECYCLE) {
    console.log(
      `[process-lifecycle] SHUTDOWN Starting graceful shutdown for ${processRegistry.size} process(es)`
    )
  }

  // Terminate all processes in parallel with SIGTERM -> wait 3s -> SIGKILL pattern
  const terminations = Array.from(processRegistry.entries()).map(async ([id, child]) => {
    if (DEBUG_LIFECYCLE) {
      console.log(`[process-lifecycle] SHUTDOWN SIGTERM sent to ${id} (pid: ${child.pid})`)
    }
    child.kill('SIGTERM')

    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)) // 3s timeout per story spec
    ])

    if (!child.killed) {
      if (DEBUG_LIFECYCLE) {
        console.log(`[process-lifecycle] SHUTDOWN SIGKILL sent to ${id} (pid: ${child.pid})`)
      }
      child.kill('SIGKILL')
    }
  })

  await Promise.all(terminations)
  processRegistry.clear()

  if (DEBUG_LIFECYCLE) {
    console.log('[process-lifecycle] SHUTDOWN Complete, all processes terminated')
  }

  app.quit() // Re-trigger quit after processes terminated
})

app.on('will-quit', () => {
  closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

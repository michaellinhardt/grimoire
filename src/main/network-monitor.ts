import { net, BrowserWindow } from 'electron'

/**
 * Cached network status - defaults to true (assume online until proven otherwise)
 */
let _isOnline = true

/**
 * Polling interval handle for cleanup
 */
let pollInterval: NodeJS.Timeout | null = null

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
 * Returns the cached network status.
 * Safe to call synchronously from anywhere in the main process.
 */
export function isOnline(): boolean {
  return _isOnline
}

/**
 * Starts network status monitoring.
 * Polls every 5 seconds and emits 'network:statusChanged' on transitions.
 * Should be called once during app initialization.
 */
export function startNetworkMonitoring(): void {
  // Initialize with current status
  _isOnline = net.isOnline()

  // Clear any existing interval (safety for dev hot-reload)
  if (pollInterval) {
    clearInterval(pollInterval)
  }

  // Poll every 5 seconds
  pollInterval = setInterval(() => {
    const newStatus = net.isOnline()
    if (newStatus !== _isOnline) {
      _isOnline = newStatus
      emitToRenderer('network:statusChanged', { online: newStatus })
      console.log(`[network-monitor] Status changed: ${newStatus ? 'online' : 'offline'}`)
    }
  }, 5000)
}

/**
 * Stops network monitoring (for testing/cleanup).
 */
export function stopNetworkMonitoring(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

/**
 * Resets internal state for testing.
 * @internal
 */
export function _resetForTesting(): void {
  _isOnline = true
  stopNetworkMonitoring()
}

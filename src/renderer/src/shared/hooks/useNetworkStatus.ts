import { useState, useEffect } from 'react'

interface NetworkStatus {
  online: boolean
  lastChecked: number
}

/**
 * Hook that provides current network connectivity status.
 * Queries initial status from main process and subscribes to changes.
 */
export function useNetworkStatus(): NetworkStatus {
  // Use lazy initialization to avoid impure function call during render
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    online: true, // Optimistic default
    lastChecked: Date.now()
  }))

  useEffect(() => {
    // Query initial status
    window.grimoireAPI.network
      .getStatus()
      .then((result) => {
        setStatus({
          online: result.online,
          lastChecked: Date.now()
        })
      })
      .catch((err) => {
        console.error('[useNetworkStatus] Failed to get initial network status:', err)
        // Keep optimistic default (online: true) on error
      })

    // Subscribe to changes
    const unsubscribe = window.grimoireAPI.network.onStatusChanged((data) => {
      setStatus({
        online: data.online,
        lastChecked: Date.now()
      })
    })

    return unsubscribe
  }, [])

  return status
}

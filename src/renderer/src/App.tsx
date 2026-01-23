import { useState, useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Shell } from './core/shell'
import { LoadingScreen, useAppInit } from './core/loading'

function App(): ReactElement {
  const { status, currentStep, errorMessage, errorType, retry } = useAppInit()
  const [showLoading, setShowLoading] = useState(true)
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derive fadeOut from status - when ready, we start fade-out
  const fadeOut = status === 'ready'

  useEffect(() => {
    // When status becomes ready, schedule hiding the loading screen after animation
    if (status === 'ready') {
      fadeOutTimerRef.current = setTimeout(() => {
        setShowLoading(false)
      }, 200)
    }

    return () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current)
      }
    }
  }, [status])

  const handleQuit = (): void => {
    window.close()
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      {showLoading && (
        <LoadingScreen
          status={status}
          currentStep={currentStep}
          errorMessage={errorMessage}
          errorType={errorType}
          onRetry={retry}
          onQuit={handleQuit}
          fadeOut={fadeOut}
        />
      )}
      {!showLoading && <Shell />}
    </Tooltip.Provider>
  )
}

export default App

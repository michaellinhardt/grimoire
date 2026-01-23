import { useState, useEffect, useCallback, useRef } from 'react'

interface StartupState {
  status: 'loading' | 'error' | 'ready'
  currentStep: string
  errorMessage: string | null
  errorType: 'claude' | 'config' | 'auth' | null
}

const STEP_DISPLAY_TEXT: Record<string, string> = {
  claude: 'Checking Claude Code...',
  config: 'Verifying configuration...',
  auth: 'Checking authentication...',
  complete: 'Ready'
}

export function useAppInit(): StartupState & { retry: () => void } {
  const [state, setState] = useState<StartupState>({
    status: 'loading',
    currentStep: 'Initializing...',
    errorMessage: null,
    errorType: null
  })

  const startTimeRef = useRef<number>(Date.now())
  const hasStartedRef = useRef(false)
  const isMountedRef = useRef(true)

  const runVerification = useCallback(async () => {
    if (!isMountedRef.current) return

    setState({
      status: 'loading',
      currentStep: 'Initializing...',
      errorMessage: null,
      errorType: null
    })
    startTimeRef.current = Date.now()

    try {
      const result = await window.grimoireAPI.startup.verify()

      if (!isMountedRef.current) return

      if (result.success) {
        const elapsed = Date.now() - startTimeRef.current
        console.log(`[useAppInit] Startup completed in ${elapsed}ms`)
        setState((prev) => ({
          ...prev,
          status: 'ready',
          currentStep: 'Ready'
        }))
      } else {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: result.error || 'Startup verification failed',
          errorType: result.failedStep as 'claude' | 'config' | 'auth' | null
        }))
      }
    } catch (error) {
      if (!isMountedRef.current) return
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: null
      }))
    }
  }, [])

  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    // Subscribe to step completion events
    const unsubscribeStep = window.grimoireAPI.startup.onStepComplete((data) => {
      if (!isMountedRef.current) return
      if (data.success) {
        setState((prev) => ({
          ...prev,
          currentStep: STEP_DISPLAY_TEXT[data.step] || data.step
        }))
      }
    })

    // Run verification
    runVerification()

    return () => {
      if (typeof unsubscribeStep === 'function') {
        unsubscribeStep()
      }
    }
  }, [runVerification])

  const retry = useCallback(() => {
    // Reset startup state before retrying
    setState({
      status: 'loading',
      currentStep: 'Initializing...',
      errorMessage: null,
      errorType: null
    })
    // Reset the start flag and run verification again
    hasStartedRef.current = false
    runVerification()
  }, [runVerification])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return { ...state, retry }
}

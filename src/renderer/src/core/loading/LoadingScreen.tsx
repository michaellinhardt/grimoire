import type { ReactElement } from 'react'
import { ErrorModal } from './ErrorModal'

interface LoadingScreenProps {
  status: 'loading' | 'error' | 'ready'
  currentStep: string
  errorMessage: string | null
  errorType: 'claude' | 'config' | 'auth' | null
  onRetry: () => void
  onQuit: () => void
  fadeOut?: boolean
}

export function LoadingScreen({
  status,
  currentStep,
  errorMessage,
  errorType,
  onRetry,
  onQuit,
  fadeOut = false
}: LoadingScreenProps): ReactElement {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-base)] ${
        fadeOut ? 'loading-screen-fade-out' : ''
      }`}
      data-testid="loading-screen"
    >
      {/* Logo */}
      <h1
        className="text-4xl font-bold text-[var(--accent)] loading-logo-pulse mb-4"
        data-testid="loading-logo"
      >
        Grimoire
      </h1>

      {/* Current step text */}
      <p className="text-sm text-[var(--text-muted)]" data-testid="loading-step">
        {currentStep}
      </p>

      {/* Error Modal */}
      {status === 'error' && errorMessage && errorType && (
        <ErrorModal
          errorType={errorType}
          errorMessage={errorMessage}
          onRetry={onRetry}
          onQuit={onQuit}
        />
      )}
    </div>
  )
}

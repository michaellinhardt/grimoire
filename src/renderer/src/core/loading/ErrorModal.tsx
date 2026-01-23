import type { ReactElement } from 'react'

interface ErrorModalProps {
  errorType: 'claude' | 'config' | 'auth'
  errorMessage: string
  onRetry: () => void
  onQuit: () => void
}

const ERROR_INSTRUCTIONS: Record<'claude' | 'config' | 'auth', string> = {
  claude:
    'Claude Code is not installed or not in PATH. Please install from https://claude.ai/download',
  config: 'Failed to initialize configuration directory. Please check permissions.',
  auth: "Authentication required. Please run 'claude' in terminal to authenticate."
}

export function ErrorModal({
  errorType,
  errorMessage,
  onRetry,
  onQuit
}: ErrorModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="error-modal"
    >
      <div className="bg-[var(--bg-elevated)] rounded-lg p-6 max-w-md mx-4 shadow-xl border border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--error)] mb-2">Startup Error</h2>

        <p className="text-[var(--text-primary)] mb-4" data-testid="error-message">
          {errorMessage}
        </p>

        <p className="text-sm text-[var(--text-muted)] mb-6" data-testid="error-instructions">
          {ERROR_INSTRUCTIONS[errorType]}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onQuit}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            data-testid="quit-button"
          >
            Quit
          </button>
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors"
            data-testid="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}

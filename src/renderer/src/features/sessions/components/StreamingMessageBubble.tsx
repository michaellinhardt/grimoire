import { type ReactElement } from 'react'
import { cn } from '@renderer/shared/utils/cn'

export interface StreamingMessageBubbleProps {
  /** Current streamed content */
  content: string
  /** Whether streaming is active */
  isStreaming: boolean
}

/**
 * Message bubble for displaying streaming assistant responses.
 * Shows blinking cursor while streaming is active.
 */
export function StreamingMessageBubble({
  content,
  isStreaming
}: StreamingMessageBubbleProps): ReactElement {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[80%] rounded-[var(--radius-sm)] px-3 py-2',
          'bg-[var(--bg-hover)] text-[var(--text-primary)]',
          'text-sm whitespace-pre-wrap break-words',
          'min-h-[40px]'
        )}
      >
        <span>{content}</span>
        {isStreaming && (
          <span
            className="inline-block w-[2px] h-[1em] bg-[var(--text-primary)] ml-[1px] align-middle animate-cursor-blink"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

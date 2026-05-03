import { useCallback, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

type CopyButtonProps = {
  /** The text that will be written to the clipboard */
  text: string
  /** Visual variant — 'icon' shows only icon, 'badge' shows icon + label */
  variant?: 'icon' | 'badge'
  /** Optional class name for the root button */
  className?: string
  /** Feedback duration in ms (default: 1800) */
  feedbackMs?: number
  /** Accessible label for screen-readers */
  label?: string
}

type CopyState = 'idle' | 'copied' | 'error'

/**
 * A self-contained, reusable Copy-to-clipboard button.
 *
 * Features:
 * - Uses the modern navigator.clipboard.writeText() API
 * - Falls back to a visible error state if clipboard is unavailable
 * - Shows a "Copied!" confirmation for 1.8 s then reverts to "Copy"
 * - Zero prop-drilling required; receives only the text to copy
 * - Uses useRef for the reset timer so it never causes stale-closure bugs
 *   and never triggers unnecessary parent re-renders
 */
export default function CopyButton({
  text,
  variant = 'badge',
  className = '',
  feedbackMs = 1800,
  label = 'Copy JSON'
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(async () => {
    // Clear any previous reset timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      // Clipboard API unavailable (e.g. non-secure context)
      setState('error')
    }

    timerRef.current = setTimeout(() => {
      setState('idle')
      timerRef.current = null
    }, feedbackMs)
  }, [text, feedbackMs])

  const isCopied = state === 'copied'
  const isError  = state === 'error'

  const baseClass = `copy-btn copy-btn--${variant} ${isCopied ? 'copy-btn--copied' : ''} ${isError ? 'copy-btn--error' : ''} ${className}`.trim()

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={baseClass}
        onClick={handleCopy}
        title={isCopied ? 'Copied!' : isError ? 'Copy failed' : label}
        aria-label={label}
      >
        {isCopied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={baseClass}
      onClick={handleCopy}
      title={isError ? 'Clipboard unavailable' : label}
      aria-label={label}
    >
      {isCopied ? (
        <>
          <Check size={13} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy size={13} />
          <span>{isError ? 'Failed' : 'Copy'}</span>
        </>
      )}
    </button>
  )
}

import { useCallback, useRef, useState } from 'react'
import { Check, Copy, AlertCircle } from 'lucide-react'
import Button from './Button'

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
      setState('error')
    }

    timerRef.current = setTimeout(() => {
      setState('idle')
      timerRef.current = null
    }, feedbackMs)
  }, [text, feedbackMs])

  const isCopied = state === 'copied'
  const isError  = state === 'error'

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isIconOnly
        className={className}
        onClick={handleCopy}
        title={isCopied ? 'Copied!' : isError ? 'Copy failed' : label}
        aria-label={label}
        icon={isCopied ? <Check size={14} className="success" /> : isError ? <AlertCircle size={14} className="error" /> : <Copy size={14} />}
      />
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`${isCopied ? 'btn-copied' : ''} ${className}`}
      onClick={handleCopy}
      title={isError ? 'Clipboard unavailable' : label}
      aria-label={label}
      icon={isCopied ? <Check size={13} /> : isError ? <AlertCircle size={13} /> : <Copy size={13} />}
    >
      {isCopied ? 'Copied!' : isError ? 'Failed' : 'Copy'}
    </Button>
  )
}

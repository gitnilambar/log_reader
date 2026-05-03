import { Loader2 } from 'lucide-react'
import type { LogProgressPayload } from '../types'
import Button from './Button'

type ProgressCardProps = {
  progress: LogProgressPayload
  onCancel: () => void
}

export default function ProgressCard({ progress, onCancel }: ProgressCardProps) {
  const percent = progress.totalBytes ? Math.min(100, (progress.processedBytes / progress.totalBytes) * 100) : 0

  return (
    <div className="progress-card">
      <div className="progress-card__header">
        <div className="progress-card__title">
          <Loader2 size={16} className="spin" />
          Processing files
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="progress-card__meta">
        <div>
          {progress.fileIndex} / {progress.fileCount}
        </div>
        <span className="muted">{progress.currentFile}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

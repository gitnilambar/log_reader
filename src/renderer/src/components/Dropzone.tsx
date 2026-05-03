import { UploadCloud } from 'lucide-react'
import { useState } from 'react'
import type { DragEvent } from 'react'

type DropzoneProps = {
  onFiles: (files: string[]) => void
}

const SUPPORTED_EXTENSIONS = ['.log', '.txt', '.json', '.zip', '.rar']

export default function Dropzone({ onFiles }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const files = Array.from(event.dataTransfer.files)
      .map((file) => file.path)
      .filter((filePath) => {
        const lower = filePath.toLowerCase()
        return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
      })

    if (files.length) {
      onFiles(files)
    }
  }

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <UploadCloud size={28} />
      <div>
        <strong>Drag & drop</strong> log files or archives here
      </div>
      <span>Supports .log, .txt, .json, .zip, and optional .rar</span>
    </div>
  )
}

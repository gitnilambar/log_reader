export type LogRow = {
  id: string
  source: string
  lineNumber: number
  data: Record<string, unknown>
  raw?: string
  valid: boolean
}

export type LogStats = {
  totalLines: number
  invalidLines: number
}

export type LogChunkPayload = {
  processId: string
  rows: LogRow[]
  columns: string[]
  stats: LogStats
}

export type LogProgressPayload = {
  processId: string
  processedBytes: number
  totalBytes: number
  currentFile: string
  fileIndex: number
  fileCount: number
}

export type LogDonePayload = {
  processId: string
  stats: LogStats
  cancelled: boolean
}

export type LogErrorPayload = {
  processId: string
  message: string
}

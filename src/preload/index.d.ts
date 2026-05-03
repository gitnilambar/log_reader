import type { LogChunkPayload, LogDonePayload, LogErrorPayload, LogProgressPayload } from '../main/logProcessor'

type ExportPayload = {
  format: 'json' | 'csv'
  content: string
}

declare global {
  interface Window {
    api: {
      openLogDialog: () => Promise<string[]>
      startProcessing: (filePaths: string[]) => Promise<{ processId: string | null }>
      cancelProcessing: (processId: string) => Promise<{ cancelled: boolean }>
      exportLogs: (payload: ExportPayload) => Promise<{ canceled: boolean; filePath?: string }>
      onChunk: (callback: (payload: LogChunkPayload) => void) => () => void
      onProgress: (callback: (payload: LogProgressPayload) => void) => () => void
      onDone: (callback: (payload: LogDonePayload) => void) => () => void
      onError: (callback: (payload: LogErrorPayload) => void) => () => void
    }
  }
}

export {}

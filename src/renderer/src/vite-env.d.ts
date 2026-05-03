/// <reference types="vite/client" />

interface Window {
  api: {
    openLogDialog: () => Promise<string[]>
    startProcessing: (filePaths: string[]) => Promise<{ processId: string | null }>
    cancelProcessing: (processId: string) => Promise<{ cancelled: boolean }>
    exportLogs: (payload: { format: 'json' | 'csv'; content: string }) => Promise<{ canceled: boolean; filePath?: string }>
    onChunk: (callback: (payload: any) => void) => () => void
    onProgress: (callback: (payload: any) => void) => () => void
    onDone: (callback: (payload: any) => void) => () => void
    onError: (callback: (payload: any) => void) => () => void
  }
}

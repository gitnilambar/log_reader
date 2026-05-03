import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { LogChunkPayload, LogDonePayload, LogErrorPayload, LogProgressPayload } from '../main/logProcessor'

type Unsubscribe = () => void

type ExportPayload = {
  format: 'json' | 'csv'
  content: string
}

const api = {
  openLogDialog: () => ipcRenderer.invoke('logs:open-dialog') as Promise<string[]>,
  startProcessing: (filePaths: string[]) =>
    ipcRenderer.invoke('logs:process', { filePaths }) as Promise<{ processId: string | null }>,
  cancelProcessing: (processId: string) => ipcRenderer.invoke('logs:cancel', processId),
  exportLogs: (payload: ExportPayload) => ipcRenderer.invoke('logs:export', payload),
  onChunk: (callback: (payload: LogChunkPayload) => void): Unsubscribe => {
    const handler = (_event: IpcRendererEvent, payload: LogChunkPayload) => callback(payload)
    ipcRenderer.on('logs:chunk', handler)
    return () => ipcRenderer.removeListener('logs:chunk', handler)
  },
  onProgress: (callback: (payload: LogProgressPayload) => void): Unsubscribe => {
    const handler = (_event: IpcRendererEvent, payload: LogProgressPayload) => callback(payload)
    ipcRenderer.on('logs:progress', handler)
    return () => ipcRenderer.removeListener('logs:progress', handler)
  },
  onDone: (callback: (payload: LogDonePayload) => void): Unsubscribe => {
    const handler = (_event: IpcRendererEvent, payload: LogDonePayload) => callback(payload)
    ipcRenderer.on('logs:done', handler)
    return () => ipcRenderer.removeListener('logs:done', handler)
  },
  onError: (callback: (payload: LogErrorPayload) => void): Unsubscribe => {
    const handler = (_event: IpcRendererEvent, payload: LogErrorPayload) => callback(payload)
    ipcRenderer.on('logs:error', handler)
    return () => ipcRenderer.removeListener('logs:error', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createLogProcessor, type LogChunkPayload, type LogDonePayload, type LogErrorPayload, type LogProgressPayload } from './logProcessor'
import { writeFile } from 'fs/promises'

const activeProcessors = new Map<string, ReturnType<typeof createLogProcessor>>()

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createProcessId() {
  return `proc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.logreder')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('logs:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Log Files', extensions: ['log', 'txt', 'json', 'zip', 'rar'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('logs:process', async (event, payload: { filePaths: string[] }) => {
    if (!payload?.filePaths?.length) {
      return { processId: null }
    }

    const processId = createProcessId()
    const sender = event.sender
    
    const processor = createLogProcessor({
      filePaths: payload.filePaths,
      batchSize: 400,
      processId,
      onChunk: (data: LogChunkPayload) => sender.send('logs:chunk', data),
      onProgress: (data: LogProgressPayload) => sender.send('logs:progress', data),
      onDone: (data: LogDonePayload) => {
        activeProcessors.delete(processId)
        sender.send('logs:done', data)
      },
      onError: (data: LogErrorPayload) => {
        activeProcessors.delete(processId)
        sender.send('logs:error', data)
      }
    })

    activeProcessors.set(processId, processor)
    processor.start().catch((error) => {
      activeProcessors.delete(processId)
      sender.send('logs:error', {
        processId,
        message: error instanceof Error ? error.message : 'Unknown processing error'
      } satisfies LogErrorPayload)
    })

    return { processId }
  })

  ipcMain.handle('logs:cancel', async (_event, processId: string) => {
    const processor = activeProcessors.get(processId)
    if (processor) {
      processor.cancel()
      activeProcessors.delete(processId)
    }
    return { cancelled: true }
  })

  ipcMain.handle('logs:export', async (_event, payload: { format: 'json' | 'csv'; content: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: `log-export.${payload.format}`,
      filters: [
        { name: payload.format.toUpperCase(), extensions: [payload.format] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await writeFile(result.filePath, payload.content, 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

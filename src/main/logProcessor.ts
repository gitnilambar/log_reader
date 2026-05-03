import fs from 'fs'
import path from 'path'
import os from 'os'
import { createInterface } from 'readline'
import * as yauzl from 'yauzl'
import { createExtractorFromFile } from 'node-unrar-js'

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

type ProcessorOptions = {
  filePaths: string[]
  batchSize: number
  processId: string
  onChunk: (payload: LogChunkPayload) => void
  onProgress: (payload: LogProgressPayload) => void
  onDone: (payload: LogDonePayload) => void
  onError: (payload: LogErrorPayload) => void
}

type ProgressContext = {
  totalBytes: number
  processedBytes: number
  currentFile: string
  fileIndex: number
  fileCount: number
  report: () => void
}

const TEXT_EXTENSIONS = new Set(['.log', '.txt', '.json'])

export function createLogProcessor(options: ProcessorOptions) {
  let cancelled = false
  const columns = new Set<string>()
  const stats: LogStats = { totalLines: 0, invalidLines: 0 }

  const cancel = () => {
    cancelled = true
  }

  const start = async () => {
    try {
      const totalBytes = await estimateTotalBytes(options.filePaths)
      let processedBytes = 0
      const fileCount = options.filePaths.length

      for (let index = 0; index < options.filePaths.length; index += 1) {
        if (cancelled) break
        const filePath = options.filePaths[index]
        const ext = path.extname(filePath).toLowerCase()
        const progress: ProgressContext = createProgressContext({
          processId: options.processId,
          totalBytes,
          processedBytes,
          fileIndex: index + 1,
          fileCount,
          currentFile: filePath,
          onProgress: options.onProgress
        })

        if (ext === '.zip') {
          processedBytes += await processZipFile(filePath, progress)
        } else if (ext === '.rar') {
          processedBytes += await processRarFile(filePath, progress)
        } else if (TEXT_EXTENSIONS.has(ext)) {
          processedBytes += await processTextFile(filePath, progress)
        } else {
          options.onError({
            processId: options.processId,
            message: `Unsupported file type: ${filePath}`
          })
        }
      }

      options.onDone({
        processId: options.processId,
        stats,
        cancelled
      })
    } catch (error) {
      options.onError({
        processId: options.processId,
        message: error instanceof Error ? error.message : 'Unknown processing error'
      })
    }
  }

  const safeJsonParse = (line: string) => {
    try {
      const parsed = JSON.parse(line) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ok: true, value: parsed as Record<string, unknown> }
      }
      return { ok: true, value: { value: parsed } as Record<string, unknown> }
    } catch {
      return { ok: false, value: {} as Record<string, unknown> }
    }
  }

  const emitChunk = (rows: LogRow[]) => {
    if (!rows.length) return
    options.onChunk({
      processId: options.processId,
      rows,
      columns: Array.from(columns),
      stats: { ...stats }
    })
  }

  const processStreamLines = async (stream: NodeJS.ReadableStream, source: string, progress: ProgressContext) => {
    let rowIndex = 0
    let localBytes = 0
    let lastChunkAt = Date.now()
    let buffer: LogRow[] = []

    stream.on('data', (chunk) => {
      localBytes += chunk.length
      progress.processedBytes += chunk.length
      const now = Date.now()
      if (now - lastChunkAt > 200) {
        progress.report()
        lastChunkAt = now
      }
    })

    const reader = createInterface({ input: stream, crlfDelay: Infinity })

    for await (const line of reader) {
      if (cancelled) {
        reader.close()
        stream.destroy()
        break
      }

      stats.totalLines += 1
      rowIndex += 1

      if (!line.trim()) continue

      const parsed = safeJsonParse(line)
      if (parsed.ok) {
        Object.keys(parsed.value).forEach((key) => columns.add(key))
      } else {
        stats.invalidLines += 1
      }

      const row: LogRow = {
        id: `${options.processId}_${stats.totalLines}`,
        source,
        lineNumber: rowIndex,
        data: parsed.ok ? parsed.value : {},
        raw: parsed.ok ? undefined : line,
        valid: parsed.ok
      }

      buffer.push(row)
      if (buffer.length >= options.batchSize) {
        emitChunk(buffer)
        buffer = []
        await new Promise((resolve) => setImmediate(resolve))
      }
    }

    if (buffer.length) {
      emitChunk(buffer)
    }

    progress.report()
    return localBytes
  }

  const processTextFile = async (filePath: string, progress: ProgressContext) => {
    const stream = fs.createReadStream(filePath)
    return processStreamLines(stream, filePath, progress)
  }

  const processZipFile = async (zipPath: string, progress: ProgressContext) => {
    const zip = await openZip(zipPath)
    let bytesRead = 0

    return new Promise<number>((resolve, reject) => {
      const nextEntry = () => zip.readEntry()

      zip.on('entry', (entry) => {
        if (cancelled) {
          zip.close()
          resolve(bytesRead)
          return
        }

        if (/\/$/.test(entry.fileName)) {
          nextEntry()
          return
        }

        const source = `${path.basename(zipPath)}::${entry.fileName}`
        zip.openReadStream(entry, async (error, stream) => {
          if (error || !stream) {
            reject(error ?? new Error('Unable to read zip entry'))
            return
          }

          try {
            bytesRead += await processStreamLines(stream, source, progress)
            nextEntry()
          } catch (err) {
            reject(err)
          }
        })
      })

      zip.on('end', () => resolve(bytesRead))
      zip.on('error', (error) => reject(error))
      nextEntry()
    })
  }

  const processRarFile = async (rarPath: string, progress: ProgressContext) => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'log-analyzer-'))
    try {
      const extractor = createExtractorFromFile({ filepath: rarPath, targetPath: tempDir }) as any
      const list = extractor.getFileList() as any
      if (list?.[0]?.state !== 'SUCCESS') {
        throw new Error('Unable to read RAR file')
      }

      const files = list[1]?.fileHeaders ?? []
      const extractResult = extractor.extract({ files }) as any
      if (extractResult?.[0]?.state !== 'SUCCESS') {
        throw new Error('Unable to extract RAR file')
      }

      let bytesRead = 0
      for (const fileHeader of files) {
        if (cancelled) break
        if (fileHeader?.flags?.directory) continue
        const filePath = path.join(tempDir, fileHeader.name)
        bytesRead += await processTextFile(filePath, progress)
      }
      return bytesRead
    } catch (error) {
      options.onError({
        processId: options.processId,
        message: error instanceof Error ? error.message : 'RAR processing failed'
      })
      return 0
    }
  }

  return { start, cancel }
}

function createProgressContext(params: {
  processId: string
  totalBytes: number
  processedBytes: number
  currentFile: string
  fileIndex: number
  fileCount: number
  onProgress: (payload: LogProgressPayload) => void
}): ProgressContext {
  let lastReport = 0

  const context: ProgressContext = {
    totalBytes: params.totalBytes,
    processedBytes: params.processedBytes,
    currentFile: params.currentFile,
    fileIndex: params.fileIndex,
    fileCount: params.fileCount,
    report: () => {
      const now = Date.now()
      if (now - lastReport < 120) return
      lastReport = now
      params.onProgress({
        processId: params.processId,
        processedBytes: context.processedBytes,
        totalBytes: params.totalBytes,
        currentFile: params.currentFile,
        fileIndex: params.fileIndex,
        fileCount: params.fileCount
      })
    }
  }

  return context
}

async function estimateTotalBytes(filePaths: string[]) {
  let total = 0
  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.zip') {
      total += await estimateZipBytes(filePath)
    } else if (ext === '.rar') {
      const stat = await fs.promises.stat(filePath)
      total += stat.size
    } else {
      const stat = await fs.promises.stat(filePath)
      total += stat.size
    }
  }
  return total
}

function openZip(zipPath: string) {
  return new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(error ?? new Error('Unable to open zip file'))
        return
      }
      resolve(zipFile)
    })
  })
}

async function estimateZipBytes(zipPath: string) {
  const zip = await openZip(zipPath)
  return new Promise<number>((resolve, reject) => {
    let total = 0
    zip.on('entry', (entry) => {
      if (!/\/$/.test(entry.fileName)) {
        total += entry.uncompressedSize || 0
      }
      zip.readEntry()
    })
    zip.on('end', () => resolve(total))
    zip.on('error', (error) => reject(error))
    zip.readEntry()
  })
}

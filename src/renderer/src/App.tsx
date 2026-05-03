import { useEffect, useMemo, useState } from 'react'
import { Ban, FileDown, FileSearch, Filter, Search } from 'lucide-react'
import Dropzone from './components/Dropzone'
import LogTable from './components/LogTable'
import PreviewModal from './components/PreviewModal'
import ProgressCard from './components/ProgressCard'
import FileTabs from './components/FileTabs'
import Button from './components/Button'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { rowsToCsv } from './utils/csv'
import { deepMatch } from './utils/search'
import { isTimestampField, parseToDate } from './utils/formatters'
import type {
  LogChunkPayload,
  LogDonePayload,
  LogErrorPayload,
  LogProgressPayload,
  LogRow,
  LogStats,
  FileTab
} from './types'

const EMPTY_STATS: LogStats = { totalLines: 0, invalidLines: 0 }
const PREDEFINED_COLUMNS = [
  'status',
  'method',
  'url',
  'level',
  'time',
  'service',
  'message',
  'env',
  'statusCode',
  'responseTime'
];

function mergeColumns(current: string[], incoming: string[]) {
  const set = new Set(current);
  incoming.forEach((column) => set.add(column));
  return Array.from(set);
}

function getColumnValue(row: LogRow, column: string) {
  if (column === 'source') return row.source;
  if (column === 'line') return row.lineNumber;
  const value = row.data[column];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  return JSON.stringify(value);
}

export default function App() {
  const [files, setFiles] = useState<FileTab[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [appendMode, setAppendMode] = useState(false)

  const activeFile = useMemo(() => 
    files.find(f => f.id === activeFileId) || null
  , [files, activeFileId])

  // Debounced search per active file
  const { debounced: debouncedSearch, isPending: searchPending } = useDebouncedValue(activeFile?.globalSearch || '')

  useEffect(() => {
    const unsubscribeChunk = window.api.onChunk((payload: LogChunkPayload) => {
      setFiles(prev => prev.map(f => {
        if (f.processId === payload.processId) {
          return {
            ...f,
            rows: [...f.rows, ...payload.rows],
            columns: mergeColumns(f.columns, payload.columns),
            stats: payload.stats
          }
        }
        return f
      }))
    })

    const unsubscribeProgress = window.api.onProgress((payload: LogProgressPayload) => {
      setFiles(prev => prev.map(f => {
        if (f.processId === payload.processId) {
          return { ...f, progress: payload }
        }
        return f
      }))
    })

    const unsubscribeDone = window.api.onDone((payload: LogDonePayload) => {
      setFiles(prev => prev.map(f => {
        if (f.processId === payload.processId) {
          return { 
            ...f, 
            processing: false, 
            progress: null, 
            stats: payload.stats 
          }
        }
        return f
      }))
    })

    const unsubscribeError = window.api.onError((payload: LogErrorPayload) => {
      setFiles(prev => prev.map(f => {
        if (f.processId === payload.processId) {
          return { ...f, error: payload.message, processing: false }
        }
        return f
      }))
    })

    return () => {
      unsubscribeChunk()
      unsubscribeProgress()
      unsubscribeDone()
      unsubscribeError()
    }
  }, [])

  const handleStart = async (filePaths: string[]) => {
    const newTabs: FileTab[] = []
    
    for (const path of filePaths) {
      const fileName = path.split(/[\\/]/).pop() || path
      const tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      
      const newTab: FileTab = {
        id: tabId,
        processId: null,
        name: fileName,
        rows: [],
        columns: [],
        stats: EMPTY_STATS,
        processing: true,
        progress: null,
        error: null,
        globalSearch: '',
        columnFilters: {},
        startDate: '',
        endDate: '',
        sortBy: '',
        sortDir: 'asc',
        selectedIndex: null,
        useDynamicColumns: true
      }
      
      newTabs.push(newTab)
    }

    setFiles(prev => [...prev, ...newTabs])
    if (newTabs.length > 0) {
      setActiveFileId(newTabs[0].id)
    }

    // Start processing for each file
    for (let i = 0; i < newTabs.length; i++) {
      const tab = newTabs[i]
      const filePath = filePaths[i]
      const result = await window.api.startProcessing([filePath])
      if (result.processId) {
        setFiles(prev => prev.map(f => f.id === tab.id ? { ...f, processId: result.processId } : f))
      } else {
        setFiles(prev => prev.map(f => f.id === tab.id ? { ...f, processing: false, error: 'Failed to start processing' } : f))
      }
    }
  }

  const handleTabClose = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tabToClose = files.find(f => f.id === id)
    if (tabToClose?.processId) {
      await window.api.cancelProcessing(tabToClose.processId)
    }

    const newFiles = files.filter(f => f.id !== id)
    setFiles(newFiles)

    if (activeFileId === id) {
      if (newFiles.length > 0) {
        setActiveFileId(newFiles[newFiles.length - 1].id)
      } else {
        setActiveFileId(null)
      }
    }
  }

  const updateActiveFile = (updates: Partial<FileTab>) => {
    if (!activeFileId) return
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, ...updates } : f))
  }

  const handleClearAll = () => {
    files.forEach(f => {
      if (f.processId) window.api.cancelProcessing(f.processId)
    })
    setFiles([])
    setActiveFileId(null)
    setShowPaste(false)
  }

  const handleParsePaste = () => {
    if (!pasteText.trim()) return

    const lines = pasteText.split(/\r?\n/)
    const newRows: LogRow[] = []
    const allKeys = new Set<string>()
    let invalidCount = 0

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return
      const rowIndex = index + 1
      try {
        const parsed = JSON.parse(trimmed)
        const rowData = typeof parsed === 'object' && !Array.isArray(parsed) 
          ? parsed as Record<string, unknown> 
          : { value: parsed }
        Object.keys(rowData).forEach(k => allKeys.add(k))
        newRows.push({
          id: `paste_${Date.now()}_${rowIndex}`,
          source: 'pasted_data',
          lineNumber: rowIndex,
          valid: true,
          data: rowData
        })
      } catch (err) {
        invalidCount++
        newRows.push({
          id: `paste_${Date.now()}_${rowIndex}`,
          source: 'pasted_data',
          lineNumber: rowIndex,
          valid: false,
          data: {},
          raw: trimmed
        })
      }
    })

    const tabId = `paste_${Date.now()}`
    const newTab: FileTab = {
      id: tabId,
      processId: null,
      name: 'Pasted Logs',
      rows: newRows,
      columns: Array.from(allKeys),
      stats: { totalLines: newRows.length, invalidLines: invalidCount },
      processing: false,
      progress: null,
      error: null,
      globalSearch: '',
      columnFilters: {},
      startDate: '',
      endDate: '',
      sortBy: '',
      sortDir: 'asc',
      selectedIndex: null,
      useDynamicColumns: true
    }

    setFiles(prev => [...prev, newTab])
    setActiveFileId(tabId)
    setShowPaste(false)
    setPasteText('')
  }

  const handleLoadMockData = () => {
    const mockRows: LogRow[] = [
      { id: 'mock_1', source: 'api.log', lineNumber: 1, valid: true, data: { status: 200, method: 'GET', url: '/home', responseTime: 42 } },
      { id: 'mock_2', source: 'api.log', lineNumber: 2, valid: true, data: { status: 400, method: 'POST', url: '/login', error: 'Bad Request' } },
      { id: 'mock_3', source: 'api.log', lineNumber: 3, valid: true, data: { status: 500, method: 'GET', url: '/data', responseTime: 1200 } }
    ]
    const allKeys = new Set<string>()
    mockRows.forEach((r) => Object.keys(r.data).forEach((k) => allKeys.add(k)))

    const tabId = `mock_${Date.now()}`
    const newTab: FileTab = {
      id: tabId,
      processId: null,
      name: 'Mock Data',
      rows: mockRows,
      columns: Array.from(allKeys),
      stats: { totalLines: mockRows.length, invalidLines: 0 },
      processing: false,
      progress: null,
      error: null,
      globalSearch: '',
      columnFilters: {},
      startDate: '',
      endDate: '',
      sortBy: '',
      sortDir: 'asc',
      selectedIndex: null,
      useDynamicColumns: true
    }
    setFiles(prev => [...prev, newTab])
    setActiveFileId(tabId)
  }

  const filteredRows = useMemo(() => {
    if (!activeFile) return []
    const search = debouncedSearch.trim().toLowerCase()
    const activeFilters = Object.entries(activeFile.columnFilters).filter(([, v]) => v && v.trim() !== '')
    const start = activeFile.startDate ? new Date(activeFile.startDate).getTime() : null
    const end = activeFile.endDate ? new Date(activeFile.endDate).getTime() : null

    if (!search && activeFilters.length === 0 && !start && !end) return activeFile.rows

    return activeFile.rows.filter((row) => {
      if (start || end) {
        const tsField = Object.keys(row.data).find(isTimestampField)
        if (tsField) {
          const rowDate = parseToDate(row.data[tsField])
          if (rowDate) {
            const rowTime = rowDate.getTime()
            if (start && rowTime < start) return false
            if (end && rowTime > end) return false
          }
        } else {
          return false
        }
      }

      if (search) {
        const inSource = row.source.toLowerCase().includes(search)
        const inRaw = row.raw?.toLowerCase().includes(search) ?? false
        const inData = deepMatch(row.data, search)
        if (!inSource && !inRaw && !inData) return false
      }

      for (const [column, value] of activeFilters) {
        const query = value.trim().toLowerCase()
        if (!query) continue
        if (column === 'source') {
          if (!row.source.toLowerCase().includes(query)) return false
          continue
        }
        if (column === 'line') {
          if (!String(row.lineNumber).includes(query)) return false
          continue
        }
        if (!deepMatch(row.data[column], query)) return false
      }
      return true
    })
  }, [activeFile?.rows, debouncedSearch, activeFile?.columnFilters, activeFile?.startDate, activeFile?.endDate])

  const sortedRows = useMemo(() => {
    if (!activeFile || !activeFile.sortBy) return filteredRows
    const sorted = [...filteredRows]
    sorted.sort((a, b) => {
      const aValue = getColumnValue(a, activeFile.sortBy)
      const bValue = getColumnValue(b, activeFile.sortBy)
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return activeFile.sortDir === 'asc' ? aValue - bValue : bValue - aValue
      }
      const aStr = String(aValue ?? '').toLowerCase()
      const bStr = String(bValue ?? '').toLowerCase()
      if (aStr < bStr) return activeFile.sortDir === 'asc' ? -1 : 1
      if (aStr > bStr) return activeFile.sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredRows, activeFile?.sortBy, activeFile?.sortDir])

  const visibleColumns = useMemo(() => {
    if (!activeFile) return []
    if (activeFile.useDynamicColumns) return activeFile.columns
    return activeFile.columns.filter((col) => PREDEFINED_COLUMNS.includes(col))
  }, [activeFile?.columns, activeFile?.useDynamicColumns])

  const columnSuggestions = useMemo(() => {
    if (!activeFile) return {}
    const suggestions: Record<string, Set<string>> = { source: new Set() }
    activeFile.columns.forEach((col) => (suggestions[col] = new Set()))
    const scanLimit = Math.min(activeFile.rows.length, 20000)
    for (let i = 0; i < scanLimit; i++) {
      const row = activeFile.rows[i]
      suggestions.source.add(row.source)
      activeFile.columns.forEach((col) => {
        const val = row.data[col]
        if (val !== undefined && val !== null && val !== '') suggestions[col].add(String(val))
      })
    }
    const result: Record<string, string[]> = {}
    Object.keys(suggestions).forEach((key) => { result[key] = Array.from(suggestions[key]).sort() })
    return result
  }, [activeFile?.rows, activeFile?.columns])

  const handleExport = async (format: 'json' | 'csv') => {
    if (!sortedRows.length || !activeFile) return
    let content = ''
    if (format === 'json') {
      content = JSON.stringify(sortedRows.map(r => ({ __meta: { source: r.source, line: r.lineNumber, valid: r.valid }, ...r.data })), null, 2)
    } else {
      content = rowsToCsv(sortedRows, ['source', 'line', ...activeFile.columns])
    }
    await window.api.exportLogs({ format, content })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <h1>Log Analyzer</h1>
            <p>Stream, parse, and explore high-volume logs.</p>
          </div>
        </div>

        <div className="header-right">
          {activeFile && (
            <section className="status-bar-compact">
              <div className="status-pill-small">
                <span className="label">Total</span>
                <span className="value">{activeFile.stats.totalLines.toLocaleString()}</span>
              </div>
              <div className="status-pill-small warn">
                <span className="label">Invalid</span>
                <span className="value">{activeFile.stats.invalidLines.toLocaleString()}</span>
              </div>
              <div className="status-pill-small">
                <span className="label">Loaded</span>
                <span className="value">{activeFile.rows.length.toLocaleString()}</span>
              </div>
              {activeFile.error && (
                <div className="status-pill-small error" title={activeFile.error}>
                  <Ban size={14} />
                  <span className="value">Error</span>
                </div>
              )}
            </section>
          )}

          <div className="header-actions">
            {files.length > 0 && (
              <Button
                variant="ghost"
                danger
                isIconOnly
                onClick={handleClearAll}
                title="Clear All"
                icon={<Ban size={18} />}
              />
            )}
            <Button variant="ghost" onClick={handleLoadMockData}>Mock</Button>
            <Button variant="ghost" onClick={() => setShowPaste(!showPaste)}>
              {showPaste ? 'Upload' : 'Paste'}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const paths = await window.api.openLogDialog()
                if (paths.length) handleStart(paths)
              }}
              icon={<FileSearch size={18} />}
            >
              Select files
            </Button>
            {activeFile && (
              <div className="button-group">
                <Button
                  variant="ghost"
                  isIconOnly
                  onClick={() => handleExport('json')}
                  title="Export JSON"
                  icon={<FileDown size={18} />}
                />
                <Button
                  variant="ghost"
                  isIconOnly
                  onClick={() => handleExport('csv')}
                  title="Export CSV"
                  icon={<FileDown size={18} />}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <FileTabs 
        tabs={files} 
        activeId={activeFileId} 
        onTabSelect={setActiveFileId} 
        onTabClose={handleTabClose} 
      />

      {activeFile?.progress && (
        <ProgressCard 
          progress={activeFile.progress} 
          onCancel={() => activeFile.processId && window.api.cancelProcessing(activeFile.processId)} 
        />
      )}

      {activeFile && (
        <section className="toolbar">
          <div className={`toolbar-search ${searchPending ? 'searching' : ''}`}>
            <Search size={16} className={searchPending ? 'spin' : ''} />
            <input
              id="global-search-input"
              value={activeFile.globalSearch}
              onChange={(e) => updateActiveFile({ globalSearch: e.target.value })}
              placeholder="Search all fields — nested JSON, numbers, strings…"
              autoComplete="off"
              spellCheck={false}
            />
            {activeFile.globalSearch && (
              <button className="search-clear-btn" onClick={() => updateActiveFile({ globalSearch: '' })}>×</button>
            )}
          </div>

          <Button
            variant={activeFile.useDynamicColumns ? 'secondary' : 'outline'}
            onClick={() => updateActiveFile({ useDynamicColumns: !activeFile.useDynamicColumns })}
            icon={<Filter size={16} />}
            size="sm"
          >
            {visibleColumns.length} columns (Dynamic: {activeFile.useDynamicColumns ? 'ON' : 'OFF'})
          </Button>
        </section>
      )}

      <main className="main-content">
        {!files.length && !showPaste && <Dropzone onFiles={handleStart} />}

        {showPaste && !activeFile && (
          <div className="paste-container">
            <textarea
              className="paste-textarea"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your log data here (each line should be JSON)..."
            />
            <div className="paste-actions">
              <Button
                variant="primary"
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
              >
                Parse Logs
              </Button>
              <Button variant="ghost" onClick={() => setShowPaste(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {activeFile && (
          <LogTable
            rows={sortedRows}
            columns={visibleColumns}
            sortBy={activeFile.sortBy}
            sortDir={activeFile.sortDir}
            columnFilters={activeFile.columnFilters}
            columnSuggestions={columnSuggestions}
            searchTerm={debouncedSearch.trim().toLowerCase()}
            startDate={activeFile.startDate}
            endDate={activeFile.endDate}
            hasDateFilter={!!(activeFile.startDate || activeFile.endDate)}
            onSortChange={(col) => updateActiveFile({ 
              sortBy: col, 
              sortDir: activeFile.sortBy === col ? (activeFile.sortDir === 'asc' ? 'desc' : 'asc') : 'asc' 
            })}
            onFilterChange={(col, val) => updateActiveFile({ 
              columnFilters: { ...activeFile.columnFilters, [col]: val } 
            })}
            onStartDateChange={(val) => updateActiveFile({ startDate: val })}
            onEndDateChange={(val) => updateActiveFile({ endDate: val })}
            onClearFilters={() => updateActiveFile({ globalSearch: '', columnFilters: {}, startDate: '', endDate: '' })}
            onRowClick={(index) => updateActiveFile({ selectedIndex: index })}
          />
        )}
      </main>

      {activeFile?.selectedIndex !== null && activeFile && sortedRows[activeFile.selectedIndex] && (
        <PreviewModal
          row={sortedRows[activeFile.selectedIndex]}
          onClose={() => updateActiveFile({ selectedIndex: null })}
          onPrev={() => updateActiveFile({ selectedIndex: Math.max(0, activeFile.selectedIndex! - 1) })}
          onNext={() => updateActiveFile({ selectedIndex: Math.min(sortedRows.length - 1, activeFile.selectedIndex! + 1) })}
          hasPrev={activeFile.selectedIndex > 0}
          hasNext={activeFile.selectedIndex < sortedRows.length - 1}
        />
      )}
    </div>
  )
}

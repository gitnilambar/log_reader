import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, FileDown, FileSearch, Filter, Search } from 'lucide-react'
import Dropzone from './components/Dropzone'
import LogTable from './components/LogTable'
import PreviewModal from './components/PreviewModal'
import ProgressCard from './components/ProgressCard'
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
  LogStats
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
  const [rows, setRows] = useState<LogRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [useDynamicColumns, setUseDynamicColumns] = useState(true);
  const [stats, setStats] = useState<LogStats>(EMPTY_STATS);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [appendMode, setAppendMode] = useState(false);
  const [progress, setProgress] = useState<LogProgressPayload | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processId, setProcessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileNames, setFileNames] = useState<string[]>([])

  const [globalSearch, setGlobalSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const processIdRef = useRef<string | null>(null)

  // 300ms debounce — isPending is true while the user is still typing
  const { debounced: debouncedSearch, isPending: searchPending } = useDebouncedValue(globalSearch)

  useEffect(() => {
    const unsubscribeChunk = window.api.onChunk((payload: LogChunkPayload) => {
      if (payload.processId !== processIdRef.current) return
      setRows((prev) => [...prev, ...payload.rows])
      setColumns((prev) => mergeColumns(prev, payload.columns))
      setStats(payload.stats)
    })

    const unsubscribeProgress = window.api.onProgress((payload: LogProgressPayload) => {
      if (payload.processId !== processIdRef.current) return
      setProgress(payload)
    })

    const unsubscribeDone = window.api.onDone((payload: LogDonePayload) => {
      if (payload.processId !== processIdRef.current) return
      setProcessing(false)
      setProgress(null)
      setStats(payload.stats)
    })

    const unsubscribeError = window.api.onError((payload: LogErrorPayload) => {
      if (payload.processId !== processIdRef.current) return
      setError(payload.message)
      setProcessing(false)
    })

    return () => {
      unsubscribeChunk()
      unsubscribeProgress()
      unsubscribeDone()
      unsubscribeError()
    }
  }, [])

  const handleStart = async (filePaths: string[]) => {
    setError(null)
    setRows([])
    setColumns([])
    setStats(EMPTY_STATS)
    setColumnFilters({})
    setGlobalSearch('')
    setSelectedIndex(null)
    setFileNames(filePaths.map((p) => p.split(/[\\/]/).pop() || p))

    const result = await window.api.startProcessing(filePaths)
    if (result.processId) {
      processIdRef.current = result.processId
      setProcessId(result.processId)
      setProcessing(true)
    }
  }

  const openDialog = async () => {
    const filePaths = await window.api.openLogDialog()
    if (filePaths.length) {
      await handleStart(filePaths)
    }
  }

  const handleClearAll = () => {
    setRows([])
    setColumns([])
    setStats(EMPTY_STATS)
    setPasteText('')
    setGlobalSearch('')
    setColumnFilters({})
    setSortBy('')
    setSelectedIndex(null)
    setError(null)
    setStartDate('')
    setEndDate('')
    setFileNames([])
  }

  const handleParsePaste = () => {
    if (!pasteText.trim()) return

    const lines = pasteText.split(/\r?\n/)
    const newRows: LogRow[] = []
    const allKeys = new Set<string>(appendMode ? columns : [])
    let invalidCount = appendMode ? stats.invalidLines : 0

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return

      const rowIndex = appendMode ? rows.length + index : index + 1

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

    setRows((prev) => appendMode ? [...prev, ...newRows] : newRows)
    setColumns(Array.from(allKeys))
    setStats({ 
      totalLines: (appendMode ? rows.length : 0) + newRows.length, 
      invalidLines: invalidCount 
    })
    setError(null)
    setProcessing(false)
    setShowPaste(false)
  }


  const handleLoadMockData = () => {
    const mockRows: LogRow[] = [
      {
        id: 'mock_1',
        source: 'api-server.log',
        lineNumber: 1,
        valid: true,
        data: { status: 200, method: 'GET', url: '/api/home', responseTime: 42 }
      },
      {
        id: 'mock_2',
        source: 'api-server.log',
        lineNumber: 2,
        valid: true,
        data: {
          status: 400,
          method: 'POST',
          url: '/api/login',
          error: 'Bad Request',
          details: { field: 'password', reason: 'missing or too short' }
        }
      },
      {
        id: 'mock_3',
        source: 'api-server.log',
        lineNumber: 3,
        valid: true,
        data: {
          status: 500,
          method: 'GET',
          url: '/api/data',
          responseTime: 1200,
          error: {
            type: 'DatabaseError',
            message: 'ECONNREFUSED',
            meta: { host: '127.0.0.1', port: 3306, db: 'main_db' }
          }
        }
      },
      {
        id: 'mock_4',
        source: 'access.log',
        lineNumber: 4,
        valid: true,
        data: {
          status: 403,
          method: 'DELETE',
          userId: 'U123',
          ip: '192.168.1.1',
          auth: { role: 'viewer', permission: 'read_only', code: 'FORBIDDEN' }
        }
      },
      {
        id: 'mock_5',
        source: 'access.log',
        lineNumber: 5,
        valid: true,
        data: { status: 200, method: 'GET', url: '/api/user', userId: 'U456', device: 'Mobile' }
      },
      {
        id: 'mock_6',
        source: 'api-server.log',
        lineNumber: 6,
        valid: true,
        data: {
          status: 404,
          method: 'GET',
          url: '/api/product/999',
          response: { code: 404, message: 'Not Found', details: { resource: 'product', id: 999 } }
        }
      },
      {
        id: 'mock_7',
        source: 'payment.log',
        lineNumber: 7,
        valid: true,
        data: {
          level: 'error',
          timestamp: '2024-01-15T10:30:00.000Z',
          message: 'Payment gateway timeout',
          context: {
            service: 'payments',
            provider: {
              name: 'stripe',
              endpoint: 'https://api.stripe.com/v1/charges',
              timeoutMs: 5000
            }
          }
        }
      }
    ]

    const allKeys = new Set<string>()
    mockRows.forEach((r) => Object.keys(r.data).forEach((k) => allKeys.add(k)))

    setRows(mockRows)
    setColumns(Array.from(allKeys))
    setStats({ totalLines: mockRows.length, invalidLines: 0 })
    setError(null)
    setProcessing(false)
    console.log('[MockData] Loaded. Try: 404, "Not Found", ECONNREFUSED, stripe, 3306, FORBIDDEN')
  }

  const handleCancel = async () => {
    if (processIdRef.current) {
      await window.api.cancelProcessing(processIdRef.current)
    }
    setProcessing(false)
  }

  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

   const handleFilterChange = (column: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [column]: value }))
  }

  const visibleColumns = useMemo(() => {
    if (useDynamicColumns) return columns
    return columns.filter((col) => PREDEFINED_COLUMNS.includes(col))
  }, [columns, useDynamicColumns])

  const filteredRows = useMemo(() => {
    const search = debouncedSearch.trim().toLowerCase()
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v && v.trim() !== '')
    const start = startDate ? new Date(startDate).getTime() : null
    const end = endDate ? new Date(endDate).getTime() : null

    if (!search && activeFilters.length === 0 && !start && !end) return rows

    return rows.filter((row) => {
      // 1. Date Range Filter
      if (start || end) {
        const tsField = Object.keys(row.data).find(isTimestampField)
        if (tsField) {
          const rowDate = parseToDate(row.data[tsField])
          if (rowDate) {
            const rowTime = rowDate.getTime()
            if (start && rowTime < start) return false
            if (end && rowTime > end) return false
          }
        } else if (start || end) {
          // If a range is set but the row has no timestamp field, we exclude it if the range is active?
          // Actually, let's keep it if it's mock data without timestamps, but for real logs, we usually expect them.
          // For now, let's say if a range is set and no TS field exists, it's filtered out.
          return false
        }
      }

      // 2. Global Search
      if (search) {
        const inSource = row.source.toLowerCase().includes(search)
        const inRaw = row.raw?.toLowerCase().includes(search) ?? false
        const inData = deepMatch(row.data, search)
        if (!inSource && !inRaw && !inData) return false
      }

      // 3. Per-column Filters
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
  }, [rows, debouncedSearch, columnFilters, startDate, endDate])

  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows
    const sorted = [...filteredRows]
    sorted.sort((a, b) => {
      const aValue = getColumnValue(a, sortBy)
      const bValue = getColumnValue(b, sortBy)

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDir === 'asc' ? aValue - bValue : bValue - aValue
      }

      const aStr = String(aValue ?? '').toLowerCase()
      const bStr = String(bValue ?? '').toLowerCase()
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredRows, sortBy, sortDir])

  const columnSuggestions = useMemo(() => {
    const suggestions: Record<string, Set<string>> = { source: new Set() }
    columns.forEach((col) => (suggestions[col] = new Set()))

    // For performance, only scan up to 20,000 rows for suggestions
    const scanLimit = Math.min(rows.length, 20000)
    for (let i = 0; i < scanLimit; i++) {
      const row = rows[i]
      suggestions.source.add(row.source)
      columns.forEach((col) => {
        const val = row.data[col]
        if (val !== undefined && val !== null && val !== '') {
          suggestions[col].add(String(val))
        }
      })
    }

    const result: Record<string, string[]> = {}
    Object.keys(suggestions).forEach((key) => {
      result[key] = Array.from(suggestions[key]).sort()
    })
    return result
  }, [rows, visibleColumns])

  const selectedRow = selectedIndex !== null ? sortedRows[selectedIndex] : null

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= sortedRows.length) {
      setSelectedIndex(null)
    }
  }, [selectedIndex, sortedRows.length])

  const handleExport = async (format: 'json' | 'csv') => {
    if (!sortedRows.length) return
    if (format === 'json') {
      const json = JSON.stringify(
        sortedRows.map((row) => ({
          __meta: { source: row.source, lineNumber: row.lineNumber, valid: row.valid },
          ...row.data
        })),
        null,
        2
      )
      await window.api.exportLogs({ format, content: json })
      return
    }

    const csv = rowsToCsv(sortedRows, ['source', 'line', ...columns])
    await window.api.exportLogs({ format, content: csv })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <h1>Log Analyzer</h1>
            <p>Stream, parse, and explore high-volume logs.</p>
          </div>
          
          {fileNames.length > 0 && (
            <div className="file-info">
              <span className="file-info-label">Active:</span>
              <span className="file-info-name" title={fileNames.join(', ')}>
                {fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files selected`}
              </span>
            </div>
          )}
        </div>

        <div className="header-right">
          <section className="status-bar-compact">
            <div className="status-pill-small">
              <span className="label">Total</span>
              <span className="value">{stats.totalLines.toLocaleString()}</span>
            </div>
            <div className="status-pill-small warn">
              <span className="label">Invalid</span>
              <span className="value">{stats.invalidLines.toLocaleString()}</span>
            </div>
            <div className="status-pill-small">
              <span className="label">Loaded</span>
              <span className="value">{rows.length.toLocaleString()}</span>
            </div>
            {error ? (
              <div className="status-pill-small error" title={error}>
                <Ban size={14} />
                <span className="value">Error</span>
              </div>
            ) : null}
          </section>

          <div className="header-actions">
            {rows.length > 0 && (
              <button className="ghost-button danger" onClick={handleClearAll} type="button" title="Clear All">
                <Ban size={18} />
              </button>
            )}
            <button className="ghost-button" onClick={handleLoadMockData} type="button">
              Mock
            </button>
            <button className="ghost-button" onClick={() => setShowPaste(!showPaste)} type="button">
              {showPaste ? 'Upload' : 'Paste'}
            </button>
            <button
              className="primary-button"
              onClick={openDialog}
              type="button"
              disabled={processing}
            >
              <FileSearch size={18} />
              Select files
            </button>
            <div className="button-group">
              <button className="ghost-button icon-only" onClick={() => handleExport('json')} type="button" title="Export JSON">
                <FileDown size={18} />
              </button>
              <button className="ghost-button icon-only" onClick={() => handleExport('csv')} type="button" title="Export CSV">
                <FileDown size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {progress ? <ProgressCard progress={progress} onCancel={handleCancel} /> : null}

      <section className="toolbar">
        <div className={`toolbar-search ${searchPending ? 'searching' : ''}`}>
          <Search size={16} className={searchPending ? 'spin' : ''} />
          <input
            id="global-search-input"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder="Search all fields — nested JSON, numbers, strings…"
            autoComplete="off"
            spellCheck={false}
          />
          {globalSearch && (
            <button
              className="search-clear-btn"
              type="button"
              onClick={() => setGlobalSearch('')}
              title="Clear search"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <button
          className={`toolbar-filter toggle-button ${useDynamicColumns ? 'active' : ''}`}
          onClick={() => {
            setUseDynamicColumns(!useDynamicColumns)
          }}
          type="button"
        >
          <Filter size={16} />
          <span>{visibleColumns.length} columns (Dynamic: {useDynamicColumns ? 'ON' : 'OFF'})</span>
        </button>
      </section>

      <main className="main-content">
        {!rows.length && !processing && !showPaste ? <Dropzone onFiles={handleStart} /> : null}

        {showPaste && !rows.length && !processing ? (
          <div className="paste-container">
            <textarea
              className="paste-textarea"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your log data here (each line should be JSON)..."
            />
            <div className="paste-actions">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                />
                Append to existing logs
              </label>
              <button
                className="primary-button"
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
              >
                Parse Logs
              </button>
              <button className="ghost-button" onClick={() => setPasteText('')}>
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {rows.length > 0 && (
          <LogTable
            rows={sortedRows}
            columns={visibleColumns}
            sortBy={sortBy}
            sortDir={sortDir}
            columnFilters={columnFilters}
            columnSuggestions={columnSuggestions}
            searchTerm={debouncedSearch.trim().toLowerCase()}
            startDate={startDate}
            endDate={endDate}
            hasDateFilter={!!(startDate || endDate)}
            onSortChange={handleSortChange}
            onFilterChange={handleFilterChange}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onClearFilters={() => { 
              setGlobalSearch(''); 
              setColumnFilters({});
              setStartDate('');
              setEndDate('');
            }}
            onRowClick={(index) => setSelectedIndex(index)}
          />
        )}
      </main>

      {selectedRow ? (
        <PreviewModal
          row={selectedRow}
          onClose={() => setSelectedIndex(null)}
          onPrev={() => setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
          onNext={() =>
            setSelectedIndex((prev) =>
              prev !== null && prev < sortedRows.length - 1 ? prev + 1 : prev
            )
          }
          hasPrev={selectedIndex !== null && selectedIndex > 0}
          hasNext={selectedIndex !== null && selectedIndex < sortedRows.length - 1}
        />
      ) : null}
    </div>
  )
}


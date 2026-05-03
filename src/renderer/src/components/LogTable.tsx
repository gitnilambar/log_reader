import { useCallback, useRef, useState } from 'react'
import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { LogRow } from '../types'
import FilterInput from './FilterInput'
import TimeFilterInput from './TimeFilterInput'
import Button from './Button'
import { formatTimestamp, isTimestampField } from '../utils/formatters'

type LogTableProps = {
  rows: LogRow[]
  columns: string[]
  sortBy: string
  sortDir: 'asc' | 'desc'
  columnFilters: Record<string, string>
  columnSuggestions: Record<string, string[]>
  searchTerm: string // ← passed from App so cells can highlight matches
  startDate: string
  endDate: string
  hasDateFilter: boolean
  onSortChange: (column: string) => void
  onFilterChange: (column: string, value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onClearFilters: () => void
  onRowClick: (index: number) => void
}

const BASE_COLUMNS = ['source', 'line']
const DEFAULT_COL_WIDTH = 160
const SOURCE_COL_WIDTH = 210
const LINE_COL_WIDTH = 70

// ─── Grid layout helpers ──────────────────────────────────────────────────────

function buildGridTemplate(columns: string[], widths: Record<string, number>): string {
  const sourcePx = widths['source'] ?? SOURCE_COL_WIDTH
  const linePx = widths['line'] ?? LINE_COL_WIDTH
  const dataCols = columns.map((c) => `${widths[c] ?? DEFAULT_COL_WIDTH}px`).join(' ')
  return `${sourcePx}px ${linePx}px ${dataCols}`
}

function buildMinWidth(columns: string[], widths: Record<string, number>): number {
  return (
    (widths['source'] ?? SOURCE_COL_WIDTH) +
    (widths['line'] ?? LINE_COL_WIDTH) +
    columns.reduce((sum, c) => sum + (widths[c] ?? DEFAULT_COL_WIDTH), 0)
  )
}

// ─── Text highlight helper ────────────────────────────────────────────────────

/**
 * Splits `text` into segments and wraps the parts matching `query` in a
 * <mark> element so they appear highlighted. Case-insensitive.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>

  const lq = query.toLowerCase()
  const segments: { str: string; match: boolean }[] = []
  let remaining = text
  let cursor = 0

  while (cursor < remaining.length) {
    const idx = remaining.toLowerCase().indexOf(lq, cursor)
    if (idx === -1) {
      segments.push({ str: remaining.slice(cursor), match: false })
      break
    }
    if (idx > cursor) {
      segments.push({ str: remaining.slice(cursor, idx), match: false })
    }
    segments.push({ str: remaining.slice(idx, idx + lq.length), match: true })
    cursor = idx + lq.length
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i} className="search-highlight">
            {seg.str}
          </mark>
        ) : (
          <span key={i}>{seg.str}</span>
        )
      )}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LogTable({
  rows,
  columns,
  sortBy,
  sortDir,
  columnFilters,
  columnSuggestions,
  searchTerm,
  startDate,
  endDate,
  hasDateFilter,
  onSortChange,
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
  onRowClick
}: LogTableProps) {
  const visibleColumns = [...BASE_COLUMNS, ...columns]

  // ── Resizable columns ──────────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const dragState = useRef<{ col: string; startX: number; startWidth: number } | null>(null)

  const getWidth = (col: string) =>
    colWidths[col] ??
    (col === 'source' ? SOURCE_COL_WIDTH : col === 'line' ? LINE_COL_WIDTH : DEFAULT_COL_WIDTH)

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, col: string) => {
      e.preventDefault()
      e.stopPropagation()
      dragState.current = { col, startX: e.clientX, startWidth: getWidth(col) }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragState.current) return
        const delta = ev.clientX - dragState.current.startX
        const newWidth = Math.max(60, dragState.current.startWidth + delta)
        setColWidths((prev) => ({ ...prev, [dragState.current!.col]: newWidth }))
      }

      const onMouseUp = () => {
        dragState.current = null
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [colWidths]
  )

  const gridTemplate = buildGridTemplate(columns, colWidths)
  const minGridWidth = buildMinWidth(columns, colWidths)

  // ── Virtualised row renderer ───────────────────────────────────────────────
  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const row = rows[index]
    const tone = getRowTone(row)

    return (
      <div
        className={`table-row ${tone}`}
        style={{ ...style, gridTemplateColumns: gridTemplate, minWidth: minGridWidth, width: '100%' }}
        onClick={() => onRowClick(index)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onRowClick(index)}
      >
        <div className="cell source" title={row.source}>
          <HighlightedText text={row.source} query={searchTerm} />
        </div>
        <div className="cell line">{row.lineNumber}</div>
        {columns.map((column) => (
          <div
            className="cell"
            key={`${row.id}-${column}`}
            title={getCellTitle(row.data[column])}
          >
            {renderCellValue(row.data[column], column, searchTerm)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-content" style={{ minWidth: minGridWidth }}>
        {/* ── Header ── */}
        <div
          className="table-header"
          style={{ gridTemplateColumns: gridTemplate, minWidth: minGridWidth }}
        >
          {visibleColumns.map((column) => (
            <div key={column} className="header-cell-wrap">
              <button
                type="button"
                className="header-cell"
                onClick={() => onSortChange(column)}
              >
                <span>{column}</span>
                {sortBy === column ? (
                  sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                ) : null}
              </button>
              <div
                className="resize-handle"
                onMouseDown={(e) => handleResizeMouseDown(e, column)}
                title="Drag to resize column"
              />
            </div>
          ))}
        </div>

        {/* ── Per-column filters ── */}
        <div
          className="table-filters"
          style={{ gridTemplateColumns: gridTemplate, minWidth: minGridWidth }}
        >
          {visibleColumns.map((column) => (
            <div key={`${column}-filter`} className="filter-cell-container">
              {column !== 'line' ? (
                isTimestampField(column) ? (
                  <TimeFilterInput
                    column={column}
                    value={columnFilters[column] ?? ''}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(value) => onFilterChange(column, value)}
                    onStartDateChange={onStartDateChange}
                    onEndDateChange={onEndDateChange}
                    placeholder={`Filter ${column}`}
                  />
                ) : (
                  <FilterInput
                    column={column}
                    value={columnFilters[column] ?? ''}
                    suggestions={columnSuggestions[column] ?? []}
                    onChange={(value) => onFilterChange(column, value)}
                    placeholder={column === 'source' ? 'Filter source' : `Filter ${column}`}
                  />
                )
              ) : (
                <div className="filter-cell">
                  <span className="muted">#</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Virtualised body ── */}
        <div className="table-body">
          {rows.length > 0 ? (
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  width={width}
                  itemCount={rows.length}
                  itemSize={36}
                  className="virtual-list"
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          ) : (
            <div className="empty-state">
              <Search size={40} className="muted" />
              <h3>No results found</h3>
              <p>
                {hasDateFilter 
                  ? 'No entries match the selected date range. Try adjusting your time filters.'
                  : 'Try adjusting your search or filters to find what you\'re looking for.'}
              </p>
              <Button variant="ghost" onClick={onClearFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Cell rendering ───────────────────────────────────────────────────────────

/**
 * Renders a single table cell value.
 *
 * Priority:
 * 1. Timestamp columns → formatted "DD-MM-YYYY hh:mm:ss AM/PM" with highlight
 * 2. Nested objects/arrays → compact JSON badge with tooltip
 * 3. Primitive values → string with search highlight
 */
function renderCellValue(value: unknown, column: string, searchTerm: string): React.ReactNode {
  if (value === null || value === undefined) return ''

  // Timestamp columns — format first, then highlight
  if (isTimestampField(column)) {
    const formatted = formatTimestamp(value)
    return (
      <span className="cell-timestamp">
        <HighlightedText text={formatted} query={searchTerm} />
      </span>
    )
  }

  // Nested object/array — show compact badge
  if (typeof value === 'object') {
    const preview = JSON.stringify(value)
    const short = preview.length > 50 ? preview.slice(0, 50) + '…}' : preview
    // The full JSON is in the title tooltip; highlight within the short preview too
    return (
      <span className="json-badge">
        <HighlightedText text={short} query={searchTerm} />
      </span>
    )
  }

  // Primitive — highlight the match
  return <HighlightedText text={String(value)} query={searchTerm} />
}

/** Full value as string for the native title tooltip. */
function getCellTitle(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// ─── Row tone ─────────────────────────────────────────────────────────────────

function getRowTone(row: LogRow): string {
  const level = String(row.data.level ?? row.data.severity ?? '').toLowerCase()
  if (level.includes('error') || level.includes('fatal')) return 'tone-error'
  if (level.includes('warn')) return 'tone-warn'

  const status = Number(row.data.status ?? row.data.statusCode ?? row.data.code)
  if (!Number.isNaN(status) && status > 0) {
    if (status >= 500) return 'tone-error'
    if (status >= 400) return 'tone-warn'
    if (status >= 200 && status < 300) return 'tone-success'
  }

  return row.valid ? 'tone-default' : 'tone-error'
}

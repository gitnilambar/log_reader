import { useState } from 'react'
import { ChevronLeft, ChevronRight, Code, List, X } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { LogRow } from '../types'
import CopyButton from './CopyButton'
import Button from './Button'
import { formatTimestamp, isTimestampField } from '../utils/formatters'

type PreviewModalProps = {
  row: LogRow
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function PreviewModal({
  row,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext
}: PreviewModalProps) {
  const [view, setView] = useState<'structured' | 'raw'>('structured')

  // The full pretty-printed JSON for the entire row
  const fullJson = row.valid ? JSON.stringify(row.data, null, 2) : row.raw ?? ''

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal__header">
          <div>
            <div className="modal__title">Log Entry Details</div>
            <div className="modal__meta">
              {row.source} • Line {row.lineNumber}
            </div>
          </div>
          <div className="header-actions">
            <div className="tab-group">
              <button
                className={`tab-button ${view === 'structured' ? 'active' : ''}`}
                onClick={() => setView('structured')}
                type="button"
              >
                <List size={14} />
                Properties
              </button>
              <button
                className={`tab-button ${view === 'raw' ? 'active' : ''}`}
                onClick={() => setView('raw')}
                type="button"
              >
                <Code size={14} />
                Raw JSON
              </button>
            </div>

            {/* Copy entire row JSON — always visible regardless of tab */}
            <CopyButton
              text={fullJson}
              variant="badge"
              label="Copy full JSON to clipboard"
            />

            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              onClick={onClose}
              aria-label="Close"
              icon={<X size={18} />}
            />
          </div>
        </div>

        {/* ── Content ── */}
        <div className="modal__content">
          {!row.valid && (
            <div className="alert-error">
              <strong>Invalid JSON:</strong> This line could not be parsed as a valid JSON object.
            </div>
          )}

          {view === 'structured' && row.valid ? (
            <div className="property-grid">
              {Object.entries(row.data).map(([key, value]) => (
                <div className="property-item" key={key}>
                  <div className="property-key">{key}</div>
                  <div className="property-value">
                    {typeof value === 'object' && value !== null ? (
                      // Nested object card — has its own Copy button (top-right)
                      <div className="json-card">
                        <CopyButton
                          text={JSON.stringify(value, null, 2)}
                          variant="icon"
                          className="json-card__copy"
                          label={`Copy ${key} JSON`}
                        />
                        <SyntaxHighlighter
                          language="json"
                          style={oneLight}
                          customStyle={{
                            margin: 0,
                            padding: '8px',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            overflowX: 'hidden'
                          }}
                          wrapLines={true}
                          lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }}
                        >
                          {JSON.stringify(value, null, 2)}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <span className="property-scalar">
                        {isTimestampField(key) ? formatTimestamp(value) : String(value ?? '-')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Raw JSON view — copy button is already in the header, but add one here too
            // so the user doesn't have to scroll back up
            <div className="json-card json-card--raw">
              <CopyButton
                text={fullJson}
                variant="icon"
                className="json-card__copy"
                label="Copy raw JSON"
              />
              <SyntaxHighlighter
                language={row.valid ? 'json' : 'text'}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  padding: '20px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  overflowX: 'hidden'
                }}
                wrapLines={true}
                lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }}
              >
                {fullJson}
              </SyntaxHighlighter>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="modal__footer">
          <div className="footer-nav" style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={!hasPrev}
              icon={<ChevronLeft size={16} />}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={!hasNext}
              iconRight={<ChevronRight size={16} />}
            >
              Next
            </Button>
          </div>
          <div className="modal__meta">
            {row.valid ? `${Object.keys(row.data).length} fields • Valid JSON` : 'Raw Text'}
          </div>
        </div>

      </div>
    </div>
  )
}

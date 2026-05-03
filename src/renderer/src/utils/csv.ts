import type { LogRow } from '../types'

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? '')
  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export function rowsToCsv(rows: LogRow[], columns: string[]) {
  const header = columns.map(escapeCsv).join(',')
  const lines = rows.map((row) => {
    return columns
      .map((column) => {
        if (column === 'source') return escapeCsv(row.source)
        if (column === 'line') return escapeCsv(row.lineNumber)
        return escapeCsv(row.data[column])
      })
      .join(',')
  })

  return [header, ...lines].join('\n')
}

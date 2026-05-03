/**
 * Timestamp formatting utility.
 * Converts any recognisable timestamp value into: DD-MM-YYYY hh:mm:ss AM/PM
 *
 * Supported input formats:
 *   - ISO 8601 strings  e.g. "2024-01-15T10:30:00.000Z"
 *   - Unix seconds      e.g. 1705315800   (10-digit number)
 *   - Unix milliseconds e.g. 1705315800000 (13-digit number)
 *   - Space-separated   e.g. "2024-01-15 10:30:00"
 *   - Any string parseable by Date constructor
 *
 * Returns the original value as a string when it cannot be parsed as a date.
 */

/** Column names that we treat as timestamps. */
const TIMESTAMP_FIELDS = new Set([
  'time',
  'timestamp',
  'date',
  'datetime',
  'ts',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'logTime',
  'log_time',
  'eventTime',
  'event_time',
  'requestTime',
  'request_time',
])

const formatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

/**
 * Formats a value as "DD-MM-YYYY hh:mm:ss AM/PM" if it looks like a timestamp.
 * Returns the raw string representation otherwise.
 */
export function formatTimestamp(value: unknown): string {
  if (value === null || value === undefined) return ''

  let date: Date | null = null

  if (typeof value === 'number') {
    // Heuristic: 10-digit = Unix seconds, 13-digit = Unix ms
    const ms = value > 1e12 ? value : value * 1000
    const candidate = new Date(ms)
    if (!isNaN(candidate.getTime())) date = candidate
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    // Normalise "2024-01-15 10:30:00" → ISO-compatible
    const normalised = trimmed.replace(' ', 'T')
    const candidate = new Date(normalised)
    if (!isNaN(candidate.getTime())) date = candidate
  }

  if (!date) return String(value)

  // Intl produces "15/01/2024, 10:30:00 am" in en-GB with hour12
  // We reformat into "DD-MM-YYYY hh:mm:ss AM/PM"
  const parts = formatter.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''

  const day = get('day')
  const month = get('month')
  const year = get('year')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')
  const dayPeriod = get('dayPeriod').toUpperCase()

  return `${day}/${month}/${year} ${hour}:${minute}:${second} ${dayPeriod}`
}

/**
 * Returns true if the given column name is a known timestamp field.
 */
export function isTimestampField(column: string): boolean {
  return TIMESTAMP_FIELDS.has(column)
}

/**
 * Parses a value into a Date object.
 * Supports numbers (ms/s) and strings (ISO/Common).
 */
export function parseToDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    // 10-digit = Unix seconds, 13-digit = Unix ms
    const ms = value > 1e12 ? value : value * 1000
    const candidate = new Date(ms)
    return isNaN(candidate.getTime()) ? null : candidate
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    // Normalise "2024-01-15 10:30:00" → ISO-compatible
    const normalised = trimmed.replace(' ', 'T')
    const candidate = new Date(normalised)
    return isNaN(candidate.getTime()) ? null : candidate
  }
  return null
}

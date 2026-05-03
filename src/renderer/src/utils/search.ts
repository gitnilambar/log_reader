/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEEP SEARCH ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Searches every level of a JSON value tree — including nested objects and
 * arrays — for a query string. Handles all primitive types correctly.
 *
 * WHY the old approach broke:
 *   Object.values(row.data).map(v => String(v))
 *   When v = { code: 404 }, String(v) = "[object Object]" — useless.
 *
 * This engine fixes it by recursing into every node before converting to string.
 *
 * ALSO searches object KEYS so a user can type a field name (e.g. "response",
 * "userId") and find rows that contain that field, even without knowing the value.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Returns true if `value` contains `query` anywhere in its entire tree.
 *
 * - Numbers   → converted to string  ("404" matches 404)
 * - Booleans  → converted to string  ("true" matches true)
 * - Strings   → case-insensitive partial match
 * - Objects   → both keys AND values are searched recursively
 * - Arrays    → every element is searched recursively
 * - null/undefined → treated as no match (never throws)
 *
 * The caller is responsible for lowercasing `query` before passing it in
 * so we don't repeat that allocation on every recursive call.
 */
export function deepMatch(value: unknown, query: string): boolean {
  // Empty query always matches (show all rows)
  if (query === '') return true

  return searchNode(value, query)
}

function searchNode(value: unknown, lowerQuery: string): boolean {
  // null / undefined → no match
  if (value === null || value === undefined) return false

  // Array → search every element
  if (Array.isArray(value)) {
    return value.some((item) => searchNode(item, lowerQuery))
  }

  // Plain object → search both keys and values
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      // Match the key name itself (e.g. typing "response" finds rows with a response field)
      if (key.toLowerCase().includes(lowerQuery)) return true
      // Recurse into the value
      if (searchNode(obj[key], lowerQuery)) return true
    }
    return false
  }

  // Primitive: number, string, boolean, bigint, symbol
  // String() is safe for all of these
  return String(value).toLowerCase().includes(lowerQuery)
}

/**
 * Extracts every primitive leaf from a value tree as a flat string array.
 * Used by the suggestion system so it can show real values even from nested fields.
 */
export function extractLeafStrings(value: unknown, maxLeaves = 20): string[] {
  const results: string[] = []
  collectLeaves(value, results, maxLeaves)
  return results
}

function collectLeaves(value: unknown, out: string[], max: number): void {
  if (out.length >= max) return
  if (value === null || value === undefined) return

  if (Array.isArray(value)) {
    for (const item of value) {
      if (out.length >= max) return
      collectLeaves(item, out, max)
    }
    return
  }

  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (out.length >= max) return
      collectLeaves(v, out, max)
    }
    return
  }

  // Primitive leaf
  const s = String(value)
  if (s && s !== '[object Object]') {
    out.push(s)
  }
}

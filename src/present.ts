/**
 * Presentation bounds for tool-facing canonical values: cell text is truncated
 * so one oversized cell cannot flood the model context. This is a display
 * safety invariant, not a deployment tunable — the durable storage-domain
 * report always keeps full fidelity.
 * @module dsh-data-quality/present
 */

import type { JsonValue } from '@deepseek-ai/dsh-session'

/** Maximum characters one cell contributes to a tool-facing row payload. */
export const MAX_CELL_TEXT = 120

/**
 * Truncate one cell for display: long strings are cut with an ellipsis
 * marker; non-strings pass through.
 * @param cell - the cell to bound.
 * @returns the display-safe cell.
 */
export function truncateCell(cell: JsonValue): JsonValue {
  if (typeof cell === 'string' && cell.length > MAX_CELL_TEXT) {
    return `${cell.slice(0, MAX_CELL_TEXT)}…`
  }
  return cell
}

/**
 * Truncate every string cell of one row.
 * @param row - the row to bound.
 * @returns a display-safe copy.
 */
export function truncateRow(row: Record<string, JsonValue>): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = truncateCell(value)
  }
  return out
}

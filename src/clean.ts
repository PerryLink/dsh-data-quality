/**
 * Declarative cleaning rules over a parsed {@link Table}: dedupe, fill-missing,
 * coerce-type, normalize-unit, trim, and map-values. Pure and deterministic —
 * rules apply in array order, each seeing the previous rule's output; every
 * rule logs how many rows it affected. Unknown columns and invalid rule
 * parameters fail loud.
 * @module dsh-data-quality/clean
 */

import { isMissing, parseBoolean, parseDate, parseNumeric, throwIfAborted, type Cell, type Row, type Table } from './dataset.ts'

/** One declarative cleaning rule (discriminated on `rule`). */
export type CleanRule =
  | { readonly rule: 'dedupe'; readonly columns?: readonly string[] }
  | {
      readonly rule: 'fill-missing'
      readonly column: string
      readonly strategy: 'constant' | 'mean' | 'median' | 'forward'
      readonly value?: string | number
    }
  | { readonly rule: 'coerce-type'; readonly column: string; readonly to: 'number' | 'date' | 'boolean' }
  | { readonly rule: 'normalize-unit'; readonly column: string; readonly factors: Readonly<Record<string, number>> }
  | { readonly rule: 'trim'; readonly columns?: readonly string[] }
  | {
      readonly rule: 'map-values'
      readonly column: string
      readonly map: Readonly<Record<string, string>>
      readonly else?: 'keep' | 'missing'
    }

/** Raised for invalid rules or unknown columns; `message` names the rule index and reason. */
export class CleanRuleError extends Error {
  /**
   * @param ruleIndex - index of the offending rule in the request array.
   * @param message - actionable human-readable detail.
   */
  constructor(
    readonly ruleIndex: number,
    message: string,
  ) {
    super(message)
    this.name = 'CleanRuleError'
  }
}

/** Per-rule audit entry. */
export interface CleanRuleLog {
  readonly ruleIndex: number
  readonly rule: CleanRule['rule']
  /** Rows the rule changed (removed, filled, coerced, rewritten, or trimmed). */
  readonly affectedRows: number
  /** Extra detail, e.g. coerce failure counts. */
  readonly detail: string
}

/** The cleaning outcome: cleaned table plus the per-rule audit log. */
export interface CleanResult {
  readonly columns: string[]
  readonly rows: Row[]
  readonly logs: CleanRuleLog[]
  readonly inputRows: number
  readonly outputRows: number
}

/** Assert `column` exists; every rule validates its columns before touching data. */
function requireColumn(columns: readonly string[], column: string, ruleIndex: number): void {
  if (!columns.includes(column)) {
    throw new CleanRuleError(ruleIndex, `rule ${ruleIndex}: unknown column ${JSON.stringify(column)} (columns: ${columns.join(', ')})`)
  }
}

/** Assert every selected column exists. */
function requireColumns(columns: readonly string[], selected: readonly string[], ruleIndex: number): void {
  for (const column of selected) requireColumn(columns, column, ruleIndex)
}

/** dedupe: keep the first row of each key group; later duplicates are removed. */
function applyDedupe(table: Table, rule: Extract<CleanRule, { rule: 'dedupe' }>, ruleIndex: number, signal?: AbortSignal): { table: Table; log: CleanRuleLog } {
  const selected = rule.columns ?? table.columns
  requireColumns(table.columns, selected, ruleIndex)
  const seen = new Set<string>()
  const rows: Row[] = []
  let removed = 0
  for (const [index, row] of table.rows.entries()) {
    if (index % 1024 === 0) throwIfAborted(signal)
    const key = JSON.stringify(selected.map((column) => row[column] ?? null))
    if (seen.has(key)) {
      removed += 1
      continue
    }
    seen.add(key)
    rows.push(row)
  }
  return {
    table: { columns: table.columns, rows },
    log: { ruleIndex, rule: 'dedupe', affectedRows: removed, detail: `removed ${removed} duplicate row(s) by [${selected.join(', ')}]` },
  }
}

/** fill-missing: constant / mean / median / forward fill of missing cells in one column. */
function applyFillMissing(table: Table, rule: Extract<CleanRule, { rule: 'fill-missing' }>, ruleIndex: number, signal?: AbortSignal): { table: Table; log: CleanRuleLog } {
  requireColumn(table.columns, rule.column, ruleIndex)
  let fill: Cell | undefined
  let detail: string
  switch (rule.strategy) {
    case 'constant': {
      if (rule.value === undefined) {
        throw new CleanRuleError(ruleIndex, `rule ${ruleIndex}: fill-missing strategy "constant" requires a value`)
      }
      fill = rule.value
      detail = `filled with constant ${JSON.stringify(rule.value)}`
      break
    }
    case 'mean':
    case 'median': {
      const values = table.rows.map((row) => parseNumeric(row[rule.column])).filter((value) => value !== undefined).sort((a, b) => a - b)
      if (values.length === 0) {
        throw new CleanRuleError(ruleIndex, `rule ${ruleIndex}: fill-missing strategy "${rule.strategy}" needs at least one numeric value in column ${JSON.stringify(rule.column)}`)
      }
      const computed = rule.strategy === 'mean'
        ? values.reduce((acc, value) => acc + value, 0) / values.length
        : values.length % 2 === 1
          ? (values[(values.length - 1) / 2] as number)
          : ((values[values.length / 2 - 1] as number) + (values[values.length / 2] as number)) / 2
      fill = computed
      detail = `filled with ${rule.strategy} ${computed}`
      break
    }
    case 'forward': {
      fill = undefined
      detail = 'filled with the previous non-missing value'
      break
    }
  }
  let filled = 0
  let previous: Cell | undefined
  const rows = table.rows.map((row, index) => {
    if (index % 1024 === 0) throwIfAborted(signal)
    const cell = row[rule.column]
    if (!isMissing(cell)) {
      previous = cell ?? null
      return row
    }
    const replacement = rule.strategy === 'forward' ? previous : fill
    if (replacement === undefined) return row
    filled += 1
    return { ...row, [rule.column]: replacement }
  })
  return {
    table: { columns: table.columns, rows },
    log: { ruleIndex, rule: 'fill-missing', affectedRows: filled, detail: `${detail}; ${filled} row(s) filled` },
  }
}

/** coerce-type: rewrite one column to number / ISO date / boolean; failures become missing and are counted. */
function applyCoerceType(table: Table, rule: Extract<CleanRule, { rule: 'coerce-type' }>, ruleIndex: number, signal?: AbortSignal): { table: Table; log: CleanRuleLog } {
  requireColumn(table.columns, rule.column, ruleIndex)
  let coerced = 0
  let failed = 0
  const failureExamples: string[] = []
  const rows = table.rows.map((row, index) => {
    if (index % 1024 === 0) throwIfAborted(signal)
    const cell = row[rule.column]
    if (isMissing(cell)) return row
    let value: Cell | undefined
    switch (rule.to) {
      case 'number': {
        const numeric = parseNumeric(cell)
        value = numeric === undefined ? undefined : numeric
        break
      }
      case 'date': {
        const epoch = parseDate(cell)
        if (epoch === undefined) {
          value = undefined
        } else {
          const date = new Date(epoch)
          value = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
            ? date.toISOString().slice(0, 10)
            : date.toISOString()
        }
        break
      }
      case 'boolean': {
        const bool = parseBoolean(cell)
        value = bool === undefined ? undefined : String(bool)
        break
      }
    }
    if (value === undefined) {
      failed += 1
      if (failureExamples.length < 3) failureExamples.push(JSON.stringify(cell))
      return { ...row, [rule.column]: null }
    }
    coerced += 1
    return { ...row, [rule.column]: value }
  })
  const detail = `${coerced} value(s) coerced to ${rule.to}` +
    (failed > 0 ? `; ${failed} failure(s) set to missing (e.g. ${failureExamples.join(', ')})` : '')
  return {
    table: { columns: table.columns, rows },
    log: { ruleIndex, rule: 'coerce-type', affectedRows: coerced, detail },
  }
}

/** normalize-unit: strip a unit suffix and multiply by its factor (e.g. 万 -> 1e4). */
function applyNormalizeUnit(table: Table, rule: Extract<CleanRule, { rule: 'normalize-unit' }>, ruleIndex: number, signal?: AbortSignal): { table: Table; log: CleanRuleLog } {
  requireColumn(table.columns, rule.column, ruleIndex)
  const entries = Object.entries(rule.factors)
  if (entries.length === 0) {
    throw new CleanRuleError(ruleIndex, `rule ${ruleIndex}: normalize-unit requires a non-empty factors map`)
  }
  for (const [suffix, factor] of entries) {
    if (suffix === '') throw new CleanRuleError(ruleIndex, `rule ${ruleIndex}: normalize-unit suffixes must not be empty`)
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new CleanRuleError(ruleIndex, `rule ${ruleIndex}: factor for ${JSON.stringify(suffix)} must be a positive finite number, got ${String(factor)}`)
    }
  }
  // Longest suffix first so "亿万" style prefixes cannot shadow longer units.
  const ordered = [...entries].sort((a, b) => b[0].length - a[0].length)
  let normalized = 0
  let skipped = 0
  const rows = table.rows.map((row, index) => {
    if (index % 1024 === 0) throwIfAborted(signal)
    const cell = row[rule.column]
    if (isMissing(cell)) return row
    const plain = parseNumeric(cell)
    if (plain !== undefined) {
      normalized += 1
      return { ...row, [rule.column]: plain }
    }
    if (typeof cell === 'string') {
      const text = cell.trim()
      for (const [suffix, factor] of ordered) {
        if (!text.endsWith(suffix)) continue
        const numeric = parseNumeric(text.slice(0, text.length - suffix.length))
        if (numeric === undefined) continue
        normalized += 1
        return { ...row, [rule.column]: numeric * factor }
      }
    }
    skipped += 1
    return row
  })
  const detail = `${normalized} value(s) normalized to base units` + (skipped > 0 ? `; ${skipped} unparseable value(s) left unchanged` : '')
  return {
    table: { columns: table.columns, rows },
    log: { ruleIndex, rule: 'normalize-unit', affectedRows: normalized, detail },
  }
}

/** trim: strip leading/trailing whitespace of string cells in the selected columns. */
function applyTrim(table: Table, rule: Extract<CleanRule, { rule: 'trim' }>, ruleIndex: number, signal?: AbortSignal): { table: Table; log: CleanRuleLog } {
  const selected = rule.columns ?? table.columns
  requireColumns(table.columns, selected, ruleIndex)
  let trimmed = 0
  const rows = table.rows.map((row, index) => {
    if (index % 1024 === 0) throwIfAborted(signal)
    let changed = false
    const next = { ...row }
    for (const column of selected) {
      const cell = next[column]
      if (typeof cell !== 'string') continue
      const value = cell.trim()
      if (value !== cell) {
        next[column] = value
        changed = true
      }
    }
    if (changed) trimmed += 1
    return changed ? next : row
  })
  return {
    table: { columns: table.columns, rows },
    log: { ruleIndex, rule: 'trim', affectedRows: trimmed, detail: `trimmed whitespace in [${selected.join(', ')}] for ${trimmed} row(s)` },
  }
}

/** map-values: exact-match enum mapping; unmapped values follow the `else` policy. */
function applyMapValues(table: Table, rule: Extract<CleanRule, { rule: 'map-values' }>, ruleIndex: number, signal?: AbortSignal): { table: Table; log: CleanRuleLog } {
  requireColumn(table.columns, rule.column, ruleIndex)
  const elsePolicy = rule.else ?? 'keep'
  let mapped = 0
  let unmapped = 0
  const rows = table.rows.map((row, index) => {
    if (index % 1024 === 0) throwIfAborted(signal)
    const cell = row[rule.column]
    if (isMissing(cell)) return row
    const key = typeof cell === 'string' ? cell : typeof cell === 'object' && cell !== null ? JSON.stringify(cell) : String(cell)
    const replacement = rule.map[key]
    if (replacement !== undefined) {
      mapped += 1
      return { ...row, [rule.column]: replacement }
    }
    if (elsePolicy === 'missing') {
      unmapped += 1
      return { ...row, [rule.column]: null }
    }
    unmapped += 1
    return row
  })
  const detail = `${mapped} value(s) mapped` + (unmapped > 0 ? `; ${unmapped} unmapped value(s) ${elsePolicy === 'missing' ? 'set to missing' : 'kept'}` : '')
  return {
    table: { columns: table.columns, rows },
    log: { ruleIndex, rule: 'map-values', affectedRows: mapped, detail },
  }
}

/**
 * Apply cleaning rules in array order; each rule sees the previous output.
 * @param table - the parsed dataset.
 * @param rules - non-empty rule list.
 * @param options - abort signal.
 * @returns the cleaned table plus the per-rule audit log.
 */
export function applyCleanRules(table: Table, rules: readonly CleanRule[], options: { signal?: AbortSignal | undefined } = {}): CleanResult {
  if (rules.length === 0) {
    throw new CleanRuleError(0, 'rules must be a non-empty array')
  }
  let current: Table = { columns: [...table.columns], rows: table.rows.map((row) => ({ ...row })) }
  const logs: CleanRuleLog[] = []
  for (const [ruleIndex, rule] of rules.entries()) {
    throwIfAborted(options.signal)
    let step: { table: Table; log: CleanRuleLog }
    switch (rule.rule) {
      case 'dedupe':
        step = applyDedupe(current, rule, ruleIndex, options.signal)
        break
      case 'fill-missing':
        step = applyFillMissing(current, rule, ruleIndex, options.signal)
        break
      case 'coerce-type':
        step = applyCoerceType(current, rule, ruleIndex, options.signal)
        break
      case 'normalize-unit':
        step = applyNormalizeUnit(current, rule, ruleIndex, options.signal)
        break
      case 'trim':
        step = applyTrim(current, rule, ruleIndex, options.signal)
        break
      case 'map-values':
        step = applyMapValues(current, rule, ruleIndex, options.signal)
        break
      default:
        throw new CleanRuleError(ruleIndex, `rule ${ruleIndex}: unknown rule type ${JSON.stringify((rule as CleanRule).rule)}`)
    }
    current = step.table
    logs.push(step.log)
  }
  return {
    columns: current.columns,
    rows: current.rows,
    logs,
    inputRows: table.rows.length,
    outputRows: current.rows.length,
  }
}

/**
 * Serialize a table back to CSV/TSV text with RFC-4180 quoting (used when a
 * clean run writes an output file). Numbers and booleans render via `String`;
 * missing cells render empty.
 * @param columns - column order.
 * @param rows - rows to serialize.
 * @param delimiter - field delimiter.
 * @returns the file text (LF newlines, trailing newline).
 */
export function serializeDelimited(columns: readonly string[], rows: readonly Row[], delimiter: string): string {
  const encode = (cell: Cell | undefined): string => {
    if (isMissing(cell)) return ''
    const text = typeof cell === 'string' ? cell : typeof cell === 'object' && cell !== null ? JSON.stringify(cell) : String(cell)
    if (text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r')) {
      return `"${text.replace(/"/gu, '""')}"`
    }
    return text
  }
  const lines = [columns.map((column) => encode(column)).join(delimiter)]
  for (const row of rows) {
    lines.push(columns.map((column) => encode(row[column])).join(delimiter))
  }
  return `${lines.join('\n')}\n`
}

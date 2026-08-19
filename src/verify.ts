/**
 * Declarative verification rules over a parsed {@link Table} (not-null,
 * unique, range, regex, enum, cross-column, freshness) plus the frozen
 * citation-checking semantics for `ctx.dataQuality.verifyCitations`. Pure and
 * deterministic: the freshness clock is injected, numeric comparison never
 * uses raw `===`, and evidence rows are capped by config.
 * @module dsh-data-quality/verify
 */

import { isMissing, parseDate, parseNumeric, throwIfAborted, type Cell, type DocumentRoot, type Row, type Table } from './dataset.ts'
import type { CitationCheckRequest, CitationCheckResult } from './service.ts'

/** One declarative verification rule (discriminated on `rule`). */
export type VerifyRule =
  | { readonly rule: 'not-null'; readonly column: string }
  | { readonly rule: 'unique'; readonly columns: readonly string[] }
  | { readonly rule: 'range'; readonly column: string; readonly min?: number; readonly max?: number }
  | { readonly rule: 'regex'; readonly column: string; readonly pattern: string; readonly flags?: string }
  | { readonly rule: 'enum'; readonly column: string; readonly values: readonly string[] }
  | {
      readonly rule: 'cross-column'
      readonly left: string
      readonly op: '<' | '<=' | '==' | '!=' | '>=' | '>'
      readonly rightColumn?: string
      readonly value?: number | string
    }
  | { readonly rule: 'freshness'; readonly column: string; readonly maxAgeDays: number; readonly asOf?: string }

/** Raised for invalid rules; `message` names the rule index and reason. */
export class VerifyRuleError extends Error {
  /**
   * @param ruleIndex - index of the offending rule in the request array.
   * @param message - actionable human-readable detail.
   */
  constructor(
    readonly ruleIndex: number,
    message: string,
  ) {
    super(message)
    this.name = 'VerifyRuleError'
  }
}

/** One failing row's evidence (capped per rule by `evidenceRowLimit`). */
export interface VerifyEvidenceRow {
  /** 0-based data row index. */
  readonly rowIndex: number
  /** Only the columns the rule inspected. */
  readonly values: Record<string, Cell>
}

/** One rule's outcome. */
export interface VerifyRuleResult {
  readonly ruleIndex: number
  readonly rule: VerifyRule['rule']
  readonly passed: boolean
  /** Rows the predicate rejected. */
  readonly failedCount: number
  /** Rows the predicate ran over. */
  readonly checkedCount: number
  /** First `evidenceRowLimit` failing rows. */
  readonly evidence: VerifyEvidenceRow[]
}

/** The full verify report (also the persisted and tool-returned value). */
export interface VerifyReport {
  readonly dataset: string
  readonly passed: boolean
  readonly rowCount: number
  readonly rules: VerifyRuleResult[]
  /** Storage-domain key of the persisted report, when persistence is on (set by the provider). */
  readonly reportKey?: string
  /** Injected generation timestamp (epoch ms). */
  readonly generatedAt: number
}

/** Assert `column` exists. */
function requireColumn(columns: readonly string[], column: string, ruleIndex: number): void {
  if (!columns.includes(column)) {
    throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: unknown column ${JSON.stringify(column)} (columns: ${columns.join(', ')})`)
  }
}

/** The trimmed string form used for regex/enum/cross-column string comparison. */
function textOf(cell: Cell | undefined): string {
  if (typeof cell === 'string') return cell.trim()
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'object') return JSON.stringify(cell)
  return String(cell)
}

/** Run one per-row predicate and collect capped evidence. */
function evaluate(
  table: Table,
  ruleIndex: number,
  ruleName: VerifyRule['rule'],
  columns: readonly string[],
  predicate: (row: Row) => boolean,
  evidenceRowLimit: number,
  signal?: AbortSignal,
): VerifyRuleResult {
  let failedCount = 0
  const evidence: VerifyEvidenceRow[] = []
  for (const [rowIndex, row] of table.rows.entries()) {
    if (rowIndex % 1024 === 0) throwIfAborted(signal)
    if (predicate(row)) continue
    failedCount += 1
    if (evidence.length < evidenceRowLimit) {
      const values: Record<string, Cell> = {}
      for (const column of columns) values[column] = row[column] ?? null
      evidence.push({ rowIndex, values })
    }
  }
  return {
    ruleIndex,
    rule: ruleName,
    passed: failedCount === 0,
    failedCount,
    checkedCount: table.rows.length,
    evidence,
  }
}

const CROSS_OPS = ['<', '<=', '==', '!=', '>=', '>'] as const

/**
 * Apply verification rules over a parsed table. A missing cell fails every
 * rule that reads it. The overall `passed` is the conjunction of rule passes;
 * a failing dataset is a normal result, never a thrown error.
 * @param table - the parsed dataset.
 * @param rules - non-empty rule list.
 * @param options - evidence cap, injected clock for `freshness`, abort signal.
 * @returns the verify report (without the dataset label; the caller adds it).
 */
export function verifyTable(
  table: Table,
  rules: readonly VerifyRule[],
  options: { evidenceRowLimit: number; now: () => number; signal?: AbortSignal | undefined },
): Omit<VerifyReport, 'dataset'> {
  if (rules.length === 0) {
    throw new VerifyRuleError(0, 'rules must be a non-empty array')
  }
  const results: VerifyRuleResult[] = []
  for (const [ruleIndex, rule] of rules.entries()) {
    throwIfAborted(options.signal)
    let result: VerifyRuleResult
    switch (rule.rule) {
      case 'not-null': {
        requireColumn(table.columns, rule.column, ruleIndex)
        result = evaluate(table, ruleIndex, rule.rule, [rule.column], (row) => !isMissing(row[rule.column]), options.evidenceRowLimit, options.signal)
        break
      }
      case 'unique': {
        if (rule.columns.length === 0) {
          throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: unique requires at least one column`)
        }
        for (const column of rule.columns) requireColumn(table.columns, column, ruleIndex)
        const counts = new Map<string, number>()
        for (const row of table.rows) {
          const key = JSON.stringify(rule.columns.map((column) => row[column] ?? null))
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        result = evaluate(
          table,
          ruleIndex,
          rule.rule,
          rule.columns,
          (row) => (counts.get(JSON.stringify(rule.columns.map((column) => row[column] ?? null))) ?? 0) === 1,
          options.evidenceRowLimit,
          options.signal,
        )
        break
      }
      case 'range': {
        requireColumn(table.columns, rule.column, ruleIndex)
        if (rule.min === undefined && rule.max === undefined) {
          throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: range requires at least one of min/max`)
        }
        result = evaluate(
          table,
          ruleIndex,
          rule.rule,
          [rule.column],
          (row) => {
            const value = parseNumeric(row[rule.column])
            if (value === undefined) return false
            if (rule.min !== undefined && value < rule.min) return false
            if (rule.max !== undefined && value > rule.max) return false
            return true
          },
          options.evidenceRowLimit,
          options.signal,
        )
        break
      }
      case 'regex': {
        requireColumn(table.columns, rule.column, ruleIndex)
        let pattern: RegExp
        try {
          pattern = new RegExp(rule.pattern, rule.flags ?? '')
        } catch (error) {
          throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: invalid regex ${JSON.stringify(rule.pattern)}: ${error instanceof Error ? error.message : String(error)}`)
        }
        result = evaluate(
          table,
          ruleIndex,
          rule.rule,
          [rule.column],
          (row) => {
            const cell = row[rule.column]
            if (isMissing(cell)) return false
            pattern.lastIndex = 0
            return pattern.test(textOf(cell))
          },
          options.evidenceRowLimit,
          options.signal,
        )
        break
      }
      case 'enum': {
        requireColumn(table.columns, rule.column, ruleIndex)
        if (rule.values.length === 0) {
          throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: enum requires a non-empty values array`)
        }
        const allowed = new Set(rule.values)
        result = evaluate(
          table,
          ruleIndex,
          rule.rule,
          [rule.column],
          (row) => {
            const cell = row[rule.column]
            if (isMissing(cell)) return false
            return allowed.has(textOf(cell))
          },
          options.evidenceRowLimit,
          options.signal,
        )
        break
      }
      case 'cross-column': {
        requireColumn(table.columns, rule.left, ruleIndex)
        if (!CROSS_OPS.includes(rule.op)) {
          throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: unsupported op ${JSON.stringify(rule.op)}`)
        }
        const hasColumn = rule.rightColumn !== undefined
        const hasValue = rule.value !== undefined
        if (hasColumn === hasValue) {
          throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: cross-column needs exactly one of rightColumn/value`)
        }
        if (hasColumn) requireColumn(table.columns, rule.rightColumn as string, ruleIndex)
        const columns = hasColumn ? [rule.left, rule.rightColumn as string] : [rule.left]
        result = evaluate(
          table,
          ruleIndex,
          rule.rule,
          columns,
          (row) => {
            const left = row[rule.left]
            const right = hasColumn ? row[rule.rightColumn as string] : (rule.value as number | string)
            if (isMissing(left) || isMissing(right)) return false
            const leftNum = parseNumeric(left)
            const rightNum = parseNumeric(right)
            if (leftNum !== undefined && rightNum !== undefined) {
              switch (rule.op) {
                case '<': return leftNum < rightNum
                case '<=': return leftNum <= rightNum
                case '>': return leftNum > rightNum
                case '>=': return leftNum >= rightNum
                case '==': return Math.abs(leftNum - rightNum) <= 1e-12 * Math.max(Math.abs(leftNum), Math.abs(rightNum), 1)
                case '!=': return Math.abs(leftNum - rightNum) > 1e-12 * Math.max(Math.abs(leftNum), Math.abs(rightNum), 1)
              }
            }
            // Date fallback: both sides date-parseable compares epochs (the startDate < endDate case).
            const leftDate = parseDate(left)
            const rightDate = parseDate(right)
            if (leftDate !== undefined && rightDate !== undefined) {
              switch (rule.op) {
                case '<': return leftDate < rightDate
                case '<=': return leftDate <= rightDate
                case '>': return leftDate > rightDate
                case '>=': return leftDate >= rightDate
                case '==': return leftDate === rightDate
                case '!=': return leftDate !== rightDate
              }
            }
            // String fallback: only equality operators are defined.
            const leftText = textOf(left)
            const rightText = textOf(right)
            if (rule.op === '==') return leftText === rightText
            if (rule.op === '!=') return leftText !== rightText
            return false
          },
          options.evidenceRowLimit,
          options.signal,
        )
        break
      }
      case 'freshness': {
        requireColumn(table.columns, rule.column, ruleIndex)
        if (!Number.isFinite(rule.maxAgeDays) || rule.maxAgeDays <= 0) {
          throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: freshness maxAgeDays must be a positive number, got ${String(rule.maxAgeDays)}`)
        }
        let asOf: number
        if (rule.asOf !== undefined) {
          const parsed = parseDate(rule.asOf)
          if (parsed === undefined) {
            throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: freshness asOf is not a recognized date: ${JSON.stringify(rule.asOf)}`)
          }
          asOf = parsed
        } else {
          asOf = options.now()
        }
        const maxAgeMs = rule.maxAgeDays * 86_400_000
        result = evaluate(
          table,
          ruleIndex,
          rule.rule,
          [rule.column],
          (row) => {
            const epoch = parseDate(row[rule.column])
            if (epoch === undefined) return false
            return asOf - epoch <= maxAgeMs
          },
          options.evidenceRowLimit,
          options.signal,
        )
        break
      }
      default:
        throw new VerifyRuleError(ruleIndex, `rule ${ruleIndex}: unknown rule type ${JSON.stringify((rule as VerifyRule).rule)}`)
    }
    results.push(result)
  }
  return {
    passed: results.every((result) => result.passed),
    rowCount: table.rows.length,
    rules: results,
    generatedAt: options.now(),
  }
}

/** Human-readable verify summary for the tool's Native render. */
export function renderVerifyText(report: VerifyReport): string {
  const lines: string[] = []
  lines.push(`Verification of ${report.dataset}: ${report.passed ? 'PASSED' : 'FAILED'} (${report.rowCount} rows, ${report.rules.length} rules)`)
  for (const rule of report.rules) {
    lines.push(`- [${rule.passed ? 'pass' : 'FAIL'}] rule ${rule.ruleIndex} (${rule.rule}): ${rule.failedCount}/${rule.checkedCount} row(s) failed`)
    for (const row of rule.evidence) {
      const cells = Object.entries(row.values).map(([column, value]) => `${column}=${JSON.stringify(value)}`).join(', ')
      lines.push(`    row ${row.rowIndex}: ${cells}`)
    }
    if (rule.failedCount > rule.evidence.length) {
      lines.push(`    … and ${rule.failedCount - rule.evidence.length} more failing row(s)`)
    }
  }
  return lines.join('\n')
}

/** One parsed locator segment: an object key plus optional array indices. */
interface LocatorSegment {
  readonly key: string | undefined
  readonly indices: readonly number[]
}

/**
 * Parse a JSON-path-ish locator (`rows[3].nav`, `summary.annualReturn`,
 * `[0].value`) into walk segments. Throws on unparsable input.
 * @param locator - the citation's path string.
 * @returns ordered walk segments.
 */
export function parseLocator(locator: string): LocatorSegment[] {
  if (locator.trim() === '') throw new Error('citation path must not be empty')
  const segments: LocatorSegment[] = []
  for (const part of locator.split('.')) {
    const match = /^([A-Za-z0-9_$-]*)((?:\[\d+\])*)$/u.exec(part)
    if (match === null || (match[1] === '' && match[2] === '')) {
      throw new Error(`unparsable citation path segment ${JSON.stringify(part)} in ${JSON.stringify(locator)}`)
    }
    const indices = [...(match[2] ?? '').matchAll(/\[(\d+)\]/gu)].map((index) => Number(index[1]))
    segments.push({ key: match[1] === '' ? undefined : match[1], indices })
  }
  return segments
}

/** Sentinel for a failed locator walk (distinguishable from an actual `undefined` value). */
const NOT_FOUND = Symbol('not-found')

/** Walk the document root along the parsed locator; returns {@link NOT_FOUND} when any step misses. */
function walkLocator(root: DocumentRoot, segments: readonly LocatorSegment[]): unknown {
  let current: unknown = root.kind === 'table' ? { columns: root.columns, rows: root.rows } : root.value
  for (const segment of segments) {
    if (segment.key !== undefined) {
      if (typeof current !== 'object' || current === null || Array.isArray(current)) return NOT_FOUND
      if (!Object.prototype.hasOwnProperty.call(current, segment.key)) return NOT_FOUND
      current = (current as Record<string, unknown>)[segment.key]
    }
    for (const index of segment.indices) {
      if (!Array.isArray(current) || index >= current.length) return NOT_FOUND
      current = current[index]
    }
  }
  return current
}

/** Relative-tolerance numeric comparison (never raw `===` on floats). */
function numericClose(actual: number, cited: number, tolerance: number): boolean {
  return Math.abs(actual - cited) <= tolerance * Math.max(Math.abs(actual), Math.abs(cited), Number.MIN_VALUE)
}

/** Display form of a located value for evidence notes (`undefined` when it cannot be rendered). */
function displayActual(located: unknown): string | undefined {
  if (typeof located === 'string') return located
  if (typeof located === 'number' || typeof located === 'boolean') return String(located)
  if (located === null) return 'null'
  const rendered = JSON.stringify(located)
  return typeof rendered === 'string' ? rendered : undefined
}

/**
 * The frozen citation-checking semantics: locate each citation's `path` in the
 * dataset document, then compare. Numbers compare with relative `tolerance`
 * (falling back to `defaultTolerance`); strings compare exactly. A missing
 * location is `not-found`; an incomparable actual/cited type pair is
 * `unverifiable`.
 * @param root - the loaded dataset document.
 * @param citations - citations to check.
 * @param defaultTolerance - configured fallback relative tolerance.
 * @returns one result per citation, ids echoed.
 */
export function checkCitations(
  root: DocumentRoot,
  citations: CitationCheckRequest['citations'],
  defaultTolerance: number,
): CitationCheckResult {
  const results: CitationCheckResult['results'] = []
  for (const citation of citations) {
    let located: unknown
    try {
      located = walkLocator(root, parseLocator(citation.path))
    } catch (error) {
      results.push({
        id: citation.id,
        status: 'not-found',
        note: `path ${JSON.stringify(citation.path)} is not a valid locator: ${error instanceof Error ? error.message : String(error)}`,
      })
      continue
    }
    if (located === NOT_FOUND) {
      results.push({ id: citation.id, status: 'not-found', note: `nothing found at ${JSON.stringify(citation.path)}` })
      continue
    }
    if (typeof citation.value === 'number') {
      const actualNumber = typeof located === 'number' ? located : parseNumeric(located as Cell)
      if (actualNumber === undefined) {
        const display = displayActual(located)
        results.push({
          id: citation.id,
          status: 'unverifiable',
          ...(display !== undefined ? { actual: display } : {}),
          note: `value at ${JSON.stringify(citation.path)} is not numeric and cannot be compared to ${citation.value}`,
        })
        continue
      }
      const tolerance = citation.tolerance ?? defaultTolerance
      if (numericClose(actualNumber, citation.value, tolerance)) {
        results.push({ id: citation.id, status: 'verified', actual: actualNumber, note: `within relative tolerance ${tolerance}` })
      } else {
        results.push({
          id: citation.id,
          status: 'mismatch',
          actual: actualNumber,
          note: `cited ${citation.value} differs from actual ${actualNumber} beyond relative tolerance ${tolerance}`,
        })
      }
      continue
    }
    // Cited a string: exact comparison against a string actual only.
    if (typeof located === 'string') {
      if (located === citation.value) {
        results.push({ id: citation.id, status: 'verified', actual: located })
      } else {
        results.push({ id: citation.id, status: 'mismatch', actual: located, note: `cited ${JSON.stringify(citation.value)} != actual ${JSON.stringify(located)}` })
      }
      continue
    }
    const display = displayActual(located)
    results.push({
      id: citation.id,
      status: 'unverifiable',
      ...(display !== undefined ? { actual: display } : {}),
      note: `value at ${JSON.stringify(citation.path)} is ${typeof located}, not comparable to cited string`,
    })
  }
  return { results }
}

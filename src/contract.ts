/**
 * Delivery contract for `data_clean`: a deterministic pre-delivery validation
 * summary (primary-key/type/dedupe row-count comparison plus uniqueness and
 * non-null regression) and the clean before/after profile diff report. Pure —
 * no I/O, no clock, no RNG; timestamps are injected.
 * @module dsh-data-quality/contract
 */

import { isMissing, parseBoolean, parseDate, parseNumeric, throwIfAborted, type Row, type Table } from './dataset.ts'
import type { CleanResult, CleanRule } from './clean.ts'
import { profileTable, type ProfileReport } from './profile.ts'
import type { ScorecardDimensionName } from './scorecard.ts'

/** The pre-delivery contract summary attached to a clean run. */
export interface CleanContractSummary {
  /** Row count before cleaning. */
  readonly inputRows: number
  /** Row count after cleaning. */
  readonly outputRows: number
  /** Rows removed across all rules. */
  readonly removedRows: number
  /** Key columns of the first `dedupe` rule; `null` when no dedupe rule ran (uniqueness then covers full rows). */
  readonly dedupeColumns: string[] | null
  /** Whether the uniqueness key is free of duplicates in the cleaned output. */
  readonly uniqueKeys: boolean
  /** Remaining duplicate rows over the uniqueness key in the cleaned output. */
  readonly remainingDuplicateRows: number
  /** Non-null regression: remaining missing cells in columns a `fill-missing` rule targeted. */
  readonly remainingMissing: Array<{ readonly column: string; readonly count: number }>
  /** Type regression: remaining non-conforming cells in columns a `coerce-type` rule targeted. */
  readonly typeConformance: Array<{ readonly column: string; readonly to: 'number' | 'date' | 'boolean'; readonly invalidCount: number }>
  /** Per-column decision trace: which strategies touched each column and how many rows they affected. */
  readonly columnDecisions: Array<{
    readonly column: string
    readonly decisions: Array<{ readonly strategy: string; readonly affectedRows: number }>
  }>
}

/** The clean before/after profile diff report (persisted under the `clean-diff` report kind). */
export interface CleanProfileDiff {
  readonly dataset: string
  /** Full profile of the input dataset. */
  readonly before: ProfileReport
  /** Full profile of the cleaned output (including its scorecard). */
  readonly after: ProfileReport
  readonly generatedAt: number
}

/** Count missing cells in one column of the cleaned output. */
function countMissing(rows: readonly Row[], column: string, signal?: AbortSignal): number {
  let count = 0
  for (const [index, row] of rows.entries()) {
    if (index % 1024 === 0) throwIfAborted(signal)
    if (isMissing(row[column])) count += 1
  }
  return count
}

/** Count present cells in one column that still fail to parse as the requested type. */
function countNonConforming(rows: readonly Row[], column: string, to: 'number' | 'date' | 'boolean', signal?: AbortSignal): number {
  let count = 0
  for (const [index, row] of rows.entries()) {
    if (index % 1024 === 0) throwIfAborted(signal)
    const cell = row[column]
    if (isMissing(cell)) continue
    const conforms = to === 'number' ? parseNumeric(cell) !== undefined : to === 'date' ? parseDate(cell) !== undefined : parseBoolean(cell) !== undefined
    if (!conforms) count += 1
  }
  return count
}

/**
 * Compute the pre-delivery contract summary from a cleaning run: dedupe
 * before/after row counts, the dedupe key's uniqueness regression, and the
 * non-null/type regressions over the columns the rules targeted.
 * @param result - the cleaning outcome (input/output rows plus cleaned rows).
 * @param rules - the ordered rules that produced `result`.
 * @param options - optional abort signal.
 * @returns the contract summary.
 */
export function computeCleanContract(
  result: CleanResult,
  rules: readonly CleanRule[],
  options: { signal?: AbortSignal | undefined } = {},
): CleanContractSummary {
  const dedupeRule = rules.find((rule) => rule.rule === 'dedupe') as Extract<CleanRule, { rule: 'dedupe' }> | undefined
  const dedupeColumns = dedupeRule === undefined ? null : [...(dedupeRule.columns ?? result.columns)]
  const keyColumns = dedupeColumns ?? result.columns
  const seen = new Set<string>()
  let remainingDuplicateRows = 0
  for (const [index, row] of result.rows.entries()) {
    if (index % 1024 === 0) throwIfAborted(options.signal)
    const key = JSON.stringify(keyColumns.map((column) => row[column] ?? null))
    if (seen.has(key)) {
      remainingDuplicateRows += 1
    } else {
      seen.add(key)
    }
  }
  const remainingMissing = rules
    .filter((rule) => rule.rule === 'fill-missing')
    .map((rule) => {
      const fill = rule as Extract<CleanRule, { rule: 'fill-missing' }>
      return { column: fill.column, count: countMissing(result.rows, fill.column, options.signal) }
    })
  const typeConformance = rules
    .filter((rule) => rule.rule === 'coerce-type')
    .map((rule) => {
      const coerce = rule as Extract<CleanRule, { rule: 'coerce-type' }>
      return { column: coerce.column, to: coerce.to, invalidCount: countNonConforming(result.rows, coerce.column, coerce.to, options.signal) }
    })
  const columnDecisions = traceColumnDecisions(result, rules)
  return {
    inputRows: result.inputRows,
    outputRows: result.outputRows,
    removedRows: result.inputRows - result.outputRows,
    dedupeColumns,
    uniqueKeys: remainingDuplicateRows === 0,
    remainingDuplicateRows,
    remainingMissing,
    typeConformance,
    columnDecisions,
  }
}

/** The columns a single rule targets (single-column rules target one column; trim/dedupe may target many). */
function ruleColumns(rule: CleanRule, allColumns: readonly string[]): string[] {
  switch (rule.rule) {
    case 'fill-missing':
    case 'coerce-type':
    case 'normalize-unit':
    case 'map-values':
      return [rule.column]
    case 'trim':
    case 'dedupe':
      return [...(rule.columns ?? allColumns)]
    default:
      return []
  }
}

/** Build the per-column decision trace: strategies + affected rows, in dataset column order. */
function traceColumnDecisions(
  result: CleanResult,
  rules: readonly CleanRule[],
): CleanContractSummary['columnDecisions'] {
  const byColumn = new Map<string, Array<{ strategy: string; affectedRows: number }>>()
  for (const [index, rule] of rules.entries()) {
    const log = result.logs[index]
    if (log === undefined) continue
    for (const column of ruleColumns(rule, result.columns)) {
      const list = byColumn.get(column) ?? []
      list.push({ strategy: rule.rule, affectedRows: log.affectedRows })
      byColumn.set(column, list)
    }
  }
  return result.columns
    .filter((column) => byColumn.has(column))
    .map((column) => ({ column, decisions: byColumn.get(column) as Array<{ strategy: string; affectedRows: number }> }))
}

/**
 * Build the clean before/after profile diff: two full {@link ProfileReport}
 * snapshots (input and cleaned output) under one envelope. Reuses the profile
 * engine so the scorecard and duplicate detection stay consistent across the
 * whole plugin.
 * @param input - the input dataset.
 * @param output - the cleaned dataset.
 * @param options - dataset label, injected timestamp, optional weights, optional abort signal.
 * @returns the diff report.
 */
export function computeCleanProfileDiff(
  input: Table,
  output: Table,
  options: { dataset: string; generatedAt: number; scorecardWeights?: Readonly<Record<ScorecardDimensionName, number>> | undefined; signal?: AbortSignal | undefined },
): CleanProfileDiff {
  const before = profileTable(input, {
    dataset: options.dataset,
    generatedAt: options.generatedAt,
    scorecardWeights: options.scorecardWeights,
    signal: options.signal,
  })
  const after = profileTable(output, {
    dataset: options.dataset,
    generatedAt: options.generatedAt,
    scorecardWeights: options.scorecardWeights,
    signal: options.signal,
  })
  return { dataset: options.dataset, before, after, generatedAt: options.generatedAt }
}

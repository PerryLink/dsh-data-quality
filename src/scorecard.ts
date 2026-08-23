/**
 * DAMA-style six-dimension quality scorecard over a parsed {@link Table}.
 * Pure and deterministic: every rate derives from one full-table pass, the
 * only clock is the injected `now`, and no dimension fabricates a score it
 * cannot defend — `accuracy` stays `null` (undetermined) without a declared
 * schema and `timeliness` stays `null` without date cells.
 * @module dsh-data-quality/scorecard
 */

import { isMissing, parseBoolean, parseDateCell, parseNumeric, throwIfAborted, type Table } from './dataset.ts'
import type { InferredType } from './profile.ts'

/** The six scorecard dimension ids, in report order. */
export type ScorecardDimensionName = 'completeness' | 'uniqueness' | 'validity' | 'consistency' | 'timeliness' | 'accuracy'

/** One scorecard dimension: a 0..1 rate, or `null` when it cannot be determined. */
export interface ScorecardDimension {
  readonly name: ScorecardDimensionName
  /** Rate in [0, 1] rounded to 6 significant digits; `null` = cannot be determined (never fabricated). */
  readonly score: number | null
  /** Human-readable definition and verdict. */
  readonly note: string
}

/** The six-dimension quality scorecard (also the profile report's `scorecard` field). */
export interface DataQualityScorecard {
  readonly dimensions: ScorecardDimension[]
  /** Unweighted mean of the determinable (non-null) dimension scores; `null` when none are determinable. */
  readonly overall: number | null
  /** Weighted mean over the determinable dimensions; `null` when none are determinable or all their weights are 0. */
  readonly weightedOverall: number | null
}

/** Per-column aggregation for one full-table pass. */
interface ColumnStats {
  present: number
  number: number
  date: number
  boolean: number
  string: number
  /** Format-label frequency for consistency. */
  formats: Map<string, number>
}

/** Round to 6 significant digits (mirrors the profile report's rounding). */
function round6(value: number): number {
  return Number(value.toPrecision(6))
}

/** Increment a format-label counter. */
function bump(formats: Map<string, number>, tag: string): void {
  formats.set(tag, (formats.get(tag) ?? 0) + 1)
}

/** Inferred column type from the full-table class counts (mirrors `profileColumn`). */
function inferType(stats: ColumnStats): InferredType {
  if (stats.present === 0) return 'empty'
  if (stats.number === stats.present) return 'number'
  if (stats.date === stats.present) return 'date'
  if (stats.boolean === stats.present) return 'boolean'
  if (stats.string === stats.present) return 'string'
  return 'mixed'
}

/** Format the `value / total` ratio as a plain `note` fragment. */
function ratioNote(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`
}

/** Build one determinable dimension with its ratio note. */
function dimension(name: ScorecardDimensionName, score: number, numerator: number, denominator: number): ScorecardDimension {
  return { name, score, note: ratioNote(numerator, denominator) }
}

/**
 * Compute the six-dimension scorecard over a full table:
 * - `completeness` — non-empty cell rate.
 * - `uniqueness` — unique full-row content rate (`1 - duplicateRows / rowCount`).
 * - `validity` — present cells conforming to their column's inferred type.
 * - `consistency` — present cells in their column's dominant format (a date
 *   column's unified `YYYY-MM-DD` vs `YYYY/MM/DD` vs datetime ratio).
 * - `timeliness` — date cells not future-dated relative to the injected `now`.
 * - `accuracy` — declared-schema agreement (limited definition); `null`
 *   (undetermined) without a declared schema — never fabricated.
 * @param table - the parsed dataset (full table, not the sampled cards).
 * @param options - injected clock, duplicate-row count, optional declared schema, optional weights, abort signal.
 * @returns the scorecard.
 */
export function computeScorecard(
  table: Table,
  options: {
    now: number
    duplicateRows: number
    declaredSchema?: Readonly<Record<string, InferredType>> | undefined
    weights?: Readonly<Record<ScorecardDimensionName, number>> | undefined
    signal?: AbortSignal | undefined
  },
): DataQualityScorecard {
  throwIfAborted(options.signal)
  const stats = new Map<string, ColumnStats>()
  for (const column of table.columns) {
    stats.set(column, { present: 0, number: 0, date: 0, boolean: 0, string: 0, formats: new Map() })
  }
  let missingCells = 0
  let dateCells = 0
  let futureDateCells = 0

  for (const [index, row] of table.rows.entries()) {
    if (index % 1024 === 0) throwIfAborted(options.signal)
    for (const column of table.columns) {
      const cell = row[column]
      const columnStats = stats.get(column) as ColumnStats
      if (isMissing(cell)) {
        missingCells += 1
        continue
      }
      columnStats.present += 1
      const numeric = parseNumeric(cell)
      if (numeric !== undefined) {
        columnStats.number += 1
        bump(columnStats.formats, 'number')
        continue
      }
      const date = parseDateCell(cell)
      if (date !== undefined) {
        columnStats.date += 1
        bump(columnStats.formats, date.format)
        dateCells += 1
        if (date.epoch > options.now) futureDateCells += 1
        continue
      }
      if (parseBoolean(cell) !== undefined) {
        columnStats.boolean += 1
        bump(columnStats.formats, 'boolean')
        continue
      }
      columnStats.string += 1
      bump(columnStats.formats, typeof cell === 'string' ? 'string' : 'json')
    }
  }

  const totalCells = table.rows.length * table.columns.length
  let presentCells = 0
  let invalidCells = 0
  let consistentCells = 0
  for (const [, columnStats] of stats) {
    presentCells += columnStats.present
    // Validity = conformance to the column's dominant TYPE class; consistency
    // below measures dominant FORMAT (so a date column with mixed YYYY-MM-DD /
    // YYYY/MM/DD formats stays valid but inconsistent).
    const dominantClass = Math.max(columnStats.number, columnStats.date, columnStats.boolean, columnStats.string)
    invalidCells += columnStats.present - dominantClass
    if (columnStats.present === 0) continue
    let dominant = 0
    for (const count of columnStats.formats.values()) {
      if (count > dominant) dominant = count
    }
    consistentCells += dominant
  }

  const completeness: ScorecardDimension =
    totalCells === 0
      ? { name: 'completeness', score: null, note: 'undetermined: no cells' }
      : dimension('completeness', round6(1 - missingCells / totalCells), presentCells, totalCells)

  const uniqueness: ScorecardDimension =
    table.rows.length === 0
      ? { name: 'uniqueness', score: null, note: 'undetermined: no rows' }
      : dimension('uniqueness', round6(1 - options.duplicateRows / table.rows.length), table.rows.length - options.duplicateRows, table.rows.length)

  const validity: ScorecardDimension =
    presentCells === 0
      ? { name: 'validity', score: null, note: 'undetermined: no present cells' }
      : dimension('validity', round6(1 - invalidCells / presentCells), presentCells - invalidCells, presentCells)

  const consistency: ScorecardDimension =
    presentCells === 0
      ? { name: 'consistency', score: null, note: 'undetermined: no present cells' }
      : dimension('consistency', round6(consistentCells / presentCells), consistentCells, presentCells)

  const timeliness: ScorecardDimension =
    dateCells === 0
      ? { name: 'timeliness', score: null, note: 'undetermined: no date cells' }
      : dimension('timeliness', round6(1 - futureDateCells / dateCells), dateCells - futureDateCells, dateCells)

  const accuracy = computeAccuracy(stats, table, options.declaredSchema)

  const dimensions = [completeness, uniqueness, validity, consistency, timeliness, accuracy]
  const scores = dimensions.map((entry) => entry.score).filter((score): score is number => score !== null)
  const overall = scores.length === 0 ? null : round6(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  const weightedOverall = computeWeightedOverall(dimensions, options.weights)
  return { dimensions, overall, weightedOverall }
}

/** Weighted mean over determinable dimensions (weights default to 1; validated non-negative by config). */
function computeWeightedOverall(
  dimensions: readonly ScorecardDimension[],
  weights: Readonly<Record<ScorecardDimensionName, number>> | undefined,
): number | null {
  let weightedSum = 0
  let weightTotal = 0
  for (const entry of dimensions) {
    if (entry.score === null) continue
    const weight = weights?.[entry.name] ?? 1
    weightedSum += weight * entry.score
    weightTotal += weight
  }
  return weightTotal === 0 ? null : round6(weightedSum / weightTotal)
}

/**
 * Limited `accuracy` definition: agreement between the full-table inferred
 * type of each declared column and the declared type. Without a declared
 * schema (or an external truth source) the dimension is `null` (undetermined)
 * — accuracy is never fabricated.
 */
function computeAccuracy(
  stats: ReadonlyMap<string, ColumnStats>,
  table: Table,
  declaredSchema: Readonly<Record<string, InferredType>> | undefined,
): ScorecardDimension {
  if (declaredSchema === undefined || Object.keys(declaredSchema).length === 0) {
    return { name: 'accuracy', score: null, note: 'undetermined: no declared schema or external truth to compare against; accuracy is never fabricated' }
  }
  let checked = 0
  let matched = 0
  const mismatches: string[] = []
  for (const column of table.columns) {
    const declared = declaredSchema[column]
    if (declared === undefined) continue
    checked += 1
    const inferred = inferType(stats.get(column) as ColumnStats)
    if (inferred === declared) matched += 1
    else mismatches.push(`${column}: declared ${declared}, inferred ${inferred}`)
  }
  if (checked === 0) {
    return { name: 'accuracy', score: null, note: 'undetermined: declared schema covers none of the dataset columns' }
  }
  return {
    name: 'accuracy',
    score: round6(matched / checked),
    note: `${matched}/${checked} columns match their declared type` + (mismatches.length > 0 ? `; mismatches: ${mismatches.join(', ')}` : ''),
  }
}

/**
 * Deterministic dataset profiling: per-column type inference, missingness,
 * cardinality, numeric distribution, IQR outlier counts, and duplicate-row
 * detection. Pure functions over a parsed {@link Table} — no clock, no RNG,
 * no I/O; `generatedAt` is injected by the caller.
 * @module dsh-data-quality/profile
 */

import { createHash } from 'node:crypto'
import { isMissing, parseBoolean, parseDate, parseNumeric, sampleRows, throwIfAborted, type EncodingInfo, type Row, type Table } from './dataset.ts'
import { computeScorecard, type DataQualityScorecard, type ScorecardDimensionName } from './scorecard.ts'
import { REPORT_SCHEMA_VERSION } from './version.ts'

/** Inferred column type from parsed cell classes. */
export type InferredType = 'number' | 'date' | 'boolean' | 'string' | 'empty' | 'mixed'

/** Numeric distribution of one numeric column. */
export interface NumericProfile {
  /** Number of numeric values the distribution covers. */
  readonly count: number
  /** Distinct numeric values among the profiled rows. */
  readonly distinct: number
  readonly min: number
  readonly max: number
  readonly mean: number
  readonly median: number
  readonly p25: number
  readonly p75: number
  /** Values outside `[p25 - 1.5*IQR, p75 + 1.5*IQR]`. */
  readonly outliers: number
}

/** One column's profile card. */
export interface ColumnProfile {
  readonly name: string
  readonly inferredType: InferredType
  /** Missing cells over the profiled rows. */
  readonly missing: number
  /** `missing / profiledRows` (0 when the column has no rows). */
  readonly missingRate: number
  /** Distinct non-missing values over the profiled rows. */
  readonly unique: number
  /** Numeric distribution; present only for `number` columns with values. */
  readonly numeric?: NumericProfile
  /** Up to 5 most frequent values for low-cardinality (<= 10 distinct) string/boolean columns. */
  topValues?: Array<{ readonly value: string; readonly count: number }>
  /** Suspicion notes, e.g. mixed-type composition. */
  notes: string[]
}

/** Full-content duplicate detection over ALL rows. */
export interface DuplicateDetection {
  /** Rows whose full sha256 content duplicates an earlier row. */
  readonly duplicateRows: number
  /** `duplicateRows / rowCount` (0 when the table has no rows). */
  readonly duplicateRate: number
  /** 0-based indexes of duplicated rows, capped by the sample limit. */
  readonly duplicateSampleRowIndexes: number[]
}

/** The full profile report (also the persisted and tool-returned value). */
export interface ProfileReport {
  /** The persisted-report schema version (see {@link REPORT_SCHEMA_VERSION}). */
  readonly schemaVersion: number
  readonly dataset: string
  readonly rowCount: number
  /** Whether column cards describe a systematic sample rather than every row. */
  readonly sampled: boolean
  /** Rows the column cards were computed over. */
  readonly profiledRows: number
  readonly columnCount: number
  /** Rows whose full content duplicates an earlier row (over ALL rows). */
  readonly duplicateRows: number
  /** `duplicateRows / rowCount` (0 when the table has no rows). */
  readonly duplicateRate: number
  /** 0-based indexes of duplicated rows (capped by the configured sample limit). */
  readonly duplicateSampleRowIndexes: number[]
  /** DAMA six-dimension quality scorecard. */
  readonly scorecard: DataQualityScorecard
  /** Detected file encoding (BOM/UTF-8 validity); present only for file-loaded tables. */
  readonly encoding?: EncodingInfo
  columns: ColumnProfile[]
  /** Storage-domain key of the persisted report, when persistence is on (set by the provider). */
  readonly reportKey?: string
  /** Injected generation timestamp (epoch ms). */
  readonly generatedAt: number
}

/** Fallback duplicate-sample cap for direct engine use; the provider always passes the configured `evidenceRowLimit`. */
const DEFAULT_DUPLICATE_SAMPLE_LIMIT = 20

/** Round to 6 significant digits for stable, readable report numbers. */
function round6(value: number): number {
  return Number(value.toPrecision(6))
}

/** Linear-interpolation quantile over an ascending-sorted array. */
function quantile(sorted: readonly number[], q: number): number {
  const index = (sorted.length - 1) * q
  const low = Math.floor(index)
  const high = Math.ceil(index)
  const lower = sorted[low] as number
  const upper = sorted[high] as number
  return lower + (upper - lower) * (index - low)
}

/** Compute the numeric distribution of already-parsed values. */
export function numericProfile(values: readonly number[]): NumericProfile | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, value) => acc + value, 0)
  const p25 = quantile(sorted, 0.25)
  const p75 = quantile(sorted, 0.75)
  const iqr = p75 - p25
  const lowFence = p25 - 1.5 * iqr
  const highFence = p75 + 1.5 * iqr
  const outliers = iqr === 0 ? 0 : sorted.filter((value) => value < lowFence || value > highFence).length
  return {
    count: sorted.length,
    distinct: new Set(sorted).size,
    min: round6(sorted[0] as number),
    max: round6(sorted[sorted.length - 1] as number),
    mean: round6(sum / sorted.length),
    median: round6(quantile(sorted, 0.5)),
    p25: round6(p25),
    p75: round6(p75),
    outliers,
  }
}

/** Deterministic sha256 key of one row's full content (columns in table order). */
function rowContentKey(table: Table, row: Row): string {
  return createHash('sha256').update(JSON.stringify(table.columns.map((column) => row[column] ?? null))).digest('hex')
}

/**
 * Detect full-content duplicate rows with a bounded sample of their 0-based
 * indexes. The first occurrence of each content is never counted; later rows
 * with identical full content are duplicates.
 * @param table - the parsed dataset.
 * @param options - sample cap and optional abort signal.
 * @returns the duplicate count, rate, and capped sample indexes.
 */
export function detectDuplicateRows(
  table: Table,
  options: { sampleLimit: number; signal?: AbortSignal | undefined },
): DuplicateDetection {
  if (!Number.isSafeInteger(options.sampleLimit) || options.sampleLimit <= 0) {
    throw new TypeError(`sampleLimit must be a positive safe integer, got ${String(options.sampleLimit)}`)
  }
  const seen = new Set<string>()
  let duplicates = 0
  const duplicateSampleRowIndexes: number[] = []
  for (const [index, row] of table.rows.entries()) {
    if (index % 1024 === 0) throwIfAborted(options.signal)
    const key = rowContentKey(table, row)
    if (seen.has(key)) {
      duplicates += 1
      if (duplicateSampleRowIndexes.length < options.sampleLimit) duplicateSampleRowIndexes.push(index)
    } else {
      seen.add(key)
    }
  }
  return {
    duplicateRows: duplicates,
    duplicateRate: table.rows.length === 0 ? 0 : round6(duplicates / table.rows.length),
    duplicateSampleRowIndexes,
  }
}

/** Count rows whose full content duplicates an earlier row (first occurrence is not counted). */
export function countDuplicateRows(table: Table, signal?: AbortSignal): number {
  return detectDuplicateRows(table, { sampleLimit: 1, signal }).duplicateRows
}

/** Profile one column over the given rows. */
function profileColumn(rows: readonly Row[], column: string, signal?: AbortSignal): ColumnProfile {
  let missing = 0
  let numbers = 0
  let dates = 0
  let booleans = 0
  let strings = 0
  const numericValues: number[] = []
  const distinct = new Set<string>()
  const frequencies = new Map<string, number>()
  for (const [index, row] of rows.entries()) {
    if (index % 1024 === 0) throwIfAborted(signal)
    const cell = row[column]
    if (isMissing(cell)) {
      missing += 1
      continue
    }
    const text = typeof cell === 'string' ? cell : JSON.stringify(cell)
    distinct.add(text)
    frequencies.set(text, (frequencies.get(text) ?? 0) + 1)
    const numeric = parseNumeric(cell)
    if (numeric !== undefined) {
      numbers += 1
      numericValues.push(numeric)
      continue
    }
    if (parseDate(cell) !== undefined) {
      dates += 1
      continue
    }
    if (parseBoolean(cell) !== undefined) {
      booleans += 1
      continue
    }
    strings += 1
  }

  const present = rows.length - missing
  const notes: string[] = []
  let inferredType: InferredType
  if (present === 0) {
    inferredType = 'empty'
  } else if (numbers === present) {
    inferredType = 'number'
  } else if (dates === present) {
    inferredType = 'date'
  } else if (booleans === present) {
    inferredType = 'boolean'
  } else if (strings === present) {
    inferredType = 'string'
  } else {
    inferredType = 'mixed'
    const parts = [
      numbers > 0 ? `${numbers} numeric` : undefined,
      dates > 0 ? `${dates} date` : undefined,
      booleans > 0 ? `${booleans} boolean` : undefined,
      strings > 0 ? `${strings} string` : undefined,
    ].filter((part) => part !== undefined)
    notes.push(`mixed types among ${present} present values: ${parts.join(', ')}`)
  }

  const profile: ColumnProfile = {
    name: column,
    inferredType,
    missing,
    missingRate: rows.length === 0 ? 0 : round6(missing / rows.length),
    unique: distinct.size,
    notes,
  }
  const numeric = inferredType === 'number' ? numericProfile(numericValues) : undefined
  const topValues =
    (inferredType === 'string' || inferredType === 'boolean') && distinct.size > 0 && distinct.size <= 10
      ? [...frequencies.entries()]
          .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
          .slice(0, 5)
          .map(([value, count]) => ({ value, count }))
      : undefined
  return {
    ...profile,
    ...(numeric !== undefined ? { numeric } : {}),
    ...(topValues !== undefined ? { topValues } : {}),
  }
}

/**
 * Profile a parsed table. Column cards are computed over a deterministic
 * systematic sample when `sample` is given; row counts and duplicate counts
 * always cover the full table.
 * @param table - the parsed dataset.
 * @param options - dataset label, optional sample size, injected timestamp, abort signal.
 * @returns the profile report.
 */
export function profileTable(
  table: Table,
  options: {
    dataset: string
    sample?: number | undefined
    generatedAt: number
    signal?: AbortSignal | undefined
    duplicateSampleLimit?: number | undefined
    declaredSchema?: Readonly<Record<string, InferredType>> | undefined
    scorecardWeights?: Readonly<Record<ScorecardDimensionName, number>> | undefined
  },
): ProfileReport {
  throwIfAborted(options.signal)
  const profiled = options.sample === undefined ? table.rows : sampleRows(table.rows, options.sample)
  const columns = table.columns.map((column) => profileColumn(profiled, column, options.signal))
  const detection = detectDuplicateRows(table, { sampleLimit: options.duplicateSampleLimit ?? DEFAULT_DUPLICATE_SAMPLE_LIMIT, signal: options.signal })
  const scorecard = computeScorecard(table, {
    now: options.generatedAt,
    duplicateRows: detection.duplicateRows,
    declaredSchema: options.declaredSchema,
    weights: options.scorecardWeights,
    signal: options.signal,
  })
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    dataset: options.dataset,
    rowCount: table.rows.length,
    sampled: profiled.length !== table.rows.length,
    profiledRows: profiled.length,
    columnCount: table.columns.length,
    duplicateRows: detection.duplicateRows,
    duplicateRate: detection.duplicateRate,
    duplicateSampleRowIndexes: detection.duplicateSampleRowIndexes,
    scorecard,
    ...(table.encoding !== undefined ? { encoding: table.encoding } : {}),
    columns,
    generatedAt: options.generatedAt,
  }
}

/** Human-readable profile summary for the tool's Native render. */
export function renderProfileText(report: ProfileReport): string {
  const lines: string[] = []
  lines.push(`Profile of ${report.dataset}: ${report.rowCount} rows x ${report.columnCount} columns` +
    (report.sampled ? ` (column cards over a systematic sample of ${report.profiledRows} rows)` : ''))
  if (report.duplicateRows > 0) {
    lines.push(`Duplicate rows: ${report.duplicateRows} (${(report.duplicateRate * 100).toFixed(1)}%)` +
      (report.duplicateSampleRowIndexes.length > 0 ? `; sample row indexes: ${report.duplicateSampleRowIndexes.join(', ')}` : ''))
  }
  for (const column of report.columns) {
    const parts = [`${column.name}: ${column.inferredType}`]
    if (column.missing > 0) parts.push(`missing ${column.missing} (${(column.missingRate * 100).toFixed(1)}%)`)
    parts.push(`unique ${column.unique}`)
    if (column.numeric !== undefined) {
      parts.push(
        `count ${column.numeric.count}, distinct ${column.numeric.distinct}, min ${column.numeric.min}, p25 ${column.numeric.p25}, median ${column.numeric.median}, p75 ${column.numeric.p75}, max ${column.numeric.max}, mean ${column.numeric.mean}` +
          (column.numeric.outliers > 0 ? `, ${column.numeric.outliers} IQR outliers` : ''),
      )
    }
    if (column.topValues !== undefined) {
      parts.push(`top: ${column.topValues.map((entry) => `${JSON.stringify(entry.value)} x${entry.count}`).join(', ')}`)
    }
    for (const note of column.notes) parts.push(`note: ${note}`)
    lines.push(`- ${parts.join('; ')}`)
  }
  if (report.encoding !== undefined) {
    lines.push(`Encoding: UTF-8${report.encoding.bom === 'utf-8' ? ' (BOM)' : ''}${report.encoding.validUtf8 ? '' : ' (INVALID UTF-8)'}`)
  }
  const overall = report.scorecard.overall
  const weighted = report.scorecard.weightedOverall
  lines.push(`Scorecard (overall ${overall === null ? 'undetermined' : `${(overall * 100).toFixed(1)}%`}, weighted ${weighted === null ? 'undetermined' : `${(weighted * 100).toFixed(1)}%`}):`)
  for (const dimension of report.scorecard.dimensions) {
    const value = dimension.score === null ? 'undetermined' : `${(dimension.score * 100).toFixed(1)}%`
    lines.push(`  ${dimension.name}: ${value} (${dimension.note})`)
  }
  return lines.join('\n')
}

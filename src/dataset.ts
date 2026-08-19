/**
 * Dataset loading for `dsh-data-quality`: workspace-confined path resolution,
 * size/row guards, and deterministic parsers for CSV/TSV/JSON/JSONL. All
 * parsing is hand-rolled (no external runtime dependencies) and bounded by
 * the resolved config; oversized inputs reject loudly with actionable hints.
 * @module dsh-data-quality/dataset
 */

import { open, stat } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type { ResolvedConfig } from './config.ts'

/** One cell of a tabular dataset: a JSON scalar, `null` for missing, or a nested JSON value (document rows). */
export type Cell = JsonValue

/** One dataset row keyed by column name. */
export type Row = Record<string, Cell>

/** A tabular dataset: ordered columns plus rows. */
export interface Table {
  /** Column names in file order. */
  readonly columns: string[]
  /** Rows, each carrying every declared column (missing cells are `null`). */
  readonly rows: Row[]
}

/** The root form a document load returns (citation checking walks this). */
export type DocumentRoot =
  | { readonly kind: 'table'; readonly columns: string[]; readonly rows: Row[] }
  | { readonly kind: 'json'; readonly value: unknown }

/** Raised for every user-facing dataset failure; `code` is stable for tests and tooling. */
export class DatasetError extends Error {
  /**
   * @param code - stable machine-readable reason.
   * @param message - actionable human-readable detail.
   */
  constructor(
    readonly code:
      | 'path-escape'
      | 'extension-denied'
      | 'not-found'
      | 'too-large'
      | 'too-many-rows'
      | 'malformed'
      | 'not-tabular',
    message: string,
  ) {
    super(message)
    this.name = 'DatasetError'
  }
}

/**
 * Resolve `requested` inside `root`, rejecting escapes and disallowed
 * extensions. Both sides go through `path.resolve` before comparison so
 * Windows backslash/forward-slash mixes never defeat the containment check.
 * @param root - absolute workspace root.
 * @param requested - the caller-supplied path (relative to root, or absolute inside root).
 * @param config - resolved config (extension allowlist).
 * @returns the normalized absolute path inside `root`.
 */
export function resolveWorkspacePath(root: string, requested: string, config: ResolvedConfig): string {
  if (requested.trim() === '') {
    throw new DatasetError('path-escape', 'dataset path must not be empty')
  }
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, requested)
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new DatasetError(
      'path-escape',
      `path ${JSON.stringify(requested)} resolves outside the workspace root ${JSON.stringify(resolvedRoot)}`,
    )
  }
  const ext = path.extname(resolved).toLowerCase()
  if (!config.allowedExtensions.includes(ext)) {
    throw new DatasetError(
      'extension-denied',
      `extension ${JSON.stringify(ext)} is not in allowedExtensions (${config.allowedExtensions.join(', ')})`,
    )
  }
  return resolved
}

/**
 * Short deterministic fingerprint of a dataset path, used in storage keys.
 * @param datasetPath - the workspace-relative dataset path as callers gave it.
 * @returns an 8-hex-char fingerprint.
 */
export function pathFingerprint(datasetPath: string): string {
  return createHash('sha256').update(datasetPath).digest('hex').slice(0, 8)
}

/** Assert the abort signal has not fired; throws the signal reason otherwise. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw signal.reason instanceof Error ? signal.reason : new Error('operation aborted')
  }
}

/**
 * Read a dataset file under the size cap.
 * @param absolutePath - normalized absolute path (from {@link resolveWorkspacePath}).
 * @param config - resolved config (size cap).
 * @param signal - optional abort signal honored around the read.
 * @returns the UTF-8 text.
 */
export async function readDatasetText(absolutePath: string, config: ResolvedConfig, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal)
  let info
  try {
    info = await stat(absolutePath)
  } catch {
    throw new DatasetError('not-found', `dataset file not found: ${absolutePath}`)
  }
  if (!info.isFile()) {
    throw new DatasetError('not-found', `dataset path is not a file: ${absolutePath}`)
  }
  const capBytes = config.maxFileSizeMB * 1024 * 1024
  if (info.size > capBytes) {
    throw new DatasetError(
      'too-large',
      `dataset is ${(info.size / 1024 / 1024).toFixed(1)} MiB, above the ${config.maxFileSizeMB} MiB cap; split the file or raise maxFileSizeMB`,
    )
  }
  const handle = await open(absolutePath, 'r')
  try {
    throwIfAborted(signal)
    return await handle.readFile('utf8')
  } finally {
    await handle.close()
  }
}

/**
 * Parse CSV/TSV text (RFC-4180-style: quoted fields, `""` escapes, CRLF/LF).
 * The first record is the header; short records pad with `null`, long records
 * fail loud. An empty field parses as `null` (missing).
 * @param text - file text.
 * @param delimiter - field delimiter (`,` or tab).
 * @param config - resolved config (row cap).
 * @param signal - optional abort signal, checked per 1024-record stride.
 * @returns the parsed table.
 */
export function parseDelimited(text: string, delimiter: string, config: ResolvedConfig, signal?: AbortSignal): Table {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  const pushField = (): void => {
    record.push(field)
    field = ''
  }
  const pushRecord = (): void => {
    pushField()
    // Skip truly blank lines (a record of one empty field), as RFC-4180
    // writers commonly emit a trailing empty line.
    if (record.length === 1 && record[0] === '') {
      record = []
      field = ''
      return
    }
    records.push(record)
    record = []
    if (records.length % 1024 === 0) throwIfAborted(signal)
    if (records.length - 1 > config.maxRows) {
      throw new DatasetError(
        'too-many-rows',
        `dataset exceeds the ${config.maxRows} row cap; use the sample parameter or raise maxRows`,
      )
    }
  }
  let index = 0
  while (index < text.length) {
    const char = text[index] as string
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      field += char
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (char === delimiter) {
      pushField()
      index += 1
      continue
    }
    if (char === '\r') {
      index += 1
      continue
    }
    if (char === '\n') {
      pushRecord()
      index += 1
      continue
    }
    field += char
    index += 1
  }
  if (field !== '' || record.length > 0) pushRecord()

  const header = records[0]
  if (header === undefined || (header.length === 1 && header[0] === '')) {
    throw new DatasetError('malformed', 'dataset has no header row')
  }
  const columns = header.map((name) => name.trim())
  if (columns.some((name) => name === '')) {
    throw new DatasetError('malformed', 'header contains an empty column name')
  }
  if (new Set(columns).size !== columns.length) {
    throw new DatasetError('malformed', 'header contains duplicate column names')
  }
  const rows: Row[] = []
  for (let i = 1; i < records.length; i++) {
    const cells = records[i] as string[]
    if (cells.length > columns.length) {
      throw new DatasetError('malformed', `row ${i + 1} has ${cells.length} fields but the header has ${columns.length}`)
    }
    const out: Row = {}
    for (let c = 0; c < columns.length; c++) {
      const raw = cells[c]
      out[columns[c] as string] = raw === undefined || raw === '' ? null : raw
    }
    rows.push(out)
  }
  return { columns, rows }
}

/**
 * Parse a JSON or JSONL text into a tabular dataset. JSON must be an array of
 * flat objects; JSONL is one object per line. Non-scalar cell values are kept
 * as-is (engines treat them as non-scalar).
 * @param text - file text.
 * @param extension - `.json` or `.jsonl`.
 * @param config - resolved config (row cap).
 * @param signal - optional abort signal.
 * @returns the parsed table.
 */
export function parseJsonTable(text: string, extension: string, config: ResolvedConfig, signal?: AbortSignal): Table {
  const values = extension === '.jsonl' ? parseJsonLines(text) : parseJsonDocument(text)
  const items = Array.isArray(values) ? values : [values]
  if (items.length > config.maxRows) {
    throw new DatasetError(
      'too-many-rows',
      `dataset exceeds the ${config.maxRows} row cap; use the sample parameter or raise maxRows`,
    )
  }
  const rows: Row[] = []
  const columns: string[] = []
  const seen = new Set<string>()
  for (const [index, item] of items.entries()) {
    if (index % 1024 === 0) throwIfAborted(signal)
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new DatasetError(
        'not-tabular',
        `row ${index + 1} is not a flat object; profiling/cleaning/verification need a tabular dataset (array of objects)`,
      )
    }
    const row = item as Row
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
    rows.push(row)
  }
  return { columns, rows: rows.map((row) => normalizeRow(row, columns)) }
}

/** Fill absent columns with `null` so every row carries every column. */
function normalizeRow(row: Row, columns: string[]): Row {
  const out: Row = {}
  for (const column of columns) {
    const value = row[column]
    out[column] = value === undefined ? null : value
  }
  return out
}

/** Parse one JSON document; failures become a loud malformed error. */
function parseJsonDocument(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new DatasetError('malformed', `invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Parse JSONL (one JSON value per non-empty line); failures name the line. */
function parseJsonLines(text: string): unknown[] {
  const out: unknown[] = []
  const lines = text.split(/\r?\n/u)
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') continue
    try {
      out.push(JSON.parse(line))
    } catch {
      throw new DatasetError('malformed', `invalid JSON on line ${index + 1}`)
    }
  }
  return out
}

/**
 * Load a tabular dataset from a file already resolved inside the workspace.
 * @param absolutePath - normalized absolute dataset path.
 * @param config - resolved config.
 * @param signal - optional abort signal.
 * @returns the parsed table.
 */
export async function loadTable(absolutePath: string, config: ResolvedConfig, signal?: AbortSignal): Promise<Table> {
  const text = await readDatasetText(absolutePath, config, signal)
  const ext = path.extname(absolutePath).toLowerCase()
  throwIfAborted(signal)
  if (ext === '.csv') return parseDelimited(text, ',', config, signal)
  if (ext === '.tsv') return parseDelimited(text, '\t', config, signal)
  return parseJsonTable(text, ext, config, signal)
}

/**
 * Load a dataset as a citation-checkable document root: CSV/TSV become
 * `{ columns, rows }` (so `rows[3].nav` resolves), JSON is the parsed value,
 * JSONL is the array of parsed lines.
 * @param absolutePath - normalized absolute dataset path.
 * @param config - resolved config.
 * @param signal - optional abort signal.
 * @returns the document root.
 */
export async function loadDocument(absolutePath: string, config: ResolvedConfig, signal?: AbortSignal): Promise<DocumentRoot> {
  const ext = path.extname(absolutePath).toLowerCase()
  if (ext === '.json') {
    const text = await readDatasetText(absolutePath, config, signal)
    return { kind: 'json', value: parseJsonDocument(text) }
  }
  if (ext === '.jsonl') {
    const text = await readDatasetText(absolutePath, config, signal)
    return { kind: 'json', value: parseJsonLines(text) }
  }
  const table = await loadTable(absolutePath, config, signal)
  return { kind: 'table', columns: table.columns, rows: table.rows }
}

/**
 * Deterministic systematic sample: every `ceil(total / count)`-th row from
 * index 0. No clock, no RNG — the same input always yields the same sample.
 * @param rows - full row list.
 * @param count - requested sample size.
 * @returns the sampled rows (identity when `count >= rows.length`).
 */
export function sampleRows(rows: Row[], count: number): Row[] {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new DatasetError('malformed', `sample must be a positive integer, got ${String(count)}`)
  }
  if (count >= rows.length) return rows
  const stride = Math.ceil(rows.length / count)
  const out: Row[] = []
  for (let i = 0; i < rows.length; i += stride) {
    out.push(rows[i] as Row)
  }
  return out
}

/**
 * Missingness: `null`, `undefined`, or a string empty after trimming. A
 * whitespace-only cell counts as missing even before any `trim` clean rule.
 * @param cell - the cell to test (`undefined` when the column is absent).
 * @returns whether the cell is missing.
 */
export function isMissing(cell: Cell | undefined): boolean {
  if (cell === null || cell === undefined) return true
  if (typeof cell === 'string') return cell.trim() === ''
  return false
}

/** Strict full-string numeric parse (no thousands separators, no unit suffixes). */
export function parseNumeric(cell: Cell | undefined): number | undefined {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : undefined
  if (typeof cell !== 'string') return undefined
  const text = cell.trim()
  if (text === '') return undefined
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text)) return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

const DATE_PATTERNS: readonly RegExp[] = [
  /^(\d{4})-(\d{1,2})-(\d{1,2})$/u,
  /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/u,
  /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/u,
]

/**
 * Deterministic date parse to epoch milliseconds. Accepts `YYYY-MM-DD`,
 * `YYYY/MM/DD`, and ISO-like datetimes (date-only forms read as UTC midnight).
 * Calendar-invalid dates (e.g. 2025-13-40) reject. Returns `undefined` when
 * the cell is not a recognized date.
 * @param cell - the cell to parse (`undefined` when the column is absent).
 * @returns epoch milliseconds, or `undefined`.
 */
export function parseDate(cell: Cell | undefined): number | undefined {
  if (typeof cell !== 'string') return undefined
  const text = cell.trim()
  for (const pattern of DATE_PATTERNS) {
    const match = pattern.exec(text)
    if (match === null) continue
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const hour = Number(match[4] ?? 0)
    const minute = Number(match[5] ?? 0)
    const second = Number(match[6] ?? 0)
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return undefined
    const epoch = Date.UTC(year, month - 1, day, hour, minute, second)
    const check = new Date(epoch)
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined
    return epoch
  }
  return undefined
}

/** Boolean parse: true/false/yes/no/1/0, case-insensitive. */
export function parseBoolean(cell: Cell | undefined): boolean | undefined {
  if (typeof cell === 'boolean') return cell
  if (typeof cell !== 'string') return undefined
  const text = cell.trim().toLowerCase()
  if (text === 'true' || text === 'yes' || text === '1') return true
  if (text === 'false' || text === 'no' || text === '0') return false
  return undefined
}

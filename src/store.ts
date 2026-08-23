/**
 * Durable report storage over the harness storage domain. The `data_quality`
 * domain keeps one record per profile/clean/verify/citations run, keyed by an
 * injected timestamp plus a path fingerprint, so reports survive a restart
 * and stay queryable without touching the session log.
 * @module dsh-data-quality/store
 */

import z from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { pathFingerprint } from './dataset.ts'

/** Zod schema of one persisted report record (durable-boundary validation). */
export const reportRecordSchema = z.object({
  kind: z.enum(['profile', 'clean', 'verify', 'citations', 'clean-diff']),
  at: z.number().int().nonnegative(),
  dataset: z.string(),
  report: z.record(z.string(), z.unknown()),
})

/** One persisted report record. */
export interface ReportRecord {
  readonly kind: 'profile' | 'clean' | 'verify' | 'citations' | 'clean-diff'
  /** Injected run timestamp (epoch ms). */
  readonly at: number
  /** Workspace-relative dataset path as the caller gave it. */
  readonly dataset: string
  /** The full run report (profile/clean/verify/citations shape by `kind`). */
  readonly report: Record<string, unknown>
}

/** A persisted report plus its storage key (the query surface's return value). */
export interface StoredReport extends ReportRecord {
  /** The storage key the record was written under. */
  readonly key: string
}

/** The `dsh-data-quality` storage-domain declaration. */
export const dataQualityDomainSpec = defineDomain({
  name: 'data_quality',
  version: 1,
  tables: {
    reports: domainTable<string, ReportRecord>(reportRecordSchema),
  },
})

/** Handle over the reports table with deterministic key construction. */
export interface ReportStore {
  /**
   * Persist one run report.
   * @param record - the report envelope (kind/dataset/at/report).
   * @returns the storage key the record was written under.
   */
  put(record: ReportRecord): Promise<string>
  /**
   * Read one persisted report.
   * @param key - the key {@link put} returned.
   * @returns the record, or `undefined` when absent.
   */
  get(key: string): ReportRecord | undefined
  /**
   * Snapshot of every record of one kind, ordered by key (chronological).
   * @param kind - the report kind.
   * @returns the stored reports (empty when none match).
   */
  list(kind: ReportRecord['kind']): StoredReport[]
}

/** Well-formed report-key shape: `<17-digit timestamp>-<kind>-<8-hex fingerprint>`. */
const REPORT_KEY_PATTERN = /^\d{17}-(?:profile|clean|verify|citations|clean-diff)-[0-9a-f]{8}$/u

/**
 * Whether `key` is a well-formed, path-safe storage report key. Rejects any
 * key with separators, traversal, or unexpected characters before it can be
 * handed to the storage backend.
 * @param key - candidate report key.
 * @returns whether the key matches the deterministic report-key format.
 */
export function isValidReportKey(key: string): boolean {
  return REPORT_KEY_PATTERN.test(key)
}

/** Pad to two digits for the key timestamp. */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Build the storage key for one run: `YYYYMMDDHHmmssSSS-<kind>-<pathFp>`.
 * UTC digits keep the key timezone-independent and filename-safe everywhere.
 * @param record - the report envelope.
 * @returns the deterministic key.
 */
export function reportKeyOf(record: ReportRecord): string {
  const date = new Date(record.at)
  const stamp =
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}${String(date.getUTCMilliseconds()).padStart(3, '0')}`
  return `${stamp}-${record.kind}-${pathFingerprint(record.dataset)}`
}

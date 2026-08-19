/**
 * Service Definition of the `dsh-data-quality` capability seam: the
 * `ctx.dataQuality` surface other plugins may optionally consume, plus the
 * internal request/report types the local Provider and the tool Consumers
 * share. The {@link CitationCheckRequest} / {@link CitationCheckResult}
 * citation contract is FROZEN for cross-plugin consumers — change it only
 * with a coordinated ecosystem migration.
 * @module dsh-data-quality/service
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { JsonValue, Session } from '@deepseek-ai/dsh-session'
import type { CleanRule, CleanRuleLog } from './clean.ts'
import type { ProfileReport } from './profile.ts'
import type { VerifyReport, VerifyRule } from './verify.ts'

export interface CitationCheckRequest {
  /** Workspace-relative path of the source dataset snapshot (CSV/JSON). */
  dataset: string
  /** Citations to verify against the dataset. */
  citations: Array<{
    /** Stable id chosen by the caller, echoed back in results. */
    id: string
    /** JSON-path-ish locator, e.g. "rows[3].nav" or "summary.annualReturn". */
    path: string
    /** The value as cited in the document. */
    value: number | string
    /** Optional relative tolerance for numeric comparison, e.g. 0.01 = 1%. */
    tolerance?: number
  }>
}
export interface CitationCheckResult {
  results: Array<{
    id: string
    status: 'verified' | 'mismatch' | 'not-found' | 'unverifiable'
    /** Actual value found at path, when found. */
    actual?: number | string
    /** Human-readable evidence note. */
    note?: string
  }>
}

/** Profile request through the service layer (tools pass the session workspace). */
export interface ProfileRequest {
  /** Workspace-relative dataset path. */
  readonly dataset: string
  /** Optional deterministic systematic sample size for column cards. */
  readonly sample?: number | undefined
  /** Absolute workspace root the dataset resolves inside. */
  readonly workspace: string
  /** Calling session (receives the `data-quality/profile` event), when any. */
  readonly session?: Session | undefined
  /** Cancellation from the tool call. */
  readonly signal?: AbortSignal | undefined
}

/** Clean request through the service layer. */
export interface CleanRequest {
  /** Workspace-relative dataset path. */
  readonly dataset: string
  /** Non-empty declarative cleaning rule list, applied in order. */
  readonly rules: readonly CleanRule[]
  /** Workspace-relative output path; omitted = no disk write, preview only. */
  readonly outputPath?: string | undefined
  /** Absolute workspace root the dataset resolves inside. */
  readonly workspace: string
  /** Calling session (receives the `data-quality/clean` event), when any. */
  readonly session?: Session | undefined
  /** Cancellation from the tool call. */
  readonly signal?: AbortSignal | undefined
}

/** Verify request through the service layer. */
export interface VerifyRequest {
  /** Workspace-relative dataset path. */
  readonly dataset: string
  /** Non-empty declarative verification rule list. */
  readonly rules: readonly VerifyRule[]
  /** Absolute workspace root the dataset resolves inside. */
  readonly workspace: string
  /** Calling session (receives the `data-quality/verify` event), when any. */
  readonly session?: Session | undefined
  /** Cancellation from the tool call. */
  readonly signal?: AbortSignal | undefined
}

/** The value a clean run returns (tool canonical value minus presentation). */
export interface CleanRunReport {
  readonly dataset: string
  readonly inputRows: number
  readonly outputRows: number
  readonly logs: CleanRuleLog[]
  /** First `evidenceRowLimit` cleaned rows for inspection (display-truncated). */
  readonly preview: { readonly columns: string[]; readonly rows: Array<Record<string, JsonValue>> }
  /** Workspace-relative output path when the run wrote a file. */
  readonly outputPath?: string
  /** Storage-domain key of the persisted report, when persistence is on. */
  readonly reportKey?: string
  readonly generatedAt: number
}

/** The value a verifyCitation call persists (report envelope kind `citations`). */
export interface CitationCheckPersisted {
  readonly dataset: string
  readonly checked: number
  readonly verified: number
  readonly mismatched: number
  readonly notFound: number
  readonly unverifiable: number
  readonly results: CitationCheckResult['results']
  readonly generatedAt: number
}

/**
 * The `ctx.dataQuality` service. The local Provider implements deterministic
 * TypeScript computation; Consumers (the three tools and third-party plugins)
 * never re-implement the math.
 */
export abstract class DataQualityService extends Service {
  /**
   * Register as `dataQuality` on the context.
   * @param ctx - the plugin context.
   */
  constructor(ctx: Context) {
    super(ctx, 'dataQuality')
  }

  /**
   * Frozen cross-plugin contract: verify document citations against a dataset
   * snapshot. The dataset resolves against the configured service workspace
   * root (`workspaceRoot`, defaulting to the harness launch directory).
   * @param request - dataset path plus citations.
   * @returns one result per citation, ids echoed.
   */
  abstract verifyCitations(request: CitationCheckRequest): Promise<CitationCheckResult>

  /**
   * Profile a workspace dataset (row/column counts, inferred types,
   * missingness, cardinality, numeric distribution, suspected anomalies).
   * @param request - dataset path, optional sample size, workspace root.
   * @returns the profile report.
   */
  abstract profileDataset(request: ProfileRequest): Promise<ProfileReport>

  /**
   * Apply declarative cleaning rules to a workspace dataset. The source file
   * is never overwritten; without `outputPath` nothing touches the disk.
   * @param request - dataset path, ordered rules, optional output path, workspace root.
   * @returns the cleaned preview plus the per-rule audit log.
   */
  abstract cleanDataset(request: CleanRequest): Promise<CleanRunReport>

  /**
   * Apply declarative verification rules to a workspace dataset. A failing
   * dataset is a normal result (`passed: false`), never a thrown error.
   * @param request - dataset path, rules, workspace root.
   * @returns the verify report.
   */
  abstract verifyDataset(request: VerifyRequest): Promise<VerifyReport>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Deterministic data profiling / cleaning / verification, when the dsh-data-quality bundle is mounted. */
    dataQuality: DataQualityService
  }
}

/** Re-exports so consumers pull the whole seam vocabulary from one module. */
export type { CleanResult, CleanRule, CleanRuleLog } from './clean.ts'
export type { ProfileReport } from './profile.ts'
export type { VerifyReport, VerifyRule } from './verify.ts'

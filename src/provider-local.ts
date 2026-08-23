/**
 * The local deterministic Provider of the `ctx.dataQuality` seam: orchestrates
 * dataset loading, the pure engines, durable report persistence, and the
 * adaptive `data-quality/*` session events. All computation is TypeScript in
 * this process — no model arithmetic, no external processes.
 * @module dsh-data-quality/provider-local
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from './config.ts'
import { loadDocument, loadTable, resolveWorkspacePath, throwIfAborted } from './dataset.ts'
import { applyCleanRules, serializeDelimited } from './clean.ts'
import { computeCleanContract, computeCleanProfileDiff } from './contract.ts'
import { profileTable } from './profile.ts'
import { checkCitations, verifyTable } from './verify.ts'
import { appendDataQualityEvent } from './events.ts'
import { isValidReportKey, reportKeyOf, type ReportRecord, type ReportStore, type StoredReport } from './store.ts'
import { resolveIndustryPreset } from './presets.ts'
import { truncateRow } from './present.ts'
import {
  DataQualityService,
  type CitationCheckRequest,
  type CitationCheckResult,
  type CleanRequest,
  type CleanRunReport,
  type ProfileRequest,
  type VerifyRequest,
} from './service.ts'
import type { ProfileReport } from './profile.ts'
import type { VerifyReport } from './verify.ts'
import type { Session } from '@deepseek-ai/dsh-session'

/** Provider construction dependencies. */
export interface ProviderDeps {
  /** Report persistence; absent when `storeReports` is off. */
  readonly store?: ReportStore | undefined
  /** Injected clock — the single time source for reports and freshness defaults. */
  readonly now: () => number
}

/**
 * The local deterministic `dataQuality` implementation. Mounted by the plugin
 * entry; third-party plugins consume it through `ctx.dataQuality`.
 */
export class LocalDataQualityService extends DataQualityService {
  private readonly config: ResolvedConfig
  private readonly deps: ProviderDeps

  /**
   * @param ctx - the plugin context.
   * @param config - the resolved plugin config.
   * @param deps - store handle plus the injected clock.
   */
  constructor(ctx: Context, config: ResolvedConfig, deps: ProviderDeps) {
    super(ctx)
    this.config = config
    this.deps = deps
  }

  /** The absolute root for service-level calls without a session workspace. */
  serviceRoot(): string {
    return this.config.workspaceRoot !== '' ? path.resolve(this.config.workspaceRoot) : process.cwd()
  }

  /** Persist one report when persistence is on; returns the storage key. */
  private async persist(kind: ReportRecord['kind'], dataset: string, report: Record<string, unknown>): Promise<string | undefined> {
    const store = this.deps.store
    if (store === undefined) return undefined
    const record: ReportRecord = { kind, at: this.deps.now(), dataset, report }
    const key = reportKeyOf(record)
    await store.put({ ...record })
    return key
  }

  /** Emit the adaptive session event when the call carries a session. */
  emitEvent(session: Session | undefined, kind: 'profile' | 'clean' | 'verify', dataset: string, reportKey: string | undefined, summary: { rows: number; columns?: number; rules?: number; failedRules?: number; passed?: boolean; expectations?: number; failedExpectations?: number }): void {
    if (session === undefined) return
    appendDataQualityEvent(session, `data-quality/${kind}`, {
      kind,
      dataset,
      ...(reportKey !== undefined ? { reportKey } : {}),
      summary,
    })
  }

  /** @inheritdoc DataQualityService.profileDataset */
  override async profileDataset(request: ProfileRequest): Promise<ProfileReport> {
    throwIfAborted(request.signal)
    const absolute = resolveWorkspacePath(request.workspace, request.dataset, this.config)
    const table = await loadTable(absolute, this.config, request.signal)
    const declaredSchema = request.industryPreset === undefined ? undefined : resolveIndustryPreset(request.industryPreset).columns
    const report = profileTable(table, {
      dataset: request.dataset,
      sample: request.sample,
      generatedAt: this.deps.now(),
      signal: request.signal,
      duplicateSampleLimit: this.config.evidenceRowLimit,
      declaredSchema,
      scorecardWeights: this.config.scorecardWeights,
    })
    const reportKey = await this.persist('profile', request.dataset, report as unknown as Record<string, unknown>)
    this.emitEvent(request.session, 'profile', request.dataset, reportKey, { rows: report.rowCount, columns: report.columnCount })
    return { ...report, ...(reportKey !== undefined ? { reportKey } : {}) }
  }

  /** @inheritdoc DataQualityService.cleanDataset */
  override async cleanDataset(request: CleanRequest): Promise<CleanRunReport> {
    throwIfAborted(request.signal)
    const dryRun = request.dryRun === true
    const absolute = resolveWorkspacePath(request.workspace, request.dataset, this.config)
    const table = await loadTable(absolute, this.config, request.signal)
    const result = applyCleanRules(table, request.rules, { signal: request.signal })

    let writtenPath: string | undefined
    if (!dryRun && request.outputPath !== undefined) {
      const outputAbsolute = resolveWorkspacePath(request.workspace, request.outputPath, this.config)
      if (outputAbsolute === absolute) {
        throw new Error(`outputPath ${JSON.stringify(request.outputPath)} would overwrite the input dataset; choose a different path`)
      }
      const ext = path.extname(outputAbsolute).toLowerCase()
      const text = ext === '.csv' || ext === '.tsv'
        ? serializeDelimited(result.columns, result.rows, ext === '.csv' ? ',' : '\t')
        : ext === '.jsonl'
          ? `${result.rows.map((row) => JSON.stringify(row)).join('\n')}\n`
          : `${JSON.stringify(result.rows, null, 2)}\n`
      await mkdir(path.dirname(outputAbsolute), { recursive: true })
      throwIfAborted(request.signal)
      await writeFile(outputAbsolute, text, 'utf8')
      writtenPath = request.outputPath
    }

    const generatedAt = this.deps.now()
    // The contract summary is part of the model-visible canonical value, so it
    // must also be part of the durable report (model-visible ⟺ logged).
    const contract = computeCleanContract(result, request.rules, { signal: request.signal })
    const outputTable = {
      columns: result.columns,
      rows: result.rows,
      ...(table.encoding !== undefined ? { encoding: table.encoding } : {}),
    }
    // The before/after profile diff preview is the expected diff in a dry run
    // and the durable audit artifact (separate `clean-diff` record) otherwise.
    const diff = computeCleanProfileDiff(table, outputTable, {
      dataset: request.dataset,
      generatedAt,
      scorecardWeights: this.config.scorecardWeights,
      signal: request.signal,
    })
    // The preview is part of the model-visible canonical value, so it must
    // also be part of the durable report: otherwise the clean result's preview
    // could not be reconstructed from the session log (model-visible ⟺ logged).
    const preview = { columns: result.columns, rows: result.rows.slice(0, this.config.evidenceRowLimit).map((row) => truncateRow(row)) }

    if (dryRun) {
      this.emitEvent(request.session, 'clean', request.dataset, undefined, { rows: result.outputRows, columns: result.columns.length, rules: result.logs.length })
      return {
        dataset: request.dataset,
        inputRows: result.inputRows,
        outputRows: result.outputRows,
        dryRun: true,
        logs: result.logs,
        contract,
        preview,
        diffPreview: diff,
        generatedAt,
      }
    }

    const reportKey = await this.persist('clean', request.dataset, {
      dataset: request.dataset,
      inputRows: result.inputRows,
      outputRows: result.outputRows,
      dryRun: false,
      logs: result.logs,
      contract,
      preview,
      ...(writtenPath !== undefined ? { outputPath: writtenPath } : {}),
      generatedAt,
    } as unknown as Record<string, unknown>)
    await this.persist('clean-diff', request.dataset, diff as unknown as Record<string, unknown>)
    this.emitEvent(request.session, 'clean', request.dataset, reportKey, { rows: result.outputRows, columns: result.columns.length, rules: result.logs.length })

    return {
      dataset: request.dataset,
      inputRows: result.inputRows,
      outputRows: result.outputRows,
      dryRun: false,
      logs: result.logs,
      contract,
      preview,
      ...(writtenPath !== undefined ? { outputPath: writtenPath } : {}),
      ...(reportKey !== undefined ? { reportKey } : {}),
      generatedAt,
    }
  }

  /** @inheritdoc DataQualityService.getReport */
  override async getReport(key: string): Promise<StoredReport> {
    if (!isValidReportKey(key)) {
      throw new Error(`invalid reportKey ${JSON.stringify(key)}: expected the deterministic <timestamp>-<kind>-<fingerprint> format`)
    }
    const store = this.deps.store
    if (store === undefined) {
      throw new Error('report storage is disabled (storeReports is false); no persisted reports to read')
    }
    const record = store.get(key)
    if (record === undefined) {
      throw new Error(`no persisted report found for reportKey ${JSON.stringify(key)}`)
    }
    return { key, ...record }
  }

  /** @inheritdoc DataQualityService.listReports */
  override async listReports(kind: ReportRecord['kind']): Promise<StoredReport[]> {
    const store = this.deps.store
    if (store === undefined) {
      throw new Error('report storage is disabled (storeReports is false); no persisted reports to read')
    }
    return store.list(kind)
  }

  /** @inheritdoc DataQualityService.verifyDataset */
  override async verifyDataset(request: VerifyRequest): Promise<VerifyReport> {
    throwIfAborted(request.signal)
    const absolute = resolveWorkspacePath(request.workspace, request.dataset, this.config)
    const table = await loadTable(absolute, this.config, request.signal)
    const outcome = verifyTable(table, request.rules, {
      evidenceRowLimit: this.config.evidenceRowLimit,
      now: this.deps.now,
      signal: request.signal,
      expectations: request.expectations,
      defaultTolerance: this.config.defaultTolerance,
    })
    const report: VerifyReport = { dataset: request.dataset, ...outcome }
    const failedRules = report.rules.filter((rule) => !rule.passed).length
    const failedExpectations = report.expectations.filter((expectation) => !expectation.passed).length
    const reportKey = await this.persist('verify', request.dataset, report as unknown as Record<string, unknown>)
    this.emitEvent(request.session, 'verify', request.dataset, reportKey, {
      rows: report.rowCount,
      rules: report.rules.length,
      failedRules,
      passed: report.passed,
      expectations: report.expectations.length,
      failedExpectations,
    })
    return { ...report, ...(reportKey !== undefined ? { reportKey } : {}) }
  }

  /** @inheritdoc DataQualityService.verifyCitations */
  override async verifyCitations(request: CitationCheckRequest): Promise<CitationCheckResult> {
    const absolute = resolveWorkspacePath(this.serviceRoot(), request.dataset, this.config)
    const document = await loadDocument(absolute, this.config)
    const result = checkCitations(document, request.citations, this.config.defaultTolerance)
    const verified = result.results.filter((entry) => entry.status === 'verified').length
    const mismatched = result.results.filter((entry) => entry.status === 'mismatch').length
    const notFound = result.results.filter((entry) => entry.status === 'not-found').length
    const unverifiable = result.results.filter((entry) => entry.status === 'unverifiable').length
    await this.persist('citations', request.dataset, {
      dataset: request.dataset,
      checked: result.results.length,
      verified,
      mismatched,
      notFound,
      unverifiable,
      results: result.results,
      generatedAt: this.deps.now(),
    } as unknown as Record<string, unknown>)
    return result
  }
}

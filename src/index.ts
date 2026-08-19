/**
 * `dsh-data-quality` — deterministic data profiling, cleaning, and
 * verification for DeepSeek Harness. Mounts the `ctx.dataQuality` capability
 * seam (Service Definition in `service.ts`, local Provider in
 * `provider-local.ts`), registers the `data_profile` / `data_clean` /
 * `data_verify` model tools (Consumers — all computation goes through the
 * service layer), persists run reports to the `data_quality` storage domain,
 * and appends adaptive `data-quality/*` session events on hosts that can
 * carry them.
 *
 * Function plugin — no default export (the Loader unwraps
 * `exports.default ?? exports`, and a stray default would discard
 * `name`/`inject`/`Config`/`apply`).
 * @module dsh-data-quality
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: registers the `ctx.storageDomain` Context merge for the inject.
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { Config, resolveConfig } from './config.ts'
import { dataQualityDomainSpec, reportKeyOf, type ReportStore } from './store.ts'
import { LocalDataQualityService } from './provider-local.ts'
import { defineProfileTool } from './tools/profile.ts'
import { defineCleanTool } from './tools/clean.ts'
import { defineVerifyTool } from './tools/verify.ts'
import { VERSION } from './version.ts'

export const name = 'data-quality'
/** The three model tools and the durable report domain. */
export const inject = ['tools', 'storageDomain']

export { Config, resolveConfig } from './config.ts'
export type { Config as DataQualityConfig, ResolvedConfig } from './config.ts'
export { VERSION } from './version.ts'
export {
  DataQualityService,
  type CitationCheckRequest,
  type CitationCheckResult,
  type ProfileRequest,
  type CleanRequest,
  type CleanRunReport,
  type VerifyRequest,
} from './service.ts'
export { LocalDataQualityService, type ProviderDeps } from './provider-local.ts'
export type { CleanRule, CleanRuleLog, CleanResult } from './clean.ts'
export type { ProfileReport, ColumnProfile, NumericProfile } from './profile.ts'
export type { VerifyRule, VerifyReport, VerifyRuleResult, VerifyEvidenceRow } from './verify.ts'
export { parseLocator, checkCitations } from './verify.ts'
export { profileTable, renderProfileText } from './profile.ts'
export { applyCleanRules, serializeDelimited } from './clean.ts'
export { verifyTable, renderVerifyText } from './verify.ts'
export {
  DatasetError,
  loadTable,
  loadDocument,
  parseDelimited,
  parseJsonTable,
  resolveWorkspacePath,
  sampleRows,
  isMissing,
  parseNumeric,
  parseDate,
  parseBoolean,
  type Table,
  type Row,
  type Cell,
  type DocumentRoot,
} from './dataset.ts'
export { dataQualityDomainSpec, reportKeyOf, reportRecordSchema, type ReportRecord, type ReportStore } from './store.ts'
export { DATA_QUALITY_EVENT_TYPES, appendDataQualityEvent, type DataQualityEventData, type DataQualityEventType } from './events.ts'
export { MAX_CELL_TEXT, truncateCell, truncateRow } from './present.ts'

/**
 * Mount the seam: resolve config (fail loud), open the report domain, publish
 * `ctx.dataQuality`, and register the three tools. With `enabled: false` the
 * plugin registers nothing and stays inert.
 * @param ctx - the plugin context (host).
 * @param config - raw plugin config.
 */
export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const resolved = resolveConfig(config)
  const logger = ctx.logger('data-quality')
  if (!resolved.enabled) {
    logger.info('disabled: enabled is false — no service or tools are mounted')
    return
  }

  let store: ReportStore | undefined
  let domain: Domain<typeof dataQualityDomainSpec> | undefined
  if (resolved.storeReports) {
    domain = await ctx.storageDomain.open(dataQualityDomainSpec)
    const reports = domain.table('reports')
    store = {
      put: async (record) => {
        const key = reportKeyOf(record)
        await reports.put(key, record)
        return key
      },
      get: (key) => reports.get(key),
    }
  }

  const service = new LocalDataQualityService(ctx, resolved, { store, now: Date.now })
  ctx.tools.register(defineProfileTool(service))
  ctx.tools.register(defineCleanTool(service))
  ctx.tools.register(defineVerifyTool(service))
  logger.info(`dsh-data-quality ${VERSION} mounted: ctx.dataQuality + data_profile/data_clean/data_verify`)

  if (domain !== undefined) {
    const handle = domain
    ctx.effect(() => async () => {
      await handle.close()
    })
  }
}

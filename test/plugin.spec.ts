/**
 * Plugin assembly tests over the REAL host seams (SessionStore, storage
 * domain, ToolRuntime): service publication, tool registration, the three
 * tool chains end-to-end, path confinement through the pipeline, durable
 * report persistence, and inert mounting when disabled.
 * @module dsh-data-quality/test/plugin.spec
 */

import { afterEach, describe, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mountBase, runTool, unmountBase, DIRTY_CSV, type BaseHarness } from './harness.ts'
import { dataQualityDomainSpec, type ReportRecord } from '../src/store.ts'
import type { ProfileReport } from '../src/profile.ts'
import type { CleanRunReport } from '../src/service.ts'
import type { VerifyReport } from '../src/verify.ts'

const fibers: Array<{ dispose(): Promise<void> }> = []
const bases: BaseHarness[] = []
afterEach(async () => {
  await Promise.all(fibers.splice(0).map((fiber) => fiber.dispose()))
  await Promise.all(bases.splice(0).map((base) => unmountBase(base)))
})

/** Mount the plugin on a harness context. */
async function mountPlugin(base: BaseHarness, config: Record<string, unknown> = {}) {
  const plugin = await import('../src/index.ts')
  const fiber = await base.ctx.plugin(plugin as never, config as never)
  fibers.push(fiber)
  return fiber
}

/** Seed the workspace with the dirty fixture. */
async function seedDirty(base: BaseHarness): Promise<void> {
  await writeFile(path.join(base.workspace, 'dirty.csv'), DIRTY_CSV)
}

/** Read a persisted report from the mounted domain. */
async function readReport(base: BaseHarness, key: string): Promise<ReportRecord | undefined> {
  const domain = base.ctx.storageDomain.get(dataQualityDomainSpec.name)
  if (domain === undefined) return undefined
  const table = domain.table('reports')
  return table.get(key) as ReportRecord | undefined
}

describe('apply', () => {
  it('publishes ctx.dataQuality and registers the four tools', async () => {
    const base = await mountBase('dq-register')
    bases.push(base)
    await mountPlugin(base)
    expect(base.ctx.dataQuality).toBeDefined()
    expect(typeof base.ctx.dataQuality.verifyCitations).toBe('function')
    for (const tool of ['data_profile', 'data_clean', 'data_verify', 'data_report']) {
      expect(base.ctx.tools.get(tool)).toBeDefined()
    }
  })

  it('stays inert when disabled', async () => {
    const base = await mountBase('dq-disabled')
    bases.push(base)
    await mountPlugin(base, { enabled: false })
    expect(base.ctx.tools.get('data_profile')).toBeUndefined()
    expect(base.ctx.tools.get('data_report')).toBeUndefined()
  })

  it('removes the four tools and ctx.dataQuality from the authoritative registries on dispose', async () => {
    const base = await mountBase('dq-dispose')
    bases.push(base)
    const fiber = await mountPlugin(base)
    expect(base.ctx.dataQuality).toBeDefined()
    expect(typeof base.ctx.dataQuality.verifyCitations).toBe('function')
    for (const tool of ['data_profile', 'data_clean', 'data_verify', 'data_report']) {
      expect(base.ctx.tools.get(tool), `${tool} before dispose`).toBeDefined()
    }

    await fiber.dispose()

    for (const tool of ['data_profile', 'data_clean', 'data_verify', 'data_report']) {
      expect(base.ctx.tools.get(tool), `${tool} after dispose`).toBeUndefined()
    }
    expect(base.ctx.tools.schemas().map((schema) => schema.name)).not.toContain('data_profile')
    expect(base.ctx.dataQuality, 'ctx.dataQuality after dispose').toBeUndefined()
  })

  it('runs data_profile through the real pipeline and persists the report', async () => {
    const base = await mountBase('dq-profile')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const result = await runTool(base, 'data_profile', { path: 'dirty.csv' })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as ProfileReport
    expect(value.rowCount).toBe(10)
    expect(value.columnCount).toBe(6)
    expect(value.duplicateRows).toBe(1)
    expect(value.reportKey).toBeDefined()
    const persisted = await readReport(base, value.reportKey as string)
    expect(persisted?.kind).toBe('profile')
    expect(persisted?.dataset).toBe('dirty.csv')
    // The rendered model-facing text carries the human summary.
    const text = result.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
    expect(text).toContain('10 rows x 6 columns')
  })

  it('runs data_clean end-to-end: writes a new file, never touches the source', async () => {
    const base = await mountBase('dq-clean')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const result = await runTool(base, 'data_clean', {
      path: 'dirty.csv',
      rules: [
        { rule: 'trim' },
        { rule: 'dedupe', columns: ['fund_code'] },
        { rule: 'normalize-unit', column: 'holding_value', factors: { 万: 10_000, 亿: 100_000_000 } },
        { rule: 'coerce-type', column: 'holding_value', to: 'number' },
        { rule: 'map-values', column: 'currency', map: { cny: 'CNY' } },
      ],
      outputPath: 'cleaned.csv',
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as CleanRunReport
    expect(value.inputRows).toBe(10)
    expect(value.outputRows).toBe(8)
    expect(value.logs).toHaveLength(5)
    expect(value.outputPath).toBe('cleaned.csv')
    // Source untouched; output written and re-parseable.
    expect(await readFile(path.join(base.workspace, 'dirty.csv'), 'utf8')).toBe(DIRTY_CSV)
    const written = await readFile(path.join(base.workspace, 'cleaned.csv'), 'utf8')
    expect(written).toContain('50000000')
    expect(written).not.toContain('万')
    // Preview is bounded and display-truncated.
    expect(value.preview.rows.length).toBeLessThanOrEqual(20)
    const persisted = await readReport(base, value.reportKey as string)
    expect(persisted?.kind).toBe('clean')
  })

  it('refuses to overwrite the input dataset', async () => {
    const base = await mountBase('dq-clean-overwrite')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const result = await runTool(base, 'data_clean', {
      path: 'dirty.csv',
      rules: [{ rule: 'trim' }],
      outputPath: 'dirty.csv',
    })
    expect(result.isError).toBe(true)
    if (!result.isError) return
    expect(result.error.message).toMatch(/overwrite the input dataset/)
  })

  it('runs data_verify: a failing dataset is a normal passed:false result', async () => {
    const base = await mountBase('dq-verify')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const result = await runTool(base, 'data_verify', {
      path: 'dirty.csv',
      rules: [
        { rule: 'not-null', column: 'nav' },
        { rule: 'unique', columns: ['fund_code'] },
        { rule: 'regex', column: 'fund_code', pattern: '^FUND\\d{3}$' },
      ],
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as VerifyReport
    expect(value.passed).toBe(false)
    expect(value.rules).toHaveLength(3)
    expect(value.rules[0]?.passed).toBe(false)
    expect(value.rules[2]?.passed).toBe(true)
    const persisted = await readReport(base, value.reportKey as string)
    expect(persisted?.kind).toBe('verify')
  })

  it('rejects path escapes through the tool pipeline', async () => {
    const base = await mountBase('dq-escape')
    bases.push(base)
    await mountPlugin(base)
    const result = await runTool(base, 'data_profile', { path: '../outside.csv' })
    expect(result.isError).toBe(true)
    if (!result.isError) return
    expect(result.error.message).toMatch(/outside the workspace/)
  })

  it('rejects oversized datasets loudly through the tool pipeline', async () => {
    const base = await mountBase('dq-oversize')
    bases.push(base)
    await mountPlugin(base, { maxRows: 5 })
    const rows = Array.from({ length: 20 }, (_, i) => `R${i},${i}`).join('\n')
    await writeFile(path.join(base.workspace, 'many.csv'), `id,v\n${rows}\n`)
    const result = await runTool(base, 'data_profile', { path: 'many.csv' })
    expect(result.isError).toBe(true)
    if (!result.isError) return
    expect(result.error.message).toMatch(/row cap/)
  })

  it('omits reportKey when storeReports is off', async () => {
    const base = await mountBase('dq-nostore')
    bases.push(base)
    await mountPlugin(base, { storeReports: false })
    await seedDirty(base)
    const result = await runTool(base, 'data_profile', { path: 'dirty.csv' })
    expect(result.isError).toBe(false)
    if (result.isError) return
    expect((result.value as unknown as ProfileReport).reportKey).toBeUndefined()
  })

  it('verifies citations through the service against the configured workspaceRoot', async () => {
    const base = await mountBase('dq-citations')
    bases.push(base)
    await seedDirty(base)
    await mountPlugin(base, { workspaceRoot: base.workspace })
    const result = await base.ctx.dataQuality.verifyCitations({
      dataset: 'dirty.csv',
      citations: [
        { id: 'c1', path: 'rows[0].fund_code', value: 'FUND001' },
        { id: 'c2', path: 'rows[1].nav', value: 0.987 },
        { id: 'c3', path: 'rows[99].nav', value: 1 },
      ],
    })
    expect(result.results.map((entry) => entry.status)).toEqual(['verified', 'verified', 'not-found'])
  })

  it('reads persisted reports back through data_report (by key and by kind)', async () => {
    const base = await mountBase('dq-report')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const profile = await runTool(base, 'data_profile', { path: 'dirty.csv' })
    expect(profile.isError).toBe(false)
    if (profile.isError) return
    const reportKey = (profile.value as unknown as ProfileReport).reportKey as string

    const byKey = await runTool(base, 'data_report', { key: reportKey })
    expect(byKey.isError).toBe(false)
    if (byKey.isError) return
    const byKeyValue = byKey.value as { key: string; records: Array<{ key: string; kind: string; report: Record<string, unknown> }> }
    expect(byKeyValue.records).toHaveLength(1)
    expect(byKeyValue.records[0]?.key).toBe(reportKey)
    expect(byKeyValue.records[0]?.kind).toBe('profile')
    expect((byKeyValue.records[0]?.report as { rowCount: number }).rowCount).toBe(10)

    const byKind = await runTool(base, 'data_report', { kind: 'profile' })
    expect(byKind.isError).toBe(false)
    if (byKind.isError) return
    const byKindValue = byKind.value as { kind: string; records: Array<{ key: string }> }
    expect(byKindValue.records.length).toBeGreaterThanOrEqual(1)
  })

  it('fails loud on an invalid or missing reportKey', async () => {
    const base = await mountBase('dq-report-missing')
    bases.push(base)
    await mountPlugin(base)
    const missing = await runTool(base, 'data_report', { key: '20260819000000000-profile-00000000' })
    expect(missing.isError).toBe(true)
    if (!missing.isError) return
    expect(missing.error.message).toMatch(/no persisted report/)

    const invalid = await runTool(base, 'data_report', { key: '../evil/key' })
    expect(invalid.isError).toBe(true)
    if (!invalid.isError) return
    expect(invalid.error.message).toMatch(/invalid reportKey/)
  })

  it('data_clean dryRun returns the plan and expected contract/diff without writing', async () => {
    const base = await mountBase('dq-clean-dryrun')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const result = await runTool(base, 'data_clean', {
      path: 'dirty.csv',
      rules: [{ rule: 'trim' }, { rule: 'dedupe', columns: ['fund_code'] }],
      outputPath: 'cleaned.csv',
      dryRun: true,
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as CleanRunReport
    expect(value.dryRun).toBe(true)
    expect(value.outputPath).toBeUndefined()
    expect(value.reportKey).toBeUndefined()
    expect(value.contract.columnDecisions.length).toBeGreaterThan(0)
    expect(value.diffPreview).toBeDefined()
    expect(value.diffPreview?.before.rowCount).toBe(10)
    expect(value.diffPreview?.after.rowCount).toBe(8)
    // No cleaned output file was written.
    await expect(readFile(path.join(base.workspace, 'cleaned.csv'), 'utf8')).rejects.toThrow()
  })

  it('data_profile industryPreset feeds the scorecard accuracy dimension', async () => {
    const base = await mountBase('dq-profile-preset')
    bases.push(base)
    await mountPlugin(base)
    await writeFile(path.join(base.workspace, 'fund.csv'), 'fund_code,fund_name,nav,nav_date,holding_value,currency\nF1,Alpha,1.2,2026-08-01,1000,CNY\n')
    const result = await runTool(base, 'data_profile', { path: 'fund.csv', industryPreset: 'fund' })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const scorecard = (result.value as unknown as ProfileReport).scorecard
    const accuracy = scorecard.dimensions.find((dimension) => dimension.name === 'accuracy')
    expect(accuracy?.score).toBe(1)

    const unknown = await runTool(base, 'data_profile', { path: 'fund.csv', industryPreset: 'nope' })
    expect(unknown.isError).toBe(true)
    if (!unknown.isError) return
    expect(unknown.error.message).toMatch(/must be one of/)

    // The service-level path also fails loud on an unknown preset.
    await expect(
      base.ctx.dataQuality.profileDataset({ dataset: 'fund.csv', industryPreset: 'nope', workspace: base.workspace }),
    ).rejects.toThrowError(/unknown industryPreset/)
  })

  it('data_verify reconciles expectations through the tool (service + tool layer)', async () => {
    const base = await mountBase('dq-verify-expectations')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const result = await runTool(base, 'data_verify', {
      path: 'dirty.csv',
      rules: [{ rule: 'not-null', column: 'fund_code' }],
      expectations: [
        { metric: 'rowCount', expected: 10 },
        { metric: 'nullCount', column: 'nav', expected: 1 },
        { metric: 'uniqueCount', column: 'fund_code', expected: 8 },
      ],
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as VerifyReport
    expect(value.expectations).toHaveLength(3)
    expect(value.expectations.every((expectation) => expectation.passed)).toBe(true)
    expect(value.passed).toBe(true)
    const persisted = await readReport(base, value.reportKey as string)
    expect(persisted?.kind).toBe('verify')
    expect((persisted?.report.expectations as unknown[] | undefined)?.length).toBe(3)
  })

  it('data_verify expectations fail as a normal passed:false verdict (never a tool error)', async () => {
    const base = await mountBase('dq-verify-expectations-mismatch')
    bases.push(base)
    await mountPlugin(base)
    await seedDirty(base)
    const result = await runTool(base, 'data_verify', {
      path: 'dirty.csv',
      rules: [{ rule: 'not-null', column: 'fund_code' }],
      expectations: [{ metric: 'rowCount', expected: 999 }],
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as VerifyReport
    expect(value.passed).toBe(false)
    expect(value.expectations[0]?.passed).toBe(false)
    expect(value.expectations[0]?.actual).toBe(10)
    expect(value.expectations[0]?.expected).toBe(999)
  })

  it('dryRun combined with storeReports:false returns no reportKey and writes nothing', async () => {
    const base = await mountBase('dq-dryrun-nostore')
    bases.push(base)
    await mountPlugin(base, { storeReports: false })
    await seedDirty(base)
    const result = await runTool(base, 'data_clean', {
      path: 'dirty.csv',
      rules: [{ rule: 'trim' }],
      outputPath: 'cleaned.csv',
      dryRun: true,
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as CleanRunReport
    expect(value.dryRun).toBe(true)
    expect(value.reportKey).toBeUndefined()
    expect(value.diffPreview).toBeDefined()
    await expect(readFile(path.join(base.workspace, 'cleaned.csv'), 'utf8')).rejects.toThrow()
  })

  it('data_report reads back a profile produced with industryPreset (accuracy preserved)', async () => {
    const base = await mountBase('dq-report-preset')
    bases.push(base)
    await mountPlugin(base)
    await writeFile(path.join(base.workspace, 'fund.csv'), 'fund_code,fund_name,nav,nav_date,holding_value,currency\nF1,Alpha,1.2,2026-08-01,1000,CNY\n')
    const profile = await runTool(base, 'data_profile', { path: 'fund.csv', industryPreset: 'fund' })
    expect(profile.isError).toBe(false)
    if (profile.isError) return
    const reportKey = (profile.value as unknown as ProfileReport).reportKey as string

    const report = await runTool(base, 'data_report', { key: reportKey })
    expect(report.isError).toBe(false)
    if (report.isError) return
    const record = (report.value as { records: Array<{ report: { scorecard: { dimensions: Array<{ name: string; score: number | null }> } } }> }).records[0]
    const accuracy = record?.report.scorecard.dimensions.find((dimension) => dimension.name === 'accuracy')
    expect(accuracy?.score).toBe(1)
  })
})

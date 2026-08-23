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
  it('publishes ctx.dataQuality and registers the three tools', async () => {
    const base = await mountBase('dq-register')
    bases.push(base)
    await mountPlugin(base)
    expect(base.ctx.dataQuality).toBeDefined()
    expect(typeof base.ctx.dataQuality.verifyCitations).toBe('function')
    for (const tool of ['data_profile', 'data_clean', 'data_verify']) {
      expect(base.ctx.tools.get(tool)).toBeDefined()
    }
  })

  it('stays inert when disabled', async () => {
    const base = await mountBase('dq-disabled')
    bases.push(base)
    await mountPlugin(base, { enabled: false })
    expect(base.ctx.tools.get('data_profile')).toBeUndefined()
  })

  it('removes the three tools and ctx.dataQuality from the authoritative registries on dispose', async () => {
    const base = await mountBase('dq-dispose')
    bases.push(base)
    const fiber = await mountPlugin(base)
    expect(base.ctx.dataQuality).toBeDefined()
    expect(typeof base.ctx.dataQuality.verifyCitations).toBe('function')
    for (const tool of ['data_profile', 'data_clean', 'data_verify']) {
      expect(base.ctx.tools.get(tool), `${tool} before dispose`).toBeDefined()
    }

    await fiber.dispose()

    for (const tool of ['data_profile', 'data_clean', 'data_verify']) {
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
})

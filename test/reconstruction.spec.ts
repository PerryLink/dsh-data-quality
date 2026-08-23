/**
 * Model-visible ⟺ logged reconstruction tests (C5): every run's tool result
 * is a faithful projection into a `data-quality/*` session event and is fully
 * reconstructable from the durable storage-domain report the event's
 * `reportKey` points at. A recording session captures the append the provider
 * would emit, while the real storage seam serves the persisted report.
 * @module dsh-data-quality/test/reconstruction.spec
 */

import { afterEach, describe, expect, it } from 'vitest'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { KNOWN_SESSION_EVENT_TYPES, type Session } from '@deepseek-ai/dsh-session'
import { DATA_QUALITY_EVENT_TYPES, type DataQualityEventData } from '../src/events.ts'
import { dataQualityDomainSpec, type ReportRecord } from '../src/store.ts'
import { mountBase, runTool, unmountBase, DIRTY_CSV, type BaseHarness } from './harness.ts'

const fibers: Array<{ dispose(): Promise<void> }> = []
const bases: BaseHarness[] = []
/** The event gate reads the shared known-type set as a mutable Set at runtime. */
const KNOWN_MUTABLE = KNOWN_SESSION_EVENT_TYPES as unknown as Set<string>
afterEach(async () => {
  for (const type of DATA_QUALITY_EVENT_TYPES) KNOWN_MUTABLE.delete(type)
  await Promise.all(fibers.splice(0).map((fiber) => fiber.dispose()))
  await Promise.all(bases.splice(0).map((base) => unmountBase(base)))
})

/** Mount the plugin and force the plain-append event path via the known-type set. */
async function mountPluginWithEvents(base: BaseHarness): Promise<void> {
  const plugin = await import('../src/index.ts')
  const fiber = await base.ctx.plugin(plugin as never, {} as never)
  fibers.push(fiber)
  for (const type of DATA_QUALITY_EVENT_TYPES) KNOWN_MUTABLE.add(type)
}

/** Read a persisted report from the mounted domain. */
async function readReport(base: BaseHarness, key: string): Promise<ReportRecord | undefined> {
  const domain = base.ctx.storageDomain.get(dataQualityDomainSpec.name)
  if (domain === undefined) return undefined
  return domain.table('reports').get(key) as ReportRecord | undefined
}

/** Replace the agent's session with one that records every append. */
function installRecordingSession(base: BaseHarness): Array<[string, DataQualityEventData]> {
  const calls: Array<[string, DataQualityEventData]> = []
  const recordingSession = {
    header: { cwd: base.workspace },
    append(type: string, data: DataQualityEventData): void {
      calls.push([type, data])
    },
  } as unknown as Session
  ;(base.agent as unknown as { session: Session }).session = recordingSession
  return calls
}

/** Strip `reportKey` from a canonical tool value so it can compare with the persisted report. */
function withoutReportKey(value: unknown): Record<string, unknown> {
  const { reportKey, ...rest } = value as { reportKey?: string } & Record<string, unknown>
  void reportKey
  return rest
}

describe('model-visible ⟺ logged (C5)', () => {
  it('profile: event summary is a projection and the report reconstructs the result', async () => {
    const base = await mountBase('dq-reconstruct-profile')
    bases.push(base)
    await mountPluginWithEvents(base)
    await writeFile(path.join(base.workspace, 'dirty.csv'), DIRTY_CSV)
    const calls = installRecordingSession(base)

    const result = await runTool(base, 'data_profile', { path: 'dirty.csv' })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as { rowCount: number; columnCount: number; reportKey?: string }

    // Projection: the appended event carries the same counts and dataset.
    expect(calls).toHaveLength(1)
    const [type, data] = calls[0] as [string, DataQualityEventData]
    expect(type).toBe('data-quality/profile')
    expect(data.kind).toBe('profile')
    expect(data.dataset).toBe('dirty.csv')
    expect(data.summary.rows).toBe(value.rowCount)
    expect(data.summary.columns).toBe(value.columnCount)

    // Reconstruction: reportKey resolves to the full report the model saw.
    expect(value.reportKey).toBeDefined()
    const record = await readReport(base, value.reportKey as string)
    expect(record?.kind).toBe('profile')
    expect(record?.report).toEqual(withoutReportKey(value))
  })

  it('clean: event summary is a projection and the report reconstructs the result (including preview)', async () => {
    const base = await mountBase('dq-reconstruct-clean')
    bases.push(base)
    await mountPluginWithEvents(base)
    await writeFile(path.join(base.workspace, 'dirty.csv'), DIRTY_CSV)
    const calls = installRecordingSession(base)

    const result = await runTool(base, 'data_clean', { path: 'dirty.csv', rules: [{ rule: 'trim' }] })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as {
      outputRows: number
      logs: unknown[]
      preview: { columns: string[]; rows: unknown[] }
      reportKey?: string
    }

    expect(calls).toHaveLength(1)
    const [type, data] = calls[0] as [string, DataQualityEventData]
    expect(type).toBe('data-quality/clean')
    expect(data.summary.rows).toBe(value.outputRows)
    expect(data.summary.columns).toBe(value.preview.columns.length)
    expect(data.summary.rules).toBe(value.logs.length)

    expect(value.reportKey).toBeDefined()
    const record = await readReport(base, value.reportKey as string)
    expect(record?.kind).toBe('clean')
    // The persisted report now carries the preview, so the canonical value is
    // fully reconstructable from the log + storage report.
    expect(record?.report).toEqual(withoutReportKey(value))
    expect((record?.report.preview as { rows: unknown[] }).rows).toHaveLength(value.preview.rows.length)
  })

  it('verify: event summary is a projection and the report reconstructs the result', async () => {
    const base = await mountBase('dq-reconstruct-verify')
    bases.push(base)
    await mountPluginWithEvents(base)
    await writeFile(path.join(base.workspace, 'dirty.csv'), DIRTY_CSV)
    const calls = installRecordingSession(base)

    const result = await runTool(base, 'data_verify', {
      path: 'dirty.csv',
      rules: [{ rule: 'not-null', column: 'fund_code' }],
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as {
      passed: boolean
      rowCount: number
      rules: Array<{ passed: boolean }>
      reportKey?: string
    }

    expect(calls).toHaveLength(1)
    const [type, data] = calls[0] as [string, DataQualityEventData]
    expect(type).toBe('data-quality/verify')
    expect(data.summary.rows).toBe(value.rowCount)
    expect(data.summary.rules).toBe(value.rules.length)
    expect(data.summary.passed).toBe(value.passed)
    expect(data.summary.failedRules).toBe(value.rules.filter((rule) => !rule.passed).length)

    expect(value.reportKey).toBeDefined()
    const record = await readReport(base, value.reportKey as string)
    expect(record?.kind).toBe('verify')
    expect(record?.report).toEqual(withoutReportKey(value))
  })
})

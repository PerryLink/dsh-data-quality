/**
 * Config resolution and store key tests: defaults, fail-loud bounds, and the
 * deterministic report-key format.
 * @module dsh-data-quality/test/config.spec
 */

import { describe, expect, it } from 'vitest'
import { Config, resolveConfig } from '../src/config.ts'
import { reportKeyOf } from '../src/store.ts'

describe('resolveConfig', () => {
  it('fills the documented defaults', () => {
    const config = resolveConfig()
    expect(config).toEqual({
      enabled: true,
      maxRows: 200_000,
      maxFileSizeMB: 64,
      defaultTolerance: 1e-9,
      evidenceRowLimit: 20,
      allowedExtensions: ['.csv', '.tsv', '.json', '.jsonl'],
      workspaceRoot: '',
      storeReports: true,
      scorecardWeights: { completeness: 1, uniqueness: 1, validity: 1, consistency: 1, timeliness: 1, accuracy: 1 },
    })
  })

  it('fails loud on invalid bounds', () => {
    expect(() => resolveConfig({ maxRows: 0 })).toThrowError(/maxRows/)
    expect(() => resolveConfig({ maxRows: 1.5 })).toThrowError(/maxRows/)
    expect(() => resolveConfig({ maxFileSizeMB: -1 })).toThrowError(/maxFileSizeMB/)
    expect(() => resolveConfig({ defaultTolerance: 2 })).toThrowError(/defaultTolerance/)
    expect(() => resolveConfig({ evidenceRowLimit: -3 })).toThrowError(/evidenceRowLimit/)
    expect(() => resolveConfig({ allowedExtensions: [] })).toThrowError(/must not be empty/)
    expect(() => resolveConfig({ allowedExtensions: ['csv'] })).toThrowError(/dot-prefixed/)
  })

  it('keeps explicit values', () => {
    const config = resolveConfig({ maxRows: 500, storeReports: false, workspaceRoot: '/data' })
    expect(config.maxRows).toBe(500)
    expect(config.storeReports).toBe(false)
    expect(config.workspaceRoot).toBe('/data')
  })

  it('fails loud on out-of-range numeric bounds', () => {
    // maxRows must be a positive SAFE integer: non-integers, non-safe integers,
    // zero, and NaN all reject.
    expect(() => resolveConfig({ maxRows: Number.MAX_SAFE_INTEGER + 1 })).toThrowError(/maxRows/)
    expect(() => resolveConfig({ maxRows: Number.NaN })).toThrowError(/maxRows/)
    // maxFileSizeMB upper bound is 1024; zero and non-finite values reject.
    expect(() => resolveConfig({ maxFileSizeMB: 1025 })).toThrowError(/maxFileSizeMB/)
    expect(() => resolveConfig({ maxFileSizeMB: 0 })).toThrowError(/maxFileSizeMB/)
    expect(() => resolveConfig({ maxFileSizeMB: Number.NaN })).toThrowError(/maxFileSizeMB/)
    // defaultTolerance is bounded to [0, 1]; negative and NaN reject.
    expect(() => resolveConfig({ defaultTolerance: -0.1 })).toThrowError(/defaultTolerance/)
    expect(() => resolveConfig({ defaultTolerance: Number.NaN })).toThrowError(/defaultTolerance/)
  })

  it('fails loud on malformed allowedExtensions entries', () => {
    expect(() => resolveConfig({ allowedExtensions: ['.CSV'] })).toThrowError(/dot-prefixed lowercase/)
    expect(() => resolveConfig({ allowedExtensions: ['.csv '] })).toThrowError(/dot-prefixed lowercase/)
    expect(() => resolveConfig({ allowedExtensions: ['..csv'] })).toThrowError(/dot-prefixed lowercase/)
    expect(() => resolveConfig({ allowedExtensions: ['.csv', 'xlsx'] })).toThrowError(/dot-prefixed lowercase/)
  })

  it('resolves scorecard weights with equal defaults and rejects non-negative violations', () => {
    expect(resolveConfig().scorecardWeights).toEqual({ completeness: 1, uniqueness: 1, validity: 1, consistency: 1, timeliness: 1, accuracy: 1 })
    expect(resolveConfig({ scorecardWeights: { completeness: 2 } }).scorecardWeights.completeness).toBe(2)
    expect(resolveConfig({ scorecardWeights: { completeness: 0 } }).scorecardWeights.completeness).toBe(0)
    expect(() => resolveConfig({ scorecardWeights: { accuracy: -1 } })).toThrowError(/scorecardWeights\.accuracy/)
    expect(() => resolveConfig({ scorecardWeights: { validity: Number.NaN } })).toThrowError(/scorecardWeights\.validity/)
  })
})

describe('Config schema', () => {
  it('validates types and fills defaults at the loader boundary', () => {
    const resolved = Config({})
    expect(resolved.maxRows).toBe(200_000)
    expect(resolved.allowedExtensions).toEqual(['.csv', '.tsv', '.json', '.jsonl'])
    expect(resolved.storeReports).toBe(true)
    expect(resolved.scorecardWeights?.completeness).toBe(1)
  })

  it('rejects wrong-typed values loudly', () => {
    expect(() => Config({ maxRows: '200000' } as never)).toThrowError()
    expect(() => Config({ maxFileSizeMB: '64' } as never)).toThrowError()
    expect(() => Config({ allowedExtensions: '.csv' } as never)).toThrowError()
    expect(() => Config({ storeReports: 'yes' } as never)).toThrowError()
  })
})

describe('reportKeyOf', () => {
  it('is deterministic and filename-safe', () => {
    const key = reportKeyOf({ kind: 'profile', at: Date.UTC(2026, 7, 19, 1, 2, 3, 4), dataset: 'data/dirty.csv', report: {} })
    expect(key).toMatch(/^20260819010203004-profile-[0-9a-f]{8}$/)
    expect(reportKeyOf({ kind: 'profile', at: Date.UTC(2026, 7, 19, 1, 2, 3, 4), dataset: 'data/dirty.csv', report: {} })).toBe(key)
    expect(reportKeyOf({ kind: 'clean', at: Date.UTC(2026, 7, 19, 1, 2, 3, 4), dataset: 'data/dirty.csv', report: {} })).not.toBe(key)
  })
})

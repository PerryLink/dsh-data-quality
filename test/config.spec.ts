/**
 * Config resolution and store key tests: defaults, fail-loud bounds, and the
 * deterministic report-key format.
 * @module dsh-data-quality/test/config.spec
 */

import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'
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
})

describe('reportKeyOf', () => {
  it('is deterministic and filename-safe', () => {
    const key = reportKeyOf({ kind: 'profile', at: Date.UTC(2026, 7, 19, 1, 2, 3, 4), dataset: 'data/dirty.csv', report: {} })
    expect(key).toMatch(/^20260819010203004-profile-[0-9a-f]{8}$/)
    expect(reportKeyOf({ kind: 'profile', at: Date.UTC(2026, 7, 19, 1, 2, 3, 4), dataset: 'data/dirty.csv', report: {} })).toBe(key)
    expect(reportKeyOf({ kind: 'clean', at: Date.UTC(2026, 7, 19, 1, 2, 3, 4), dataset: 'data/dirty.csv', report: {} })).not.toBe(key)
  })
})

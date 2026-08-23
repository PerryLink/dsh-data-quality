/**
 * Profiling engine tests over in-memory tables: type inference, missingness,
 * cardinality, numeric distribution, outliers, duplicates, and sampling.
 * @module dsh-data-quality/test/profile.spec
 */

import { describe, expect, it } from 'vitest'
import { countDuplicateRows, detectDuplicateRows, numericProfile, profileTable, renderProfileText } from '../src/profile.ts'
import { parseDelimited } from '../src/dataset.ts'
import { resolveConfig } from '../src/config.ts'
import { DIRTY_CSV } from './harness.ts'

const config = resolveConfig()
const GENERATED_AT = Date.UTC(2026, 7, 19, 8, 0, 0)

/** Parse the shared dirty fixture. */
function dirtyTable() {
  return parseDelimited(DIRTY_CSV, ',', config)
}

describe('numericProfile', () => {
  it('computes distribution and IQR outliers', () => {
    const profile = numericProfile([1, 2, 3, 4, 5, 100])
    expect(profile).toBeDefined()
    expect(profile?.min).toBe(1)
    expect(profile?.max).toBe(100)
    expect(profile?.median).toBe(3.5)
    expect(profile?.outliers).toBe(1)
  })

  it('is undefined for empty input', () => {
    expect(numericProfile([])).toBeUndefined()
  })
})

describe('countDuplicateRows', () => {
  it('counts full-row duplicates excluding first occurrences', () => {
    expect(countDuplicateRows(dirtyTable())).toBe(1)
  })
})

describe('detectDuplicateRows', () => {
  it('reports the duplicate rate and 0-based sample indexes, capped by the limit', () => {
    const table = parseDelimited('a,b\n1,x\n1,x\n2,y\n1,x\n', ',', config)
    const detection = detectDuplicateRows(table, { sampleLimit: 1 })
    expect(detection.duplicateRows).toBe(2)
    expect(detection.duplicateRate).toBeCloseTo(0.5, 5)
    expect(detection.duplicateSampleRowIndexes).toEqual([1])
  })

  it('uses the full-row sha256 content key (column order matters)', () => {
    const sameContent = parseDelimited('a,b\n1,x\n1,x\n', ',', config)
    expect(detectDuplicateRows(sameContent, { sampleLimit: 10 }).duplicateRows).toBe(1)
    // Different cell content in the same columns is not a duplicate.
    const differentContent = parseDelimited('a,b\n1,x\n2,y\n', ',', config)
    expect(detectDuplicateRows(differentContent, { sampleLimit: 10 }).duplicateRows).toBe(0)
  })

  it('is deterministic and rejects an invalid sample limit', () => {
    const table = parseDelimited('a\n1\n1\n1\n', ',', config)
    expect(detectDuplicateRows(table, { sampleLimit: 5 })).toEqual(detectDuplicateRows(table, { sampleLimit: 5 }))
    expect(() => detectDuplicateRows(table, { sampleLimit: 0 })).toThrowError(/sampleLimit/)
  })
})

describe('profileTable', () => {
  it('infers column types and flags suspicions', () => {
    const report = profileTable(dirtyTable(), { dataset: 'dirty.csv', generatedAt: GENERATED_AT })
    expect(report.rowCount).toBe(10)
    expect(report.columnCount).toBe(6)
    expect(report.sampled).toBe(false)
    expect(report.duplicateRows).toBe(1)
    expect(report.duplicateRate).toBeCloseTo(0.1, 5)
    expect(report.duplicateSampleRowIndexes).toEqual([8])
    expect(report.scorecard.dimensions.map((dimension) => dimension.name)).toEqual([
      'completeness',
      'uniqueness',
      'validity',
      'consistency',
      'timeliness',
      'accuracy',
    ])

    const byName = new Map(report.columns.map((column) => [column.name, column]))
    expect(byName.get('nav')?.inferredType).toBe('mixed')
    expect(byName.get('nav')?.notes[0]).toMatch(/mixed types/)
    expect(byName.get('nav_date')?.inferredType).toBe('mixed')
    expect(byName.get('currency')?.inferredType).toBe('string')
    expect(byName.get('currency')?.topValues?.[0]).toEqual({ value: 'CNY', count: 8 })
    expect(byName.get('nav')?.missing).toBe(1)
    expect(byName.get('holding_value')?.missing).toBe(1)
    expect(byName.get('fund_code')?.unique).toBe(8)
  })

  it('computes numeric distributions for numeric columns', () => {
    const table = parseDelimited('x\n1\n2\n3\n4\n', ',', config)
    const report = profileTable(table, { dataset: 'x.csv', generatedAt: GENERATED_AT })
    const column = report.columns[0]
    expect(column?.inferredType).toBe('number')
    expect(column?.numeric?.count).toBe(4)
    expect(column?.numeric?.distinct).toBe(4)
    expect(column?.numeric?.min).toBe(1)
    expect(column?.numeric?.max).toBe(4)
    expect(column?.numeric?.p25).toBe(1.75)
    expect(column?.numeric?.p75).toBe(3.25)
    expect(column?.numeric?.mean).toBe(2.5)
  })

  it('sampling is deterministic and bounded', () => {
    const table = dirtyTable()
    const first = profileTable(table, { dataset: 'dirty.csv', sample: 4, generatedAt: GENERATED_AT })
    const second = profileTable(table, { dataset: 'dirty.csv', sample: 4, generatedAt: GENERATED_AT })
    expect(first).toEqual(second)
    expect(first.sampled).toBe(true)
    expect(first.profiledRows).toBe(4)
    expect(first.rowCount).toBe(10)
    // Duplicate detection still covers the full table.
    expect(first.duplicateRows).toBe(1)
  })

  it('marks all-missing columns as empty', () => {
    const table = parseDelimited('a,b\n,\n,\n', ',', config)
    const report = profileTable(table, { dataset: 'empty.csv', generatedAt: GENERATED_AT })
    expect(report.columns[0]?.inferredType).toBe('empty')
  })

  it('renders a human-readable summary', () => {
    const report = profileTable(dirtyTable(), { dataset: 'dirty.csv', generatedAt: GENERATED_AT })
    const text = renderProfileText(report)
    expect(text).toContain('10 rows x 6 columns')
    expect(text).toContain('Duplicate rows: 1')
    expect(text).toContain('nav: mixed')
  })
})

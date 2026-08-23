/**
 * DAMA six-dimension scorecard engine tests: completeness, uniqueness,
 * validity, consistency (date-format ratio), timeliness (future-dated), and
 * the limited accuracy definition (declared-schema agreement, never
 * fabricated). Pure-engine tests over in-memory tables.
 * @module dsh-data-quality/test/scorecard.spec
 */

import { describe, expect, it } from 'vitest'
import { computeScorecard, type DataQualityScorecard, type ScorecardDimensionName } from '../src/scorecard.ts'
import { parseDelimited } from '../src/dataset.ts'
import { resolveConfig } from '../src/config.ts'

const config = resolveConfig()
/** Fixed clock: 2026-08-19T00:00:00Z. */
const NOW = Date.UTC(2026, 7, 19)

/** Parse CSV text into a table. */
function tableOf(csv: string) {
  return parseDelimited(csv, ',', config)
}

/** Score of one dimension by name, or `undefined`. */
function scoreOf(scorecard: DataQualityScorecard, name: ScorecardDimensionName): number | null | undefined {
  return scorecard.dimensions.find((dimension) => dimension.name === name)?.score
}

describe('computeScorecard', () => {
  it('scores completeness and uniqueness on a full table', () => {
    const table = tableOf('a,b\n1,x\n2,y\n1,x\n')
    const scorecard = computeScorecard(table, { now: NOW, duplicateRows: 1 })
    expect(scoreOf(scorecard, 'completeness')).toBe(1)
    expect(scoreOf(scorecard, 'uniqueness')).toBeCloseTo(2 / 3, 5)
    expect(scorecard.overall).not.toBeNull()
  })

  it('reports undetermined dimensions for empty datasets', () => {
    const table = tableOf('a,b\n,\n,\n')
    const scorecard = computeScorecard(table, { now: NOW, duplicateRows: 1 })
    expect(scoreOf(scorecard, 'completeness')).toBe(0)
    expect(scoreOf(scorecard, 'validity')).toBeNull()
    expect(scoreOf(scorecard, 'consistency')).toBeNull()
    expect(scoreOf(scorecard, 'timeliness')).toBeNull()
    expect(scoreOf(scorecard, 'accuracy')).toBeNull()
  })

  it('lowers validity when a column mixes types', () => {
    const table = tableOf('a\n1\n2\nabc\n')
    const scorecard = computeScorecard(table, { now: NOW, duplicateRows: 0 })
    expect(scoreOf(scorecard, 'validity')).toBeCloseTo(2 / 3, 5)
  })

  it('lowers consistency but not validity for mixed date formats', () => {
    const table = tableOf('d\n2026-08-01\n2026/08/02\n2026-08-03\n')
    const scorecard = computeScorecard(table, { now: NOW, duplicateRows: 0 })
    expect(scoreOf(scorecard, 'validity')).toBe(1)
    expect(scoreOf(scorecard, 'consistency')).toBeCloseTo(2 / 3, 5)
  })

  it('lowers timeliness for future-dated cells and reports null without dates', () => {
    const future = tableOf('d\n2026-08-01\n2027-01-01\n')
    const withDates = computeScorecard(future, { now: NOW, duplicateRows: 0 })
    expect(scoreOf(withDates, 'timeliness')).toBeCloseTo(0.5, 5)

    const noDates = tableOf('a\nx\ny\n')
    const withoutDates = computeScorecard(noDates, { now: NOW, duplicateRows: 0 })
    expect(scoreOf(withoutDates, 'timeliness')).toBeNull()
  })

  it('keeps accuracy undetermined without a declared schema and scores it when given one', () => {
    const table = tableOf('a,d\n1,2026-08-01\n2,2026-08-02\n')
    const undetermined = computeScorecard(table, { now: NOW, duplicateRows: 0 })
    expect(scoreOf(undetermined, 'accuracy')).toBeNull()

    const matching = computeScorecard(table, { now: NOW, duplicateRows: 0, declaredSchema: { a: 'number', d: 'date' } })
    expect(scoreOf(matching, 'accuracy')).toBe(1)

    const mismatching = computeScorecard(table, { now: NOW, duplicateRows: 0, declaredSchema: { a: 'date', d: 'number' } })
    expect(scoreOf(mismatching, 'accuracy')).toBe(0)
  })

  it('is deterministic for identical inputs', () => {
    const table = tableOf('a\n1\n2\n1\n')
    const first = computeScorecard(table, { now: NOW, duplicateRows: 1 })
    const second = computeScorecard(table, { now: NOW, duplicateRows: 1 })
    expect(first).toEqual(second)
  })

  it('computes a weighted overall from the injected weights', () => {
    const table = tableOf('a\n1\n2\nabc\n')
    const equal = computeScorecard(table, { now: NOW, duplicateRows: 0 })
    expect(equal.weightedOverall).toBe(equal.overall)
    const weighted = computeScorecard(table, {
      now: NOW,
      duplicateRows: 0,
      weights: { completeness: 1, uniqueness: 1, validity: 1, consistency: 0, timeliness: 0, accuracy: 0 },
    })
    expect(weighted.weightedOverall).toBeCloseTo((1 + 1 + 2 / 3) / 3, 5)
  })

  it('handles a zero-row table without fabricating scores', () => {
    const table = parseDelimited('a,b\n', ',', config)
    const scorecard = computeScorecard(table, { now: NOW, duplicateRows: 0 })
    expect(scoreOf(scorecard, 'completeness')).toBeNull()
    expect(scoreOf(scorecard, 'uniqueness')).toBeNull()
    expect(scoreOf(scorecard, 'validity')).toBeNull()
    expect(scoreOf(scorecard, 'consistency')).toBeNull()
    expect(scoreOf(scorecard, 'timeliness')).toBeNull()
    expect(scorecard.overall).toBeNull()
    expect(scorecard.weightedOverall).toBeNull()
  })

  it('scores a single-column table without throwing', () => {
    const table = parseDelimited('a\n1\n2\n3\n', ',', config)
    const scorecard = computeScorecard(table, { now: NOW, duplicateRows: 0 })
    expect(scoreOf(scorecard, 'completeness')).toBe(1)
    expect(scoreOf(scorecard, 'uniqueness')).toBe(1)
    expect(scoreOf(scorecard, 'validity')).toBe(1)
    expect(scoreOf(scorecard, 'consistency')).toBe(1)
  })
})

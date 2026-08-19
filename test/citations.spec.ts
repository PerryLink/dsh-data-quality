/**
 * Citation-checking tests: the frozen `verifyCitations` semantics — all four
 * statuses (verified / mismatch / not-found / unverifiable), tolerance
 * handling, and locator parsing.
 * @module dsh-data-quality/test/citations.spec
 */

import { describe, expect, it } from 'vitest'
import { checkCitations, parseLocator } from '../src/verify.ts'
import type { DocumentRoot } from '../src/dataset.ts'
import { parseDelimited } from '../src/dataset.ts'
import { resolveConfig } from '../src/config.ts'

const config = resolveConfig()
const DEFAULT_TOLERANCE = 1e-9

/** CSV table document root for locator tests. */
function tableRoot(): DocumentRoot {
  const table = parseDelimited('fund_code,nav\nFUND001,1.234\nFUND002,oops\n', ',', config)
  return { kind: 'table', columns: table.columns, rows: table.rows }
}

/** JSON document root with both a summary and rows. */
function jsonRoot(): DocumentRoot {
  return {
    kind: 'json',
    value: {
      summary: { annualReturn: 0.1234, fundCount: 8 },
      rows: [{ nav: 1.234 }, { nav: 'not-a-number' }],
    },
  }
}

describe('parseLocator', () => {
  it('parses dotted keys and bracket indices', () => {
    expect(parseLocator('rows[3].nav')).toEqual([
      { key: 'rows', indices: [3] },
      { key: 'nav', indices: [] },
    ])
    expect(parseLocator('summary.annualReturn')).toEqual([
      { key: 'summary', indices: [] },
      { key: 'annualReturn', indices: [] },
    ])
    expect(parseLocator('[0].x')).toEqual([
      { key: undefined, indices: [0] },
      { key: 'x', indices: [] },
    ])
  })

  it('rejects unparsable segments', () => {
    expect(() => parseLocator('rows[].nav')).toThrowError(/unparsable/)
    expect(() => parseLocator('')).toThrowError(/must not be empty/)
  })
})

describe('checkCitations', () => {
  it('verifies numeric citations within relative tolerance (CSV string cells parse)', () => {
    const result = checkCitations(tableRoot(), [
      { id: 'a', path: 'rows[0].nav', value: 1.234 },
      { id: 'b', path: 'rows[0].nav', value: 1.2345, tolerance: 0.01 },
      { id: 'c', path: 'rows[0].fund_code', value: 'FUND001' },
    ], DEFAULT_TOLERANCE)
    expect(result.results.map((entry) => entry.status)).toEqual(['verified', 'verified', 'verified'])
  })

  it('reports mismatch beyond tolerance and for different strings', () => {
    const result = checkCitations(tableRoot(), [
      { id: 'a', path: 'rows[0].nav', value: 9.99 },
      { id: 'b', path: 'rows[0].fund_code', value: 'FUND999' },
    ], DEFAULT_TOLERANCE)
    expect(result.results[0]?.status).toBe('mismatch')
    expect(result.results[0]?.actual).toBe(1.234)
    expect(result.results[1]?.status).toBe('mismatch')
    expect(result.results[1]?.actual).toBe('FUND001')
  })

  it('reports not-found for missing locations and invalid locators', () => {
    const result = checkCitations(tableRoot(), [
      { id: 'a', path: 'rows[99].nav', value: 1 },
      { id: 'b', path: 'rows[x].nav', value: 1 },
      { id: 'c', path: 'nope.nav', value: 1 },
    ], DEFAULT_TOLERANCE)
    expect(result.results.map((entry) => entry.status)).toEqual(['not-found', 'not-found', 'not-found'])
  })

  it('reports unverifiable for incomparable type pairs', () => {
    const numericVsText = checkCitations(tableRoot(), [
      { id: 'a', path: 'rows[1].nav', value: 1.5 },
    ], DEFAULT_TOLERANCE)
    expect(numericVsText.results[0]?.status).toBe('unverifiable')
    // Cited a string but the located value is a number: incomparable.
    const textVsNumber = checkCitations(jsonRoot(), [
      { id: 'b', path: 'rows[0].nav', value: 'some text' },
    ], DEFAULT_TOLERANCE)
    expect(textVsNumber.results[0]?.status).toBe('unverifiable')
  })

  it('walks JSON document roots (summary.annualReturn)', () => {
    const result = checkCitations(jsonRoot(), [
      { id: 'a', path: 'summary.annualReturn', value: 0.1234 },
      { id: 'b', path: 'summary.fundCount', value: 8 },
      { id: 'c', path: 'rows[0].nav', value: 1.2340000001, tolerance: 1e-6 },
      { id: 'd', path: 'rows[1].nav', value: 5 },
    ], DEFAULT_TOLERANCE)
    expect(result.results.map((entry) => entry.status)).toEqual(['verified', 'verified', 'verified', 'unverifiable'])
  })

  it('falls back to the configured default tolerance when a citation omits it', () => {
    const root = jsonRoot()
    const tight = checkCitations(root, [{ id: 'a', path: 'summary.annualReturn', value: 0.1235 }], 1e-9)
    expect(tight.results[0]?.status).toBe('mismatch')
    const loose = checkCitations(root, [{ id: 'a', path: 'summary.annualReturn', value: 0.1235 }], 0.01)
    expect(loose.results[0]?.status).toBe('verified')
  })

  it('echoes citation ids in order', () => {
    const result = checkCitations(tableRoot(), [
      { id: 'z', path: 'rows[0].nav', value: 1.234 },
      { id: 'a', path: 'rows[0].nav', value: 2 },
    ], DEFAULT_TOLERANCE)
    expect(result.results.map((entry) => entry.id)).toEqual(['z', 'a'])
  })
})

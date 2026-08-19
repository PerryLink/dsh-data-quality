/**
 * Cleaning-rules engine tests: every rule type has at least one positive and
 * one negative case; rule ordering, the audit log, and CSV serialization.
 * @module dsh-data-quality/test/clean.spec
 */

import { describe, expect, it } from 'vitest'
import { applyCleanRules, CleanRuleError, serializeDelimited, type CleanRule } from '../src/clean.ts'
import { parseDelimited } from '../src/dataset.ts'
import { resolveConfig } from '../src/config.ts'
import { DIRTY_CSV } from './harness.ts'

const config = resolveConfig()

/** Parse CSV text into a table. */
function tableOf(csv: string) {
  return parseDelimited(csv, ',', config)
}

/** Run rules over CSV text. */
function run(csv: string, rules: readonly CleanRule[]) {
  return applyCleanRules(tableOf(csv), rules)
}

describe('dedupe', () => {
  it('removes duplicate rows by column group, keeping the first', () => {
    const result = run(DIRTY_CSV, [{ rule: 'dedupe', columns: ['fund_code'] }])
    expect(result.inputRows).toBe(10)
    expect(result.outputRows).toBe(8)
    expect(result.logs[0]?.affectedRows).toBe(2)
    const codes = result.rows.map((row) => row['fund_code'])
    expect(new Set(codes).size).toBe(8)
  })

  it('fails loud on an unknown column', () => {
    expect(() => run(DIRTY_CSV, [{ rule: 'dedupe', columns: ['nope'] }])).toThrowError(CleanRuleError)
    expect(() => run(DIRTY_CSV, [{ rule: 'dedupe', columns: ['nope'] }])).toThrowError(/unknown column/)
  })
})

describe('fill-missing', () => {
  it('fills with a constant', () => {
    const result = run('a,b\n1,\n2,x\n', [{ rule: 'fill-missing', column: 'b', strategy: 'constant', value: 'N/A' }])
    expect(result.rows[0]?.['b']).toBe('N/A')
    expect(result.logs[0]?.affectedRows).toBe(1)
  })

  it('fills with the column mean and median', () => {
    const mean = run('a,b\n1,x\n,y\n3,z\n', [{ rule: 'fill-missing', column: 'a', strategy: 'mean' }])
    expect(mean.rows[1]?.['a']).toBe(2)
    const median = run('a,b\n1,x\n,y\n9,z\n3,w\n', [{ rule: 'fill-missing', column: 'a', strategy: 'median' }])
    expect(median.rows[1]?.['a']).toBe(3)
  })

  it('forward-fills from the previous non-missing value', () => {
    const result = run('a,b\nx,1\n,2\n,3\ny,4\n,5\n', [{ rule: 'fill-missing', column: 'a', strategy: 'forward' }])
    expect(result.rows.map((row) => row['a'])).toEqual(['x', 'x', 'x', 'y', 'y'])
  })

  it('fails loud when constant has no value', () => {
    expect(() => run('a\n\n', [{ rule: 'fill-missing', column: 'a', strategy: 'constant' }])).toThrowError(/requires a value/)
  })

  it('fails loud when mean/median has no numeric values', () => {
    expect(() => run('a\nx\n\n', [{ rule: 'fill-missing', column: 'a', strategy: 'mean' }])).toThrowError(/at least one numeric value/)
  })
})

describe('coerce-type', () => {
  it('coerces numbers and counts failures separately', () => {
    const result = run('a,b\n1.5,x\nabc,y\n,z\n', [{ rule: 'coerce-type', column: 'a', to: 'number' }])
    expect(result.rows[0]?.['a']).toBe(1.5)
    expect(result.rows[1]?.['a']).toBeNull()
    expect(result.rows[2]?.['a']).toBeNull()
    expect(result.logs[0]?.affectedRows).toBe(1)
    expect(result.logs[0]?.detail).toMatch(/1 failure/)
  })

  it('coerces dates to ISO and booleans to text', () => {
    const result = run('d,b\n2026/8/2,yes\nnot-a-date,maybe\n', [
      { rule: 'coerce-type', column: 'd', to: 'date' },
      { rule: 'coerce-type', column: 'b', to: 'boolean' },
    ])
    expect(result.rows[0]?.['d']).toBe('2026-08-02')
    expect(result.rows[1]?.['d']).toBeNull()
    expect(result.rows[0]?.['b']).toBe('true')
    expect(result.rows[1]?.['b']).toBeNull()
  })

  it('fails loud on an unknown column', () => {
    expect(() => run('a\n1\n', [{ rule: 'coerce-type', column: 'nope', to: 'number' }])).toThrowError(/unknown column/)
  })
})

describe('normalize-unit', () => {
  it('converts suffixed and plain numeric values to base units', () => {
    const result = run('v,b\n5000万,1\n2.5亿,2\n120000000,3\noops,4\n,5\n', [
      { rule: 'normalize-unit', column: 'v', factors: { 万: 10_000, 亿: 100_000_000 } },
    ])
    expect(result.rows[0]?.['v']).toBe(50_000_000)
    expect(result.rows[1]?.['v']).toBe(250_000_000)
    expect(result.rows[2]?.['v']).toBe(120_000_000)
    expect(result.rows[3]?.['v']).toBe('oops')
    expect(result.rows[4]?.['v']).toBeNull()
    expect(result.logs[0]?.affectedRows).toBe(3)
    expect(result.logs[0]?.detail).toMatch(/1 unparseable/)
  })

  it('fails loud on an empty factors map', () => {
    expect(() => run('v\n1万\n', [{ rule: 'normalize-unit', column: 'v', factors: {} }])).toThrowError(/non-empty factors/)
  })

  it('fails loud on a non-positive factor', () => {
    expect(() => run('v\n1万\n', [{ rule: 'normalize-unit', column: 'v', factors: { 万: -1 } }])).toThrowError(/positive finite/)
  })
})

describe('trim', () => {
  it('trims string cells in all columns by default', () => {
    const result = run('a,b\n  x , y  \n', [{ rule: 'trim' }])
    expect(result.rows[0]).toEqual({ a: 'x', b: 'y' })
    expect(result.logs[0]?.affectedRows).toBe(1)
  })

  it('fails loud on an unknown column', () => {
    expect(() => run('a\n1\n', [{ rule: 'trim', columns: ['nope'] }])).toThrowError(/unknown column/)
  })
})

describe('map-values', () => {
  it('maps exact matches and keeps unmapped values by default', () => {
    const result = run('c\nCNY\ncny\nHKD\n', [{ rule: 'map-values', column: 'c', map: { cny: 'CNY' } }])
    expect(result.rows.map((row) => row['c'])).toEqual(['CNY', 'CNY', 'HKD'])
    expect(result.logs[0]?.affectedRows).toBe(1)
  })

  it('sets unmapped values to missing under else:missing', () => {
    const result = run('c\nCNY\n???\n', [{ rule: 'map-values', column: 'c', map: { CNY: 'CNY' }, else: 'missing' }])
    expect(result.rows[1]?.['c']).toBeNull()
  })

  it('fails loud on an unknown column', () => {
    expect(() => run('a\n1\n', [{ rule: 'map-values', column: 'nope', map: {} }])).toThrowError(/unknown column/)
  })
})

describe('engine behavior', () => {
  it('applies rules in order, each seeing the previous output', () => {
    const result = run(DIRTY_CSV, [
      { rule: 'trim' },
      { rule: 'normalize-unit', column: 'holding_value', factors: { 万: 10_000, 亿: 100_000_000 } },
      { rule: 'coerce-type', column: 'holding_value', to: 'number' },
    ])
    expect(result.logs).toHaveLength(3)
    const values = result.rows.map((row) => row['holding_value'])
    expect(values[0]).toBe(50_000_000)
    expect(values[2]).toBe(50_000_000)
    expect(result.rows[0]?.['fund_name']).toBe('Alpha Growth')
  })

  it('rejects an empty rule list', () => {
    expect(() => applyCleanRules(tableOf('a\n1\n'), [])).toThrowError(/non-empty/)
  })

  it('rejects an unknown rule type at the JSON boundary', () => {
    expect(() => applyCleanRules(tableOf('a\n1\n'), [{ rule: 'obliterate' } as unknown as CleanRule])).toThrowError(/unknown rule type/)
  })
})

describe('serializeDelimited', () => {
  it('round-trips through the parser with quoting intact', () => {
    const table = tableOf('a,b\n"x, y","say ""hi"""\n1,\n')
    const text = serializeDelimited(table.columns, table.rows, ',')
    const reparsed = parseDelimited(text, ',', config)
    expect(reparsed.rows).toEqual(table.rows)
  })
})

/**
 * Delivery-contract engine tests: the deterministic pre-delivery validation
 * summary (dedupe before/after, uniqueness regression, non-null regression,
 * type regression) and the clean before/after profile diff.
 * @module dsh-data-quality/test/contract.spec
 */

import { describe, expect, it } from 'vitest'
import { computeCleanContract, computeCleanProfileDiff } from '../src/contract.ts'
import { applyCleanRules, type CleanRule } from '../src/clean.ts'
import { parseDelimited } from '../src/dataset.ts'
import { resolveConfig } from '../src/config.ts'

const config = resolveConfig()
const GENERATED_AT = Date.UTC(2026, 7, 19, 8, 0, 0)

/** Parse CSV text into a table. */
function tableOf(csv: string) {
  return parseDelimited(csv, ',', config)
}

describe('computeCleanContract', () => {
  it('reports the dedupe before/after comparison and uniqueness regression', () => {
    const table = tableOf('id,v\n1,a\n2,b\n1,c\n')
    const result = applyCleanRules(table, [{ rule: 'dedupe', columns: ['id'] }])
    const contract = computeCleanContract(result, [{ rule: 'dedupe', columns: ['id'] }])
    expect(contract.inputRows).toBe(3)
    expect(contract.outputRows).toBe(2)
    expect(contract.removedRows).toBe(1)
    expect(contract.dedupeColumns).toEqual(['id'])
    expect(contract.uniqueKeys).toBe(true)
    expect(contract.remainingDuplicateRows).toBe(0)
  })

  it('regresses uniqueness over full rows when no dedupe rule ran', () => {
    const table = tableOf('a,b\n1,x\n1,x\n2,y\n')
    const result = applyCleanRules(table, [{ rule: 'trim' }])
    const contract = computeCleanContract(result, [{ rule: 'trim' }])
    expect(contract.dedupeColumns).toBeNull()
    expect(contract.uniqueKeys).toBe(false)
    expect(contract.remainingDuplicateRows).toBe(1)
  })

  it('reports the non-null regression for fill-missing columns', () => {
    const table = tableOf('a,b\n,x\n1,z\n')
    const result = applyCleanRules(table, [{ rule: 'fill-missing', column: 'a', strategy: 'forward' }])
    const contract = computeCleanContract(result, [{ rule: 'fill-missing', column: 'a', strategy: 'forward' }])
    expect(contract.remainingMissing).toEqual([{ column: 'a', count: 1 }])
  })

  it('reports the type regression for coerce-type columns', () => {
    const table = tableOf('a\n1\nabc\n2\n')
    const result = applyCleanRules(table, [{ rule: 'coerce-type', column: 'a', to: 'number' }])
    const contract = computeCleanContract(result, [{ rule: 'coerce-type', column: 'a', to: 'number' }])
    // Coercion nulls out failures, so no present cell remains non-conforming.
    expect(contract.typeConformance).toEqual([{ column: 'a', to: 'number', invalidCount: 0 }])
  })

  it('traces per-column decisions with strategy and affected rows', () => {
    const table = tableOf('a,b\n1,x\n,\n')
    const rules: readonly CleanRule[] = [
      { rule: 'fill-missing', column: 'b', strategy: 'constant', value: 'N/A' },
      { rule: 'coerce-type', column: 'a', to: 'number' },
    ]
    const result = applyCleanRules(table, rules)
    const contract = computeCleanContract(result, rules)
    expect(contract.columnDecisions).toEqual([
      { column: 'a', decisions: [{ strategy: 'coerce-type', affectedRows: 1 }] },
      { column: 'b', decisions: [{ strategy: 'fill-missing', affectedRows: 1 }] },
    ])
  })
})

describe('computeCleanProfileDiff', () => {
  it('profiles before and after through the same engine', () => {
    const input = tableOf('id,v\n1,a\n1,a\n2,b\n')
    const result = applyCleanRules(input, [{ rule: 'dedupe', columns: ['id'] }])
    const diff = computeCleanProfileDiff(input, { columns: result.columns, rows: result.rows }, {
      dataset: 'd.csv',
      generatedAt: GENERATED_AT,
    })
    expect(diff.dataset).toBe('d.csv')
    expect(diff.before.rowCount).toBe(3)
    expect(diff.after.rowCount).toBe(2)
    expect(diff.before.duplicateRows).toBe(1)
    expect(diff.after.duplicateRows).toBe(0)
    expect(diff.before.scorecard).toBeDefined()
    expect(diff.after.scorecard).toBeDefined()
  })
})

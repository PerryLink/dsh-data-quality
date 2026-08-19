/**
 * Verification-rules engine tests: every rule type has at least one positive
 * and one negative case; evidence capping, rule validation, and the freshness
 * clock injection.
 * @module dsh-data-quality/test/verify.spec
 */

import { describe, expect, it } from 'vitest'
import { renderVerifyText, verifyTable, VerifyRuleError, type VerifyRule } from '../src/verify.ts'
import { parseDelimited } from '../src/dataset.ts'
import { resolveConfig } from '../src/config.ts'

const config = resolveConfig()
/** Fixed clock: 2026-08-15T00:00:00Z. */
const NOW = Date.UTC(2026, 7, 15)

/** Run rules over CSV text. */
function run(csv: string, rules: readonly VerifyRule[], evidenceRowLimit = config.evidenceRowLimit) {
  return verifyTable(parseDelimited(csv, ',', config), rules, { evidenceRowLimit, now: () => NOW })
}

describe('not-null', () => {
  it('passes a fully present column', () => {
    const result = run('a\n1\n2\n', [{ rule: 'not-null', column: 'a' }])
    expect(result.passed).toBe(true)
    expect(result.rules[0]?.failedCount).toBe(0)
  })

  it('fails missing cells with evidence', () => {
    const result = run('a,b\n1,x\n,y\n  ,z\n', [{ rule: 'not-null', column: 'a' }])
    expect(result.passed).toBe(false)
    const rule = result.rules[0]
    expect(rule?.failedCount).toBe(2)
    expect(rule?.evidence).toHaveLength(2)
    expect(rule?.evidence[0]?.rowIndex).toBe(1)
  })

  it('fails loud on an unknown column', () => {
    expect(() => run('a\n1\n', [{ rule: 'not-null', column: 'nope' }])).toThrowError(VerifyRuleError)
    expect(() => run('a\n1\n', [{ rule: 'not-null', column: 'nope' }])).toThrowError(/unknown column/)
  })
})

describe('unique', () => {
  it('passes distinct keys', () => {
    const result = run('a,b\n1,x\n2,x\n', [{ rule: 'unique', columns: ['a'] }])
    expect(result.passed).toBe(true)
  })

  it('fails every row of a duplicated key group', () => {
    const result = run('a,b\n1,x\n1,y\n2,z\n', [{ rule: 'unique', columns: ['a'] }])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.failedCount).toBe(2)
  })

  it('treats repeated missing keys as duplicates', () => {
    const result = run('a,b\n,x\n,y\n1,z\n', [{ rule: 'unique', columns: ['a'] }])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.failedCount).toBe(2)
  })
})

describe('range', () => {
  it('passes values inside the inclusive bounds', () => {
    const result = run('a\n0\n5\n10\n', [{ rule: 'range', column: 'a', min: 0, max: 10 }])
    expect(result.passed).toBe(true)
  })

  it('fails out-of-range, unparseable, and missing cells', () => {
    const result = run('a,b\n-1,x\nabc,x\n,x\n7,x\n', [{ rule: 'range', column: 'a', min: 0, max: 10 }])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.failedCount).toBe(3)
  })

  it('fails loud without any bound', () => {
    expect(() => run('a\n1\n', [{ rule: 'range', column: 'a' }])).toThrowError(/at least one of min\/max/)
  })
})

describe('regex', () => {
  it('passes matching cells', () => {
    const result = run('a\nFUND001\nFUND002\n', [{ rule: 'regex', column: 'a', pattern: '^FUND\\d{3}$' }])
    expect(result.passed).toBe(true)
  })

  it('fails non-matching and missing cells', () => {
    const result = run('a,b\nFUND001,x\nfund002,y\n,z\n', [{ rule: 'regex', column: 'a', pattern: '^FUND' }])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.failedCount).toBe(2)
  })

  it('honors flags and rejects invalid patterns loudly', () => {
    expect(run('a\nfund001\n', [{ rule: 'regex', column: 'a', pattern: '^FUND', flags: 'i' }]).passed).toBe(true)
    expect(() => run('a\n1\n', [{ rule: 'regex', column: 'a', pattern: '([' }])).toThrowError(/invalid regex/)
  })
})

describe('enum', () => {
  it('passes allowed values', () => {
    const result = run('c\nCNY\nHKD\n', [{ rule: 'enum', column: 'c', values: ['CNY', 'HKD'] }])
    expect(result.passed).toBe(true)
  })

  it('fails unlisted and missing values', () => {
    const result = run('c,b\ncny,x\n,y\n', [{ rule: 'enum', column: 'c', values: ['CNY'] }])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.failedCount).toBe(2)
  })

  it('fails loud on an empty values list', () => {
    expect(() => run('a\n1\n', [{ rule: 'enum', column: 'a', values: [] }])).toThrowError(/non-empty values/)
  })
})

describe('cross-column', () => {
  it('passes startDate < endDate', () => {
    const result = run('s,e\n2026-08-01,2026-08-02\n', [{ rule: 'cross-column', left: 's', op: '<', rightColumn: 'e' }])
    expect(result.passed).toBe(true)
  })

  it('fails inverted dates and missing sides', () => {
    const result = run('s,e,b\n2026-08-03,2026-08-02,x\n,y,z\n', [{ rule: 'cross-column', left: 's', op: '<', rightColumn: 'e' }])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.failedCount).toBe(2)
  })

  it('compares against a literal value with numeric tolerance', () => {
    const result = run('a\n1.0000000000001\n', [{ rule: 'cross-column', left: 'a', op: '==', value: 1 }])
    expect(result.passed).toBe(true)
  })

  it('uses string equality for == on non-numeric cells', () => {
    expect(run('a\nCNY\n', [{ rule: 'cross-column', left: 'a', op: '==', value: 'CNY' }]).passed).toBe(true)
    expect(run('a\ncny\n', [{ rule: 'cross-column', left: 'a', op: '==', value: 'CNY' }]).passed).toBe(false)
  })

  it('fails loud when both or neither of rightColumn/value is given', () => {
    expect(() => run('a\n1\n', [{ rule: 'cross-column', left: 'a', op: '<' }])).toThrowError(/exactly one/)
    expect(() => run('a\n1\n', [{ rule: 'cross-column', left: 'a', op: '<', rightColumn: 'a', value: 1 }])).toThrowError(/exactly one/)
  })
})

describe('freshness', () => {
  it('passes recent dates against the injected clock', () => {
    const result = run('d\n2026-08-10\n2026-08-15\n', [{ rule: 'freshness', column: 'd', maxAgeDays: 30 }])
    expect(result.passed).toBe(true)
  })

  it('fails stale, missing, and unparseable dates', () => {
    const result = run('d,b\n2026-01-01,x\n,y\nnot-a-date,z\n', [{ rule: 'freshness', column: 'd', maxAgeDays: 30 }])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.failedCount).toBe(3)
  })

  it('honors an explicit asOf', () => {
    const result = run('d\n2026-08-01\n', [{ rule: 'freshness', column: 'd', maxAgeDays: 3, asOf: '2026-08-10' }])
    expect(result.passed).toBe(false)
  })

  it('fails loud on a bad asOf or non-positive maxAgeDays', () => {
    expect(() => run('d\n2026-08-01\n', [{ rule: 'freshness', column: 'd', maxAgeDays: 3, asOf: 'oops' }])).toThrowError(/asOf/)
    expect(() => run('d\n2026-08-01\n', [{ rule: 'freshness', column: 'd', maxAgeDays: 0 }])).toThrowError(/maxAgeDays/)
  })
})

describe('engine behavior', () => {
  it('overall passed is the conjunction of rule passes and never throws for data failures', () => {
    const result = run('a,b\n1,x\n,y\n', [
      { rule: 'not-null', column: 'a' },
      { rule: 'not-null', column: 'b' },
    ])
    expect(result.passed).toBe(false)
    expect(result.rules[0]?.passed).toBe(false)
    expect(result.rules[1]?.passed).toBe(true)
  })

  it('caps evidence rows at the configured limit', () => {
    const csv = `a,b\n${Array.from({ length: 30 }, (_, i) => `,${i}`).join('\n')}\n`
    const result = run(csv, [{ rule: 'not-null', column: 'a' }], 5)
    expect(result.rules[0]?.failedCount).toBe(30)
    expect(result.rules[0]?.evidence).toHaveLength(5)
  })

  it('rejects an empty rule list and unknown rule types', () => {
    expect(() => run('a\n1\n', [])).toThrowError(/non-empty/)
    expect(() => run('a\n1\n', [{ rule: 'voodoo' } as unknown as VerifyRule])).toThrowError(/unknown rule type/)
  })

  it('renders a human-readable summary', () => {
    const result = run('a,b\n1,x\n,y\n', [{ rule: 'not-null', column: 'a' }])
    const text = renderVerifyText({ dataset: 't.csv', ...result })
    expect(text).toContain('FAILED')
    expect(text).toContain('row 1')
  })
})

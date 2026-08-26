/**
 * Self-contained HTML renderer tests: the profile/clean reports become a
 * single-file offline document with inlined CSS/JS, no external requests, the
 * DAMA six-dimension scorecard, the column-profile table, the cleaning
 * summary table, and a versioned report schema.
 * @module dsh-data-quality/test/report-html.spec
 */

import { describe, expect, it } from 'vitest'
import { parseDelimited } from '../src/dataset.ts'
import { profileTable, type ProfileReport } from '../src/profile.ts'
import { resolveConfig } from '../src/config.ts'
import { renderCleanHtml, renderProfileHtml } from '../src/report-html.ts'
import { REPORT_SCHEMA_VERSION } from '../src/version.ts'
import { DIRTY_CSV } from './harness.ts'

const config = resolveConfig()
const GENERATED_AT = Date.UTC(2026, 7, 19, 8, 0, 0)

function profile(): ProfileReport {
  return profileTable(parseDelimited(DIRTY_CSV, ',', config), { dataset: 'dirty.csv', generatedAt: GENERATED_AT })
}

describe('renderProfileHtml', () => {
  it('produces a self-contained document: inlined style/script, no external requests', () => {
    const html = renderProfileHtml(profile())
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<style>')
    expect(html).toContain('</style>')
    expect(html).toContain('<script>')
    expect(html).toContain('</script>')
    expect(html).not.toContain('<link')
    expect(html).not.toContain('src="http')
    expect(html).not.toContain('https://')
  })

  it('carries the DAMA six dimensions and the profile summary table', () => {
    const html = renderProfileHtml(profile())
    expect(html).toContain('DAMA six-dimension quality scorecard')
    for (const dimension of ['completeness', 'uniqueness', 'validity', 'consistency', 'timeliness', 'accuracy']) {
      expect(html).toContain(dimension)
    }
    expect(html).toContain('Column profile')
    expect(html).toContain('Numeric distribution')
  })

  it('escapes dataset values so they cannot break out of the markup', () => {
    const table = parseDelimited('name,note\na<b&c,"x<y"\n', ',', config)
    const report = profileTable(table, { dataset: 'd<irty>.csv', generatedAt: GENERATED_AT })
    const html = renderProfileHtml(report)
    expect(html).toContain('a&lt;b&amp;c')
    expect(html).not.toContain('a<b&c')
  })

  it('records the versioned report schema', () => {
    const report = profile()
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION)
    expect(renderProfileHtml(report)).toContain(`schema v${REPORT_SCHEMA_VERSION}`)
  })
})

describe('renderCleanHtml', () => {
  it('renders the per-rule cleaning summary table', () => {
    const html = renderCleanHtml(
      { inputRows: 10, outputRows: 8, logs: [{ rule: 'dedupe', affectedRows: 2, detail: 'removed 2 duplicate row(s)' }] },
      'dirty.csv',
    )
    expect(html).toContain('Cleaning summary')
    expect(html).toContain('dedupe')
    expect(html).toContain('removed 2 duplicate row(s)')
    expect(html).toContain('removed 2 rows')
    expect(html).not.toContain('<link')
    expect(html).not.toContain('https://')
  })
})

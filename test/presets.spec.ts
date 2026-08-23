/**
 * Industry preset registry tests: the built-in presets, their expected column
 * lists, and fail-loud resolution of unknown ids.
 * @module dsh-data-quality/test/presets.spec
 */

import { describe, expect, it } from 'vitest'
import { INDUSTRY_PRESETS, INDUSTRY_PRESET_IDS, resolveIndustryPreset } from '../src/presets.ts'

describe('INDUSTRY_PRESETS', () => {
  it('registers 8-10 presets, each with a non-empty expected column list', () => {
    expect(INDUSTRY_PRESET_IDS.length).toBeGreaterThanOrEqual(8)
    expect(INDUSTRY_PRESET_IDS.length).toBeLessThanOrEqual(10)
    for (const id of INDUSTRY_PRESET_IDS) {
      const preset = INDUSTRY_PRESETS[id]
      expect(preset, `preset ${id}`).toBeDefined()
      expect(Object.keys(preset?.columns ?? {}).length, `preset ${id} columns`).toBeGreaterThan(0)
    }
  })

  it('resolves known presets deterministically', () => {
    const fund = resolveIndustryPreset('fund')
    expect(fund.columns).toEqual({
      fund_code: 'string',
      fund_name: 'string',
      nav: 'number',
      nav_date: 'date',
      holding_value: 'number',
      currency: 'string',
    })
    expect(resolveIndustryPreset('fund')).toBe(fund)
  })

  it('fails loud on an unknown preset id', () => {
    expect(() => resolveIndustryPreset('nope')).toThrowError(/unknown industryPreset/)
    expect(() => resolveIndustryPreset('nope')).toThrowError(/retail/)
  })
})

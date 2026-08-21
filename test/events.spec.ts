/**
 * Adaptive session-event gate tests: the unknown-type skip path (no
 * `ignorable` support), the KNOWN-type plain-append path, and the
 * master-build `ignorable` probe path — plus the display-truncation helpers.
 * @module dsh-data-quality/test/events.spec
 */

import { afterEach, describe, expect, it } from 'vitest'
import { KNOWN_SESSION_EVENT_TYPES, type Session } from '@deepseek-ai/dsh-session'
import { appendDataQualityEvent, DATA_QUALITY_EVENT_TYPES, type DataQualityEventData } from '../src/events.ts'
import { MAX_CELL_TEXT, truncateCell, truncateRow } from '../src/present.ts'

/** Payload fixture. */
function data(): DataQualityEventData {
  return { kind: 'profile', dataset: 'dirty.csv', summary: { rows: 10, columns: 6 } }
}

/** The gate reads the shared known-type set as a mutable Set at runtime. */
const KNOWN_MUTABLE = KNOWN_SESSION_EVENT_TYPES as unknown as Set<string>

afterEach(() => {
  // Restore the known-type set after the KNOWN-path test.
  for (const type of DATA_QUALITY_EVENT_TYPES) KNOWN_MUTABLE.delete(type)
})

describe('appendDataQualityEvent', () => {
  it('skips the append on rc.6-style hosts (unknown type, no ignorable support)', () => {
    const calls: unknown[] = []
    const rc6Session = {
      append(type: string, payload: unknown, ...opts: unknown[]) {
        calls.push([type, payload, opts])
      },
    } as unknown as Session
    appendDataQualityEvent(rc6Session, 'data-quality/profile', data())
    expect(calls).toHaveLength(0)
  })

  it('appends plainly when the host knows the vocabulary', () => {
    KNOWN_MUTABLE.add('data-quality/profile')
    const calls: Array<[string, unknown, unknown[]]> = []
    const session = {
      append(type: string, payload: unknown, ...opts: unknown[]) {
        calls.push([type, payload, opts])
      },
    } as unknown as Session
    appendDataQualityEvent(session, 'data-quality/profile', data())
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe('data-quality/profile')
    expect(calls[0]?.[2]).toHaveLength(0)
  })

  it('appends with the ignorable marker when the append implementation supports it', () => {
    const calls: Array<[string, unknown, unknown]> = []
    const session = {
      append(type: string, payload: unknown, options?: { ignorable?: true }) {
        // Real code (not a comment, which transforms may strip) referencing
        // the flag by name — exactly what the gate's source probe looks for.
        const ignorable = options?.ignorable
        void ignorable
        calls.push([type, payload, options])
      },
    } as unknown as Session
    appendDataQualityEvent(session, 'data-quality/verify', data())
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe('data-quality/verify')
    expect(calls[0]?.[2]).toEqual({ ignorable: true })
  })
})

describe('truncateCell / truncateRow', () => {
  it('truncates long strings with an ellipsis marker', () => {
    const long = 'x'.repeat(MAX_CELL_TEXT + 50)
    const truncated = truncateCell(long) as string
    expect(truncated).toHaveLength(MAX_CELL_TEXT + 1)
    expect(truncated.endsWith('…')).toBe(true)
  })

  it('passes short strings and non-strings through', () => {
    expect(truncateCell('short')).toBe('short')
    expect(truncateCell(42)).toBe(42)
    expect(truncateCell(null)).toBeNull()
  })

  it('truncates every string cell of a row', () => {
    const row = { a: 'x'.repeat(MAX_CELL_TEXT + 10), b: 1, c: 'ok' }
    const out = truncateRow(row)
    expect((out['a'] as string).endsWith('…')).toBe(true)
    expect(out['b']).toBe(1)
    expect(out['c']).toBe('ok')
  })
})

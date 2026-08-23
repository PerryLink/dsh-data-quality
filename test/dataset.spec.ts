/**
 * Dataset-layer tests: path confinement, size/row guards, the CSV/TSV/JSON/
 * JSONL parsers, deterministic sampling, and the scalar parsers.
 * @module dsh-data-quality/test/dataset.spec
 */

import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resolveConfig } from '../src/config.ts'
import {
  DatasetError,
  dateFormatOf,
  detectEncoding,
  isMissing,
  loadTable,
  parseBoolean,
  parseDate,
  parseDateCell,
  parseDelimited,
  parseJsonTable,
  parseNumeric,
  resolveWorkspacePath,
  sampleRows,
} from '../src/dataset.ts'

const config = resolveConfig()

describe('resolveWorkspacePath', () => {
  const root = path.resolve('/workspace')

  it('resolves a relative path inside the root', () => {
    expect(resolveWorkspacePath(root, 'data/x.csv', config)).toBe(path.join(root, 'data', 'x.csv'))
  })

  it('accepts an absolute path inside the root', () => {
    expect(resolveWorkspacePath(root, path.join(root, 'x.csv'), config)).toBe(path.join(root, 'x.csv'))
  })

  it('rejects parent-directory escapes', () => {
    expect(() => resolveWorkspacePath(root, '../outside.csv', config)).toThrowError(DatasetError)
    expect(() => resolveWorkspacePath(root, '../outside.csv', config)).toThrowError(/outside the workspace/)
    expect(() => resolveWorkspacePath(root, 'a/../../outside.csv', config)).toThrowError(/outside the workspace/)
  })

  it('rejects an absolute path outside the root', () => {
    expect(() => resolveWorkspacePath(root, path.resolve('/elsewhere/x.csv'), config)).toThrowError(/outside the workspace/)
  })

  it('rejects disallowed extensions', () => {
    expect(() => resolveWorkspacePath(root, 'x.exe', config)).toThrowError(/extension/)
  })

  it('rejects an empty path', () => {
    expect(() => resolveWorkspacePath(root, '  ', config)).toThrowError(/must not be empty/)
  })
})

describe('parseDelimited', () => {
  it('parses quoted fields, escaped quotes, and CRLF', () => {
    const table = parseDelimited('a,b\r\n"x, y","say ""hi"""\r\n1,2\r\n', ',', config)
    expect(table.columns).toEqual(['a', 'b'])
    expect(table.rows).toEqual([
      { a: 'x, y', b: 'say "hi"' },
      { a: '1', b: '2' },
    ])
  })

  it('maps empty fields to null and skips blank lines', () => {
    const table = parseDelimited('a,b\n\n1,\n,2\n', ',', config)
    expect(table.rows).toEqual([
      { a: '1', b: null },
      { a: null, b: '2' },
    ])
  })

  it('fails loud on rows longer than the header', () => {
    expect(() => parseDelimited('a,b\n1,2,3\n', ',', config)).toThrowError(/row 2 has 3 fields/)
  })

  it('fails loud on duplicate header names', () => {
    expect(() => parseDelimited('a,a\n1,2\n', ',', config)).toThrowError(/duplicate column/)
  })

  it('enforces the row cap while parsing', () => {
    const tight = resolveConfig({ maxRows: 2 })
    expect(() => parseDelimited('a\n1\n2\n3\n', ',', tight)).toThrowError(/row cap/)
  })
})

describe('parseJsonTable', () => {
  it('parses an array of objects and unions the keys', () => {
    const table = parseJsonTable('[{"a":1},{"b":"x"}]', '.json', config)
    expect(table.columns).toEqual(['a', 'b'])
    expect(table.rows).toEqual([
      { a: 1, b: null },
      { a: null, b: 'x' },
    ])
  })

  it('parses JSONL lines', () => {
    const table = parseJsonTable('{"a":1}\n{"a":2}\n', '.jsonl', config)
    expect(table.rows).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('rejects non-tabular JSON loudly', () => {
    expect(() => parseJsonTable('[1,2,3]', '.json', config)).toThrowError(/not a flat object/)
  })

  it('rejects malformed JSON with the parser message', () => {
    expect(() => parseJsonTable('{oops', '.json', config)).toThrowError(/invalid JSON/)
  })

  it('names the offending JSONL line', () => {
    expect(() => parseJsonTable('{"a":1}\n{bad}\n', '.jsonl', config)).toThrowError(/line 2/)
  })
})

describe('loadTable guards', () => {
  it('rejects files above the size cap', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'dq-dataset-'))
    try {
      const file = path.join(dir, 'big.csv')
      await writeFile(file, `a\n${'1\n'.repeat(200)}`)
      const tight = resolveConfig({ maxFileSizeMB: 1e-9 })
      await expect(loadTable(file, tight)).rejects.toThrowError(/above the .* cap/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects missing files as not-found', async () => {
    await expect(loadTable(path.join(tmpdir(), 'dq-no-such-file.csv'), config)).rejects.toThrowError(/not found/)
  })

  it('loadTable reports encoding (BOM stripped + UTF-8 validity)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'dq-dataset-'))
    try {
      const file = path.join(dir, 'bom.csv')
      await writeFile(file, '\uFEFFa,b\n1,2\n', 'utf8')
      const table = await loadTable(file, config)
      expect(table.encoding).toEqual({ bom: 'utf-8', validUtf8: true })
      expect(table.columns).toEqual(['a', 'b'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('detectEncoding', () => {
  it('detects a UTF-8 BOM and flags invalid UTF-8 bytes', () => {
    expect(detectEncoding(new TextEncoder().encode('a,b\n1,2\n'))).toEqual({ bom: null, validUtf8: true })
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a,b\n1,2\n')])
    expect(detectEncoding(bom)).toEqual({ bom: 'utf-8', validUtf8: true })
    expect(detectEncoding(new Uint8Array([0xff, 0xfe, 0x00, 0x00]))).toEqual({ bom: null, validUtf8: false })
  })
})

describe('sampleRows', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }))

  it('is deterministic and systematic', () => {
    const first = sampleRows(rows, 3)
    const second = sampleRows(rows, 3)
    expect(first).toEqual(second)
    expect(first.map((row) => row.id)).toEqual([0, 4, 8])
  })

  it('returns the identity when the sample covers the table', () => {
    expect(sampleRows(rows, 10)).toHaveLength(10)
    expect(sampleRows(rows, 99)).toHaveLength(10)
  })

  it('rejects non-positive sample sizes', () => {
    expect(() => sampleRows(rows, 0)).toThrowError(/positive integer/)
  })
})

describe('scalar parsers', () => {
  it('isMissing covers null, undefined, and whitespace strings', () => {
    expect(isMissing(null)).toBe(true)
    expect(isMissing(undefined)).toBe(true)
    expect(isMissing('   ')).toBe(true)
    expect(isMissing('0')).toBe(false)
    expect(isMissing(0)).toBe(false)
  })

  it('parseNumeric is strict', () => {
    expect(parseNumeric('1.5e3')).toBe(1500)
    expect(parseNumeric(' -2.5 ')).toBe(-2.5)
    expect(parseNumeric('1,234')).toBeUndefined()
    expect(parseNumeric('5万')).toBeUndefined()
    expect(parseNumeric('abc')).toBeUndefined()
    expect(parseNumeric(Number.NaN)).toBeUndefined()
  })

  it('parseDate accepts ISO-like dates and rejects calendar garbage', () => {
    expect(parseDate('2026-08-01')).toBe(Date.UTC(2026, 7, 1))
    expect(parseDate('2026/8/2')).toBe(Date.UTC(2026, 7, 2))
    expect(parseDate('2026-08-01T10:30:00Z')).toBe(Date.UTC(2026, 7, 1, 10, 30))
    expect(parseDate('2026-13-01')).toBeUndefined()
    expect(parseDate('2026-02-30')).toBeUndefined()
    expect(parseDate('not-a-date')).toBeUndefined()
  })

  it('parseBoolean accepts the common spellings', () => {
    expect(parseBoolean('YES')).toBe(true)
    expect(parseBoolean('0')).toBe(false)
    expect(parseBoolean(true)).toBe(true)
    expect(parseBoolean('maybe')).toBeUndefined()
  })

  it('parseDateCell reports the source format label', () => {
    expect(parseDateCell('2026-08-01')).toEqual({ epoch: Date.UTC(2026, 7, 1), format: 'iso-date' })
    expect(parseDateCell('2026/8/2')).toEqual({ epoch: Date.UTC(2026, 7, 2), format: 'slash-date' })
    expect(parseDateCell('2026-08-01T10:30:00Z')?.format).toBe('datetime')
    expect(dateFormatOf('2026-08-01')).toBe('iso-date')
    expect(dateFormatOf('2026/8/2')).toBe('slash-date')
    expect(dateFormatOf('nope')).toBeUndefined()
  })
})

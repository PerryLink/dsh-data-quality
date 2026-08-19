/**
 * Config schema and resolution for `dsh-data-quality`. Every tunable is a
 * validated {@link Config} field changeable from cordis.yml; the resolution
 * step validates bounds so misconfiguration fails loud at mount.
 * @module dsh-data-quality/config
 */

import z from '@deepseek-ai/schemastery'

/** Raw plugin config — every field optional; {@link resolveConfig} supplies the defaults. */
export interface Config {
  /** Master switch; `false` mounts nothing. */
  enabled?: boolean
  /** Hard row cap per dataset load. */
  maxRows?: number
  /** Hard file-size cap in MiB per dataset load. */
  maxFileSizeMB?: number
  /** Default relative tolerance for numeric citation comparison. */
  defaultTolerance?: number
  /** Cap on evidence rows (verify) and preview rows (clean) in one result. */
  evidenceRowLimit?: number
  /** Extensions accepted as datasets (dot-prefixed, lowercase). */
  allowedExtensions?: string[]
  /** Absolute root for service-level calls without a session workspace; empty = process launch directory. */
  workspaceRoot?: string
  /** Persist reports to the `data_quality` storage domain. */
  storeReports?: boolean
}

/** Fully resolved config handed to the runtime. */
export interface ResolvedConfig {
  readonly enabled: boolean
  readonly maxRows: number
  readonly maxFileSizeMB: number
  readonly defaultTolerance: number
  readonly evidenceRowLimit: number
  readonly allowedExtensions: readonly string[]
  readonly workspaceRoot: string
  readonly storeReports: boolean
}

/** Schemastery schema: the loader validates and fills defaults before `apply`. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  maxRows: z.number().default(200_000),
  maxFileSizeMB: z.number().default(64),
  defaultTolerance: z.number().default(1e-9),
  evidenceRowLimit: z.number().default(20),
  allowedExtensions: z.array(z.string()).default(['.csv', '.tsv', '.json', '.jsonl']),
  workspaceRoot: z.string().default(''),
  storeReports: z.boolean().default(true),
})

/** Throw unless `value` is a positive safe integer. */
function assertPositiveInt(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive safe integer, got ${String(value)}`)
  }
}

/** Throw unless `value` is a finite number in `[min, max]`. */
function assertFiniteRange(name: string, value: number, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`${name} must be a finite number in [${min}, ${max}], got ${String(value)}`)
  }
}

/**
 * Validate raw values and fill explicit defaults. Invalid bounds throw here —
 * misconfiguration fails loud at mount even without the Schemastery loader.
 * @param config - raw (possibly partial) plugin config.
 * @returns the fully resolved config.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const maxRows = config.maxRows ?? 200_000
  assertPositiveInt('maxRows', maxRows)
  const maxFileSizeMB = config.maxFileSizeMB ?? 64
  assertFiniteRange('maxFileSizeMB', maxFileSizeMB, Number.MIN_VALUE, 1024)
  const defaultTolerance = config.defaultTolerance ?? 1e-9
  assertFiniteRange('defaultTolerance', defaultTolerance, 0, 1)
  const evidenceRowLimit = config.evidenceRowLimit ?? 20
  assertPositiveInt('evidenceRowLimit', evidenceRowLimit)

  const allowedExtensions = (config.allowedExtensions ?? ['.csv', '.tsv', '.json', '.jsonl']).map((ext) => {
    if (!/^\.[a-z0-9]+$/u.test(ext)) {
      throw new TypeError(`allowedExtensions entries must be dot-prefixed lowercase extensions, got ${JSON.stringify(ext)}`)
    }
    return ext
  })
  if (allowedExtensions.length === 0) {
    throw new TypeError('allowedExtensions must not be empty')
  }

  return {
    enabled: config.enabled ?? true,
    maxRows,
    maxFileSizeMB,
    defaultTolerance,
    evidenceRowLimit,
    allowedExtensions,
    workspaceRoot: config.workspaceRoot ?? '',
    storeReports: config.storeReports ?? true,
  }
}

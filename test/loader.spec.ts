/**
 * Real Loader composition test (C3): an independent process boots a real
 * Cordis `Context` + the vendored Loader with the Include builtin, reads a
 * generated `cordis.yml` (storage seam + system prompt + tools + the BUILT
 * plugin bundle), asserts the plugin's contributions through the authoritative
 * registries, then runs the keyless profile → clean → verify chain over the
 * fixtures workspace. This is the five-layer model's layer 4, distinct from
 * the in-process `test/harness.ts` ctx harness.
 * @module dsh-data-quality/test/loader.spec
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const runnerPath = path.join(root, 'scripts', 'loader-runner.mjs')
const preparePath = path.join(root, 'scripts', 'prepare.mjs')
const libIndex = path.join(root, 'lib', 'index.js')

let workspace = ''
let storageRoot = ''
let cordisPath = ''

beforeAll(async () => {
  // The loader-runner imports the BUILT bundle, so rebuild the current source
  // first (deterministic, ~2s) regardless of `pnpm test` vs `pnpm build` order.
  const build = spawnSync(process.execPath, [preparePath], { encoding: 'utf8', cwd: root, timeout: 120_000 })
  expect(build.status, `prepare failed: ${build.stderr}`).toBe(0)

  workspace = await mkdtemp(path.join(tmpdir(), 'dq-loader-work-'))
  storageRoot = await mkdtemp(path.join(tmpdir(), 'dq-loader-store-'))
  await copyFile(path.join(root, 'fixtures', 'dirty-fund-holdings.csv'), path.join(workspace, 'dirty-fund-holdings.csv'))

  const cordis = [
    '- id: storage',
    "  name: '@deepseek-ai/dsh-storage'",
    '',
    '- id: storage-json',
    "  name: '@deepseek-ai/dsh-storage-json'",
    `  config:\n    root: ${JSON.stringify(storageRoot)}`,
    '',
    '- id: storage-domain',
    "  name: '@deepseek-ai/dsh-storage-domain'",
    '  config:',
    '    backend: json',
    '',
    '- id: system-prompt',
    "  name: '@deepseek-ai/dsh-system-prompt'",
    '  config:',
    "    persona: ''",
    '',
    '- id: tools',
    "  name: '@deepseek-ai/dsh-tools'",
    '',
    '- id: dsh-data-quality',
    `  name: ${JSON.stringify(pathToFileURL(libIndex).href)}`,
    '  config:',
    `    workspaceRoot: ${JSON.stringify(workspace)}`,
    '',
  ].join('\n')
  cordisPath = path.join(workspace, 'cordis.yml')
  await writeFile(cordisPath, cordis)
})

afterAll(async () => {
  const roots = [workspace, storageRoot].filter((dir) => dir !== '')
  for (const dir of roots) {
    if (!dir.startsWith(path.join(tmpdir(), 'dq-loader-'))) throw new Error(`refusing to remove non-harness dir: ${dir}`)
    await rm(dir, { recursive: true, force: true })
  }
})

describe('real Loader composition (C3)', () => {
  it('mounts the seam through an independent cordis.yml process and runs the keyless chain', () => {
    const result = spawnSync(process.execPath, [runnerPath, cordisPath, workspace], {
      encoding: 'utf8',
      cwd: root,
      timeout: 120_000,
    })
    expect(result.status, `loader-runner failed:\n${result.stderr ?? ''}`).toBe(0)

    const match = /DSH_LOADER_RESULT (.+)\n/u.exec(result.stdout ?? '')
    expect(match, `loader-runner printed no result marker:\n${result.stdout ?? ''}`).toBeTruthy()
    const summary = JSON.parse(match![1] as string) as {
      tools: string[]
      profileRows: number
      profileColumns: number
      cleanOutputRows: number
      verifyPassed: boolean
      citationStatus: string
    }

    expect(summary.tools).toEqual(expect.arrayContaining(['data_profile', 'data_clean', 'data_verify']))
    expect(summary.profileRows).toBe(10)
    expect(summary.profileColumns).toBe(6)
    expect(summary.cleanOutputRows).toBe(8)
    expect(summary.verifyPassed).toBe(false)
    expect(summary.citationStatus).toBe('verified')
  }, 120_000)
})

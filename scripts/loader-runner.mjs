// scripts/loader-runner.mjs — real Loader composition runner (community
// five-layer model, layer 4) plus the keyless three-tool chain smoke. An
// independent process boots a real Context, mounts the vendored Loader with
// the Include builtin, reads the given cordis.yml (storage rows + the plugin
// row + config), asserts the plugin's contributions through the authoritative
// registries, then executes data_profile -> data_clean -> data_verify through
// the REAL tools pipeline against the fixtures workspace.
//
// Usage: node scripts/loader-runner.mjs <cordis.yml> <workspaceDir>
// Exit 0 prints DSH_LOADER_RESULT <json>; any assertion or execution failure
// exits non-zero with the reason on stderr.

import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import { CallId } from '@deepseek-ai/dsh-llm'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const configArgument = process.argv[2]
const workspaceArgument = process.argv[3]
if (configArgument === undefined || workspaceArgument === undefined) {
  console.error('usage: loader-runner.mjs <cordis.yml> <workspaceDir>')
  process.exit(2)
}

const configPath = resolve(configArgument)
const workspace = resolve(workspaceArgument)
// Resolve bare package rows from this repository's dependency tree so the
// composition works with config files written anywhere (e.g. a temp dir).
const configRequire = createRequire(resolve(import.meta.dirname, '../package.json'))

const ctx = new Context()
try {
  ctx.baseUrl = `${pathToFileURL(dirname(configPath)).href}/`
  await ctx.plugin(Loader)
  ctx.loader.internal = /** @type {any} */ ({
    version: 'v2',
    async import(specifier) {
      if (specifier.startsWith('file:')) return import(specifier)
      if (specifier.startsWith('node:')) return import(specifier)
      const absolute = /^([a-zA-Z]:)?[\\/]/u.test(specifier)
      return import(pathToFileURL(absolute ? specifier : configRequire.resolve(specifier)).href)
    },
  })
  ctx.loader.builtins.include = Include
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()

  // Authoritative registries carry the plugin's contributions.
  const names = ctx.tools.schemas().map((schema) => schema.name)
  for (const tool of ['data_profile', 'data_clean', 'data_verify']) {
    if (!names.includes(tool)) {
      throw new Error(`Loader composition: ${tool} is missing from the tools registry (have: ${names.join(', ')})`)
    }
  }
  if (typeof ctx.dataQuality?.verifyCitations !== 'function') {
    throw new Error('Loader composition: ctx.dataQuality.verifyCitations is missing')
  }

  // Real session + minimal agent so the tools resolve the fixtures workspace.
  const store = new SessionStore(ctx)
  const session = store.create(SessionId('dsh-data-quality-loader-runner'), {
    meta: { cwd: workspace },
  })
  const agent = /** @type {any} */ ({
    id: session.id,
    options: {},
    session,
    status: 'idle',
    ctx,
  })

  /** Execute one tool through the real pipeline; fail on isError. */
  const run = async (name, args) => {
    const result = await ctx.tools.execute({
      callId: CallId(`smoke-${name}`),
      name,
      arguments: args,
      agent,
      signal: new AbortController().signal,
    })
    if (result.isError) {
      throw new Error(`${name} failed: ${result.error?.message ?? 'unknown error'}`)
    }
    return result.value
  }

  const profile = await run('data_profile', { path: 'dirty-fund-holdings.csv' })
  const cleaned = await run('data_clean', {
    path: 'dirty-fund-holdings.csv',
    rules: [
      { rule: 'trim' },
      { rule: 'dedupe', columns: ['fund_code'] },
      { rule: 'normalize-unit', column: 'holding_value', factors: { 万: 10000, 亿: 100000000 } },
      { rule: 'coerce-type', column: 'holding_value', to: 'number' },
    ],
    outputPath: 'cleaned-fund-holdings.csv',
  })
  const verify = await run('data_verify', {
    path: 'cleaned-fund-holdings.csv',
    rules: [
      { rule: 'not-null', column: 'fund_code' },
      { rule: 'unique', columns: ['fund_code'] },
      { rule: 'range', column: 'holding_value', min: 0 },
    ],
  })
  const citations = await ctx.dataQuality.verifyCitations({
    dataset: 'dirty-fund-holdings.csv',
    citations: [{ id: 'c1', path: 'rows[0].fund_code', value: 'FUND001' }],
  })

  const summary = {
    tools: names.filter((name) => name.startsWith('data_')),
    profileRows: profile.rowCount,
    profileColumns: profile.columnCount,
    cleanOutputRows: cleaned.outputRows,
    verifyPassed: verify.passed,
    citationStatus: citations.results[0]?.status,
  }
  process.stdout.write(`DSH_LOADER_RESULT ${JSON.stringify(summary)}\n`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await ctx.fiber.dispose()
}

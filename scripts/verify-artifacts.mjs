// Verify the built artifacts after `pnpm run build`: syntax-check the host
// bundle, import it under plain Node, and assert the shipped files the
// export path needs. Guards against TypeScript-only syntax leaking into
// shipped output and against a tarball missing the bundle patch.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const required = [
  'lib/index.js',
  'lib/types/index.d.ts',
  'cordis.patch.yml',
]
for (const rel of required) {
  if (!existsSync(path.join(root, rel))) throw new Error(`missing artifact: ${rel}`)
}

// 1. Syntax-check the host bundle (plain Node parse; no execution).
execFileSync(process.execPath, ['--check', path.join(root, 'lib/index.js')], { stdio: 'inherit' })

// 2. No leftover `.ts` relative imports in the shipped bundle or declarations
//    (would crash plain-Node ESM consumers).
const scan = (dir, predicate) => {
  const hits = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      hits.push(...scan(full, predicate))
    } else if (predicate(entry.name) && /from\s+['"]\.[^'"]+\.tsx?['"]/u.test(readFileSync(full, 'utf8'))) {
      hits.push(full)
    }
  }
  return hits
}
const leftovers = [
  ...scan(path.join(root, 'lib'), (name) => name.endsWith('.js')),
  ...scan(path.join(root, 'lib', 'types'), (name) => name.endsWith('.d.ts')),
]
if (leftovers.length > 0) {
  throw new Error(`leftover .ts imports in build artifacts:\n${leftovers.join('\n')}`)
}

// 3. The ESM host face must import under plain Node (no tsx, no checkout paths).
const index = await import(pathToFileURL(path.join(root, 'lib/index.js')).href)
if (typeof index.apply !== 'function' || index.name !== 'data-quality') {
  throw new Error('lib/index.js exports an unexpected plugin face')
}
if (!Array.isArray(index.inject) || !index.inject.includes('tools') || !index.inject.includes('storageDomain')) {
  throw new Error('lib/index.js does not declare the tools + storageDomain injects')
}
if (index.default !== undefined) {
  throw new Error('lib/index.js must not carry a default export')
}

// 4. The bundled config must expose the schema const and the resolve step.
if (typeof index.Config !== 'function' || typeof index.resolveConfig !== 'function') {
  throw new Error('lib/index.js does not re-export Config and resolveConfig')
}

console.log('artifacts OK: syntax + ESM import + plugin face + no .ts leftovers + bundle patch present')

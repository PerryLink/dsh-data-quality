/**
 * Plugin face tests: the source module's default-export negative (C2) and the
 * three tools' registered interface — parameters/output schema, the canonical
 * value validated against the declared output schema, and the text content
 * block every tool renders (U2).
 * @module dsh-data-quality/test/face.spec
 */

import { afterEach, describe, expect, it } from 'vitest'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateJsonSchemaValue, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { mountBase, runTool, unmountBase, DIRTY_CSV, type BaseHarness } from './harness.ts'

const fibers: Array<{ dispose(): Promise<void> }> = []
const bases: BaseHarness[] = []
afterEach(async () => {
  await Promise.all(fibers.splice(0).map((fiber) => fiber.dispose()))
  await Promise.all(bases.splice(0).map((base) => unmountBase(base)))
})

/** Mount the plugin on a harness context. */
async function mountPlugin(base: BaseHarness, config: Record<string, unknown> = {}): Promise<void> {
  const plugin = await import('../src/index.ts')
  const fiber = await base.ctx.plugin(plugin as never, config as never)
  fibers.push(fiber)
}

/** A model-facing JSON Schema object node (subset shape). */
interface ObjectSchema {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
}

/** Assert an object-rooted parameters/output schema exposes the named fields. */
function assertObjectSchema(schema: unknown, requiredFields: string[], label: string): void {
  expect(schema, `${label} must be an object`).toBeTruthy()
  const node = schema as ObjectSchema
  expect(node.type, `${label}.type`).toBe('object')
  expect(node.properties, `${label}.properties`).toBeTruthy()
  for (const field of requiredFields) {
    expect(Object.keys(node.properties ?? {}), `${label}.properties keys`).toContain(field)
  }
}

/** Assert a canonical tool value satisfies its declared output schema and renders text content. */
function assertCanonicalAndContent(def: ToolDefinition, value: unknown, content: ContentBlock[]): void {
  const violations = validateJsonSchemaValue(def.output.schema, value as never, 'value')
  expect(violations, `${def.name} canonical value must satisfy its output schema`).toEqual([])
  expect(content.length, `${def.name} renders content blocks`).toBeGreaterThan(0)
  const first = content[0]
  expect(first, `${def.name} first block`).toBeTruthy()
  expect(first?.type, `${def.name} content type`).toBe('text')
  expect((first as { text?: string } | undefined)?.text?.length ?? 0, `${def.name} text length`).toBeGreaterThan(0)
}

describe('module face (C2)', () => {
  it('has no default export and declares the required injects', async () => {
    const plugin = await import('../src/index.ts')
    expect('default' in plugin, 'no default export').toBe(false)
    expect((plugin as unknown as { default?: unknown }).default).toBeUndefined()
    expect(plugin.name).toBe('data-quality')
    expect(plugin.inject).toContain('tools')
    expect(plugin.inject).toContain('storageDomain')
  })
})

describe('tool triple interface (U2)', () => {
  it('registers all three tools in the model-facing schema registry', async () => {
    const base = await mountBase('dq-face-registry')
    bases.push(base)
    await mountPlugin(base)
    const names = base.ctx.tools.schemas().map((schema) => schema.name)
    expect(names).toEqual(expect.arrayContaining(['data_profile', 'data_clean', 'data_verify']))
  })

  it('data_profile: schema + canonical + content block', async () => {
    const base = await mountBase('dq-face-profile')
    bases.push(base)
    await mountPlugin(base)
    await writeFile(path.join(base.workspace, 'dirty.csv'), DIRTY_CSV)

    const def = base.ctx.tools.get('data_profile')
    expect(def).toBeDefined()
    assertObjectSchema(def?.parameters, ['path'], 'data_profile.parameters')
    assertObjectSchema(def?.output.schema, ['dataset', 'rowCount', 'columnCount', 'duplicateRows', 'columns'], 'data_profile.output.schema')

    const result = await runTool(base, 'data_profile', { path: 'dirty.csv' })
    expect(result.isError).toBe(false)
    if (result.isError) return
    assertCanonicalAndContent(def as ToolDefinition, result.value, result.content)
    expect((result.value as { rowCount: number }).rowCount).toBe(10)
  })

  it('data_clean: schema + canonical + content block', async () => {
    const base = await mountBase('dq-face-clean')
    bases.push(base)
    await mountPlugin(base)
    await writeFile(path.join(base.workspace, 'dirty.csv'), DIRTY_CSV)

    const def = base.ctx.tools.get('data_clean')
    expect(def).toBeDefined()
    assertObjectSchema(def?.parameters, ['path', 'rules'], 'data_clean.parameters')
    assertObjectSchema(def?.output.schema, ['dataset', 'inputRows', 'outputRows', 'logs', 'preview'], 'data_clean.output.schema')

    const result = await runTool(base, 'data_clean', { path: 'dirty.csv', rules: [{ rule: 'trim' }] })
    expect(result.isError).toBe(false)
    if (result.isError) return
    assertCanonicalAndContent(def as ToolDefinition, result.value, result.content)
  })

  it('data_verify: schema + canonical + content block', async () => {
    const base = await mountBase('dq-face-verify')
    bases.push(base)
    await mountPlugin(base)
    await writeFile(path.join(base.workspace, 'dirty.csv'), DIRTY_CSV)

    const def = base.ctx.tools.get('data_verify')
    expect(def).toBeDefined()
    assertObjectSchema(def?.parameters, ['path', 'rules'], 'data_verify.parameters')
    assertObjectSchema(def?.output.schema, ['dataset', 'passed', 'rowCount', 'rules'], 'data_verify.output.schema')

    const result = await runTool(base, 'data_verify', { path: 'dirty.csv', rules: [{ rule: 'not-null', column: 'fund_code' }] })
    expect(result.isError).toBe(false)
    if (result.isError) return
    assertCanonicalAndContent(def as ToolDefinition, result.value, result.content)
  })
})

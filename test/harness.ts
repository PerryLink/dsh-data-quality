/**
 * Shared test harness: REAL Cordis `Context`, REAL `SessionStore`/`Session`,
 * the REAL storage seam (dsh-storage + dsh-storage-json backend + the
 * dsh-storage-domain facility) rooted in a per-mount temp directory, and the
 * REAL `ToolRuntime` from the 0.1.1-rc.2 peers. Nothing here is a hand-written
 * mock of a service. The workspace is a per-mount temp directory the tests
 * fill with fixture files.
 * @module dsh-data-quality/test/harness
 */

import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { apply as jsonApply, Config as jsonConfig } from '@deepseek-ai/dsh-storage-json'
import { apply as domainApply, Config as domainConfig } from '@deepseek-ai/dsh-storage-domain'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { CallId } from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'

/** Everything a mounted base hands back to a test. */
export interface BaseHarness {
  /** The mounting context (session store + storage domain + tools). */
  readonly ctx: Context
  /** A real session created on the mounted store, cwd = the temp workspace. */
  readonly session: Session
  /** A minimal real-shaped agent pointing at the session. */
  readonly agent: Agent
  /** The temp workspace root (dataset fixture files live here). */
  readonly workspace: string
  /** The storage backend root. */
  readonly storageRoot: string
}

/**
 * Mount the real services the plugin injects, plus a real session whose cwd
 * is a fresh temp workspace, and a minimal agent for tool execution.
 * @param sessionId - session id to create (unique per test).
 * @returns the mounted base.
 */
export async function mountBase(sessionId: string): Promise<BaseHarness> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(Storage)
  const storageRoot = await mkdtemp(path.join(tmpdir(), 'dq-store-'))
  await ctx.plugin({ apply: jsonApply, Config: jsonConfig, inject: ['storage'] }, { root: storageRoot })
  await ctx.plugin({ apply: domainApply, Config: domainConfig, inject: ['storage'] }, { backend: 'json' })
  // ToolRuntime injects systemPrompt; mount it first (real service, like dsh-fast's harness).
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  const workspace = await mkdtemp(path.join(tmpdir(), 'dq-work-'))
  const session = ctx.sessions.create(SessionId(sessionId), { meta: { cwd: workspace } })
  const agent = {
    session,
    status: 'idle',
    options: {},
    reserveTurnAdmission: () => () => undefined,
  } as unknown as Agent
  return { ctx, session, agent, workspace, storageRoot }
}

/** Remove the temp roots a base was mounted on (only own mkdtemp dirs). */
export async function unmountBase(base: BaseHarness): Promise<void> {
  for (const root of [base.workspace, base.storageRoot]) {
    const expected = root.includes('dq-work-') ? path.join(tmpdir(), 'dq-work-') : path.join(tmpdir(), 'dq-store-')
    if (!root.startsWith(expected)) throw new Error(`refusing to remove non-harness dir: ${root}`)
    await rm(root, { recursive: true, force: true })
  }
}

let callCounter = 0

/**
 * Execute one tool through the REAL tools pipeline (validation, policy,
 * dispatch, render) and return the materialized result.
 * @param base - the mounted base.
 * @param name - the tool name.
 * @param args - the tool arguments.
 * @returns the execution result (check `isError`).
 */
export async function runTool(base: BaseHarness, name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  callCounter += 1
  return base.ctx.tools.execute({
    callId: CallId(`test-${name}-${callCounter}`),
    name,
    arguments: args,
    agent: base.agent,
    signal: new AbortController().signal,
  })
}

/** The dirty CSV fixture shared by engine and plugin tests. */
export const DIRTY_CSV = `fund_code,fund_name,nav,nav_date,holding_value,currency
FUND001,  Alpha Growth ,1.234,2026-08-01,5000万,CNY
FUND002,Beta Income,0.987,2026/08/02,120000000,CNY
FUND001,Alpha Growth,1.234,2026-08-01,5000万,CNY
FUND003,Gamma Tech,,2026-08-03,2.5亿,CNY
FUND004,Delta Value,2.3456,not-a-date,8000,HKD
FUND005, Epsilon Bond ,0.556,2026-08-05,,CNY
FUND006,Zeta Mixed,abc,2026-08-06,1500万,CNY
FUND007,Eta Quant,88.5,2026-08-07,9.99亿,CNY
FUND002,Beta Income,0.987,2026/08/02,120000000,CNY
FUND008,Theta Stable,1.001,2026-08-08,3000万,cny
`

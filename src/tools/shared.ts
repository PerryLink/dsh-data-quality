/**
 * Shared helpers for the three data-quality model tools: session workspace
 * resolution and a compact cleaning-run text render. Kept presentation-only;
 * computation lives in the engines and the provider.
 * @module dsh-data-quality/tools-shared
 */

import path from 'node:path'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { CleanRunReport } from '../service.ts'

/**
 * The absolute workspace root a tool call resolves dataset paths against: the
 * calling agent's per-session cwd (mirroring the official fs tools). Non-agent
 * calls fail loud — there is no honest workspace to confine paths to.
 * @param exec - the tool-execution context.
 * @returns the absolute workspace root.
 */
export function workspaceOf(exec: ToolExecution): string {
  const cwd = exec.agent?.session.header.cwd
  if (cwd === undefined) {
    throw new Error('data-quality tools require an agent-owned session workspace')
  }
  return path.resolve(cwd)
}

/** Human-readable cleaning summary for the tool's Native render. */
export function renderCleanText(report: CleanRunReport): string {
  const lines: string[] = []
  lines.push(`Cleaned ${report.dataset}: ${report.inputRows} -> ${report.outputRows} rows over ${report.logs.length} rule(s)`)
  for (const log of report.logs) {
    lines.push(`- rule ${log.ruleIndex} (${log.rule}): ${log.affectedRows} row(s) affected; ${log.detail}`)
  }
  if (report.outputPath !== undefined) {
    lines.push(`Wrote cleaned dataset to ${report.outputPath}`)
  } else {
    lines.push('No outputPath given: the source file was left untouched; preview below.')
  }
  if (report.preview.rows.length > 0) {
    lines.push(`Preview (first ${report.preview.rows.length} row(s)):`)
    for (const row of report.preview.rows) {
      const cells = report.preview.columns.map((column) => `${column}=${JSON.stringify(row[column] ?? null)}`).join(', ')
      lines.push(`  ${cells}`)
    }
  }
  return lines.join('\n')
}

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
  const mode = report.dryRun ? 'Dry-run plan for' : 'Cleaned'
  lines.push(`${mode} ${report.dataset}: ${report.inputRows} -> ${report.outputRows} rows over ${report.logs.length} rule(s)`)
  for (const log of report.logs) {
    lines.push(`- rule ${log.ruleIndex} (${log.rule}): ${log.affectedRows} row(s) affected; ${log.detail}`)
  }
  const contract = report.contract
  const keyLabel = contract.dedupeColumns === null ? 'full rows' : `[${contract.dedupeColumns.join(', ')}]`
  lines.push(`Contract: ${contract.inputRows} -> ${contract.outputRows} rows (${contract.removedRows} removed); uniqueness ${contract.uniqueKeys ? 'OK' : 'VIOLATED'} over ${keyLabel}${contract.remainingDuplicateRows > 0 ? ` (${contract.remainingDuplicateRows} duplicate row(s) remain)` : ''}`)
  for (const entry of contract.remainingMissing) {
    lines.push(`- non-null regression: ${entry.column} still has ${entry.count} missing cell(s)`)
  }
  for (const entry of contract.typeConformance) {
    lines.push(`- type regression: ${entry.column} (${entry.to}) has ${entry.invalidCount} non-conforming cell(s)`)
  }
  for (const entry of contract.columnDecisions) {
    const decisions = entry.decisions.map((decision) => `${decision.strategy} (${decision.affectedRows} row(s))`).join(', ')
    lines.push(`- column ${entry.column}: ${decisions}`)
  }
  if (report.diffPreview !== undefined) {
    lines.push(`Diff preview: ${report.diffPreview.before.rowCount} -> ${report.diffPreview.after.rowCount} rows; duplicates ${report.diffPreview.before.duplicateRows} -> ${report.diffPreview.after.duplicateRows}`)
  }
  if (report.dryRun) {
    lines.push('Dry run: no output file written and no report persisted; plan/preview above.')
  } else if (report.outputPath !== undefined) {
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

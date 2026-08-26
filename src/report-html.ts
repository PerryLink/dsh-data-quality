/**
 * Self-contained offline HTML renderers for persisted data-quality reports.
 *
 * `data_report` (with `format: html`) turns a profile or clean report into a
 * single `.html` file that opens offline: every style rule and every script is
 * inlined, there are no external requests (no CDN, no `<link>`, no `<script
 * src>`), and all dataset values are HTML-escaped before they reach the
 * markup. The document carries the DAMA six-dimension scorecard, the
 * per-column profile summary, and (for clean reports) the per-rule cleaning
 * summary table.
 *
 * Pure and deterministic: the only clock is the report's own `generatedAt`;
 * nothing here reads the filesystem or the network.
 * @module dsh-data-quality/report-html
 */

import type { ProfileReport } from './profile.ts'
import { REPORT_SCHEMA_VERSION } from './version.ts'

/** Minimal structural view of a clean report's per-rule audit + row contract. */
export interface CleanReportHtml {
  readonly inputRows: number
  readonly outputRows: number
  readonly logs: ReadonlyArray<{ readonly rule: string; readonly affectedRows: number; readonly detail: string }>
}

/** Escape text for safe embedding in an HTML document. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Render a 0..1 rate as a percentage string, or `—` when undetermined. */
function pct(score: number | null): string {
  return score === null ? '—' : `${(score * 100).toFixed(1)}%`
}

/** The shared document shell: inline CSS + inline JS, no external requests. */
function shell(title: string, body: string, script: string): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    '  :root { --ink: #1a1f2e; --muted: #6b7280; --line: #e5e7eb; --accent: #0f766e; --fail: #b91c1c; --warn: #b45309; --pass: #15803d; }',
    '  * { box-sizing: border-box; }',
    '  body { margin: 0; padding: 24px; font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: #f8fafc; }',
    '  header { margin-bottom: 20px; }',
    '  h1 { font-size: 20px; margin: 0 0 4px; }',
    '  .meta { color: var(--muted); font-size: 12px; }',
    '  section { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }',
    '  h2 { font-size: 15px; margin: 0 0 12px; }',
    '  table { border-collapse: collapse; width: 100%; font-size: 13px; }',
    '  th, td { text-align: left; padding: 6px 10px; border-top: 1px solid var(--line); vertical-align: top; }',
    '  th { color: var(--muted); font-weight: 600; }',
    '  .score-cell { font-variant-numeric: tabular-nums; }',
    '  .dim-fail { color: var(--fail); font-weight: 600; }',
    '  .dim-warn { color: var(--warn); }',
    '  .dim-pass { color: var(--pass); }',
    '  .dim-undetermined { color: var(--muted); }',
    '  button { cursor: pointer; font: inherit; }',
    '</style>',
    '</head>',
    '<body>',
    body,
    '<script>',
    script,
    '</script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

/** The DAMA six-dimension scorecard section. */
function scorecardSection(report: ProfileReport): string {
  const rows = report.scorecard.dimensions.map((dimension) => {
    const cls = dimension.score === null
      ? 'dim-undetermined'
      : dimension.score >= 0.9 ? 'dim-pass'
        : dimension.score >= 0.7 ? 'dim-warn'
          : 'dim-fail'
    return `<tr><td>${escapeHtml(dimension.name)}</td><td class="score-cell ${cls}">${pct(dimension.score)}</td><td>${escapeHtml(dimension.note)}</td></tr>`
  }).join('\n')
  const overall = report.scorecard.overall
  const weighted = report.scorecard.weightedOverall
  return [
    '<section>',
    '<h2>DAMA six-dimension quality scorecard</h2>',
    '<table>',
    '<thead><tr><th>Dimension</th><th>Score</th><th>Note</th></tr></thead>',
    '<tbody>',
    rows,
    '</tbody>',
    '</table>',
    `<p class="meta" id="summary-text">overall ${pct(overall)} · weighted ${pct(weighted)}</p>`,
    '</section>',
  ].join('\n')
}

/** The per-column profile summary table. */
function columnsSection(report: ProfileReport): string {
  const rows = report.columns.map((column) => {
    const numeric = column.numeric
    const numericCell = numeric === undefined
      ? '—'
      : `min ${numeric.min} · p25 ${numeric.p25} · median ${numeric.median} · p75 ${numeric.p75} · max ${numeric.max} · mean ${numeric.mean}${numeric.outliers > 0 ? ` · ${numeric.outliers} IQR outliers` : ''}`
    const top = column.topValues === undefined
      ? '—'
      : column.topValues.map((entry) => `${escapeHtml(entry.value)} ×${entry.count}`).join(', ')
    const notes = column.notes.length === 0 ? '' : `<p class="meta">${column.notes.map(escapeHtml).join('; ')}</p>`
    return [
      '<tr>',
      `<td>${escapeHtml(column.name)}</td>`,
      `<td>${escapeHtml(column.inferredType)}</td>`,
      `<td class="score-cell">${column.missing}</td>`,
      `<td class="score-cell">${(column.missingRate * 100).toFixed(1)}%</td>`,
      `<td class="score-cell">${column.unique}</td>`,
      `<td>${numericCell}</td>`,
      `<td>${top}</td>`,
      `<td>${notes}</td>`,
      '</tr>',
    ].join('')
  }).join('\n')
  return [
    '<section>',
    '<h2>Column profile</h2>',
    '<table>',
    '<thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Missing rate</th><th>Unique</th><th>Numeric distribution</th><th>Top values</th><th>Notes</th></tr></thead>',
    '<tbody>',
    rows,
    '</tbody>',
    '</table>',
    '</section>',
  ].join('\n')
}

/**
 * Render a profile report as a self-contained offline HTML document.
 * @param report - the profile report (already persisted/returned by data_profile).
 * @returns the complete single-file HTML.
 */
export function renderProfileHtml(report: ProfileReport): string {
  const body = [
    '<header>',
    `<h1>Data profile: ${escapeHtml(report.dataset)}</h1>`,
    `<p class="meta">${report.rowCount} rows × ${report.columnCount} columns · generated ${new Date(report.generatedAt).toISOString()} · schema v${REPORT_SCHEMA_VERSION} · report ${report.reportKey ?? '(unpersisted)'}</p>`,
    '<button id="copy-summary" type="button">Copy summary</button>',
    '</header>',
    scorecardSection(report),
    columnsSection(report),
  ].join('\n')
  const script = [
    "const button = document.getElementById('copy-summary');",
    'if (button) {',
    '  button.addEventListener("click", () => {',
    '    const text = document.getElementById("summary-text");',
    '    if (text && navigator.clipboard) navigator.clipboard.writeText(text.textContent || "");',
    '  });',
    '}',
  ].join('\n')
  return shell(`Data profile: ${report.dataset}`, body, script)
}

/** The per-rule cleaning summary table (for clean/clean-diff reports). */
function cleaningSection(report: CleanReportHtml): string {
  const rows = report.logs.map((log) => {
    return `<tr><td>${escapeHtml(log.rule)}</td><td class="score-cell">${log.affectedRows}</td><td>${escapeHtml(log.detail)}</td></tr>`
  }).join('\n')
  const removed = report.inputRows - report.outputRows
  return [
    '<section>',
    '<h2>Cleaning summary</h2>',
    `<p class="meta" id="summary-text">input ${report.inputRows} rows · output ${report.outputRows} rows · removed ${removed} rows</p>`,
    '<table>',
    '<thead><tr><th>Rule</th><th>Affected rows</th><th>Detail</th></tr></thead>',
    '<tbody>',
    rows,
    '</tbody>',
    '</table>',
    '</section>',
  ].join('\n')
}

/**
 * Render a clean report as a self-contained offline HTML document (the
 * per-rule cleaning summary table).
 * @param report - the clean report (logs + input/output row counts).
 * @param dataset - the dataset label for the document title.
 * @returns the complete single-file HTML.
 */
export function renderCleanHtml(report: CleanReportHtml, dataset: string): string {
  const body = [
    '<header>',
    `<h1>Cleaning report: ${escapeHtml(dataset)}</h1>`,
    `<p class="meta">schema v${REPORT_SCHEMA_VERSION}</p>`,
    '</header>',
    cleaningSection(report),
  ].join('\n')
  const script = "// no interactive behavior needed; everything renders without external requests\n"
  return shell(`Cleaning report: ${dataset}`, body, script)
}

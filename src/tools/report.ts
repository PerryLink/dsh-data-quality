/**
 * The `data_report` model tool: read persisted profile/clean-diff reports
 * back from the `data_quality` storage domain, by exact `reportKey` or by
 * `kind`. Deterministic read-only consumption 鈥?no model arithmetic.
 * @module dsh-data-quality/tools/report
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { ProfileReport } from '../profile.ts'
import { renderCleanHtml, renderProfileHtml, type CleanReportHtml } from '../report-html.ts'
import type { DataQualityService } from '../service.ts'
import type { ReportRecord, StoredReport } from '../store.ts'

/** The report kinds a caller may query. */
const REPORT_KINDS = ['profile', 'clean', 'clean-diff', 'verify', 'citations'] as const

/** One stored report projected into the model-facing canonical value (report as lossless JSON). */
interface ReportView {
  readonly key: string
  readonly kind: ReportRecord['kind']
  readonly at: number
  readonly dataset: string
  readonly report: JsonValue
}

/** The canonical value the tool returns. */
interface DataReportValue {
  readonly key?: string
  readonly kind?: ReportRecord['kind']
  readonly records: ReportView[]
  /** Self-contained offline HTML (present only when `format: html`). */
  readonly html?: string
}

/** Render one stored report as a self-contained HTML document (profile/clean only). */
function renderRecordHtml(record: StoredReport): string {
  if (record.kind === 'profile') {
    return renderProfileHtml(record.report as unknown as ProfileReport)
  }
  if (record.kind === 'clean' || record.kind === 'clean-diff') {
    return renderCleanHtml(record.report as unknown as CleanReportHtml, record.dataset)
  }
  throw new Error(`data_report html format does not support kind "${record.kind}" (profile/clean only)`)
}

/** Project a stored report into the canonical value (the stored report is already lossless JSON). */
function toView(record: StoredReport): ReportView {
  return { key: record.key, kind: record.kind, at: record.at, dataset: record.dataset, report: record.report as unknown as JsonValue }
}

/** Human-readable report summary for the tool's Native render. */
function renderReportText(value: DataReportValue): string {
  const lines: string[] = []
  if (value.key !== undefined) {
    lines.push(value.records.length === 0 ? `No report for ${value.key}` : `Report ${value.key}`)
  } else {
    lines.push(`Reports of kind ${value.kind ?? ''} (${value.records.length})`)
  }
  for (const record of value.records) {
    lines.push(`- ${record.key} [${record.kind}] ${record.dataset} @ ${new Date(record.at).toISOString()}`)
  }
  return lines.join('\n')
}

/**
 * Build the `data_report` tool definition against a mounted service.
 * @param service - the mounted ctx.dataQuality implementation.
 * @returns the tool definition to register.
 */
export function defineReportTool(service: DataQualityService) {
  return defineTool({
    name: 'data_report',
    description: [
      'Read persisted data-quality reports back from the data_quality storage domain (deterministic, read-only).',
      'Pass key (the exact reportKey a prior run returned) to fetch one report, or kind to list every persisted report of that kind, ordered chronologically. Exactly one of key/kind.',
      'Returns the report envelope(s): kind, dataset, timestamp, and the full stored report (profile/clean/clean-diff/verify/citations). Missing keys and unknown kinds fail loudly.',
    ].join('\n'),
    parameters: {
      key: { type: 'string', description: 'Exact storage reportKey (e.g. 20260819000000000-profile-1a2b3c4d); fetches that one report.' },
      kind: { type: 'string', enum: [...REPORT_KINDS], description: 'Report kind to list (profile/clean/clean-diff/verify/citations).' },
      format: { type: 'string', enum: ['json', 'html'], description: 'Output format. json (default) returns the report envelope(s); html renders one report as a self-contained offline HTML document (requires key; profile/clean only).' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          kind: { type: 'string', enum: [...REPORT_KINDS] },
          records: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', required: true },
                kind: { type: 'string', enum: [...REPORT_KINDS], required: true },
                at: { type: 'number', required: true },
                dataset: { type: 'string', required: true },
                report: { type: 'json', required: true },
              },
              additionalProperties: false,
            },
            required: true,
          },
          html: { type: 'string', description: 'Self-contained offline HTML (present only when format: html).' },
        },
        additionalProperties: false,
      },
      render: (_args, value) => {
        const view = value as unknown as DataReportValue
        if (view.html !== undefined) return [{ type: 'text', text: view.html }]
        return [{ type: 'text', text: renderReportText(view) }]
      },
    },
    async execute(args, _exec): Promise<DataReportValue> {
      const hasKey = args.key !== undefined
      const hasKind = args.kind !== undefined
      if (hasKey === hasKind) {
        throw new Error('data_report needs exactly one of key/kind')
      }
      const format = (args.format ?? 'json') as 'json' | 'html'
      if (hasKey) {
        const record = await service.getReport(args.key as string)
        return {
          key: args.key as string,
          records: [toView(record)],
          ...(format === 'html' ? { html: renderRecordHtml(record) } : {}),
        }
      }
      if (format === 'html') {
        throw new Error('data_report html format requires key (exactly one report)')
      }
      const records = await service.listReports(args.kind as ReportRecord['kind'])
      return { kind: args.kind as ReportRecord['kind'], records: records.map(toView) }
    },
  })
}

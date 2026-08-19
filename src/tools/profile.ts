/**
 * The `data_profile` model tool: deterministic dataset profiling through
 * `ctx.dataQuality.profileDataset` — never model arithmetic.
 * @module dsh-data-quality/tools/profile
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { DataQualityService } from '../service.ts'
import { renderProfileText } from '../profile.ts'
import { workspaceOf } from './shared.ts'

const COLUMN_PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    inferredType: { type: 'string', enum: ['number', 'date', 'boolean', 'string', 'empty', 'mixed'], required: true },
    missing: { type: 'number', required: true },
    missingRate: { type: 'number', required: true },
    unique: { type: 'number', required: true },
    numeric: {
      type: 'object',
      properties: {
        min: { type: 'number', required: true },
        max: { type: 'number', required: true },
        mean: { type: 'number', required: true },
        median: { type: 'number', required: true },
        p25: { type: 'number', required: true },
        p75: { type: 'number', required: true },
        outliers: { type: 'number', required: true },
      },
      additionalProperties: false,
    },
    topValues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', required: true },
          count: { type: 'number', required: true },
        },
        additionalProperties: false,
      },
    },
    notes: { type: 'array', items: { type: 'string' }, required: true },
  },
  additionalProperties: false,
} as const

/**
 * Build the `data_profile` tool definition against a mounted service.
 * @param service - the mounted ctx.dataQuality implementation.
 * @returns the tool definition to register.
 */
export function defineProfileTool(service: DataQualityService) {
  return defineTool({
    name: 'data_profile',
    description: [
      'Profile a workspace CSV/TSV/JSON/JSONL dataset with deterministic TypeScript computation (no mental math).',
      'Returns row/column counts, inferred column types, missing rates, unique counts, numeric distributions (min/max/mean/median/p25/p75), IQR outlier counts, mixed-type suspicion notes, and duplicate-row counts.',
      'Column cards cover every row by default; pass sample for a deterministic systematic sample on large files. Datasets above the configured row/size caps are rejected — use sample or raise the caps. The full report persists to the data_quality storage domain (reportKey in the result).',
    ].join('\n'),
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative dataset path (.csv/.tsv/.json/.jsonl). JSON datasets must be an array of flat objects.' },
      sample: { type: 'number', description: 'Optional systematic sample size (every ceil(N/sample)-th row) for the column cards; row counts stay exact.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          dataset: { type: 'string', required: true },
          rowCount: { type: 'number', required: true },
          sampled: { type: 'boolean', required: true },
          profiledRows: { type: 'number', required: true },
          columnCount: { type: 'number', required: true },
          duplicateRows: { type: 'number', required: true },
          generatedAt: { type: 'number', required: true },
          reportKey: { type: 'string' },
          columns: { type: 'array', items: COLUMN_PROFILE_SCHEMA, required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: renderProfileText(value) }],
    },
    async execute(args, exec) {
      return service.profileDataset({
        dataset: args.path,
        sample: args.sample,
        workspace: workspaceOf(exec),
        session: exec.agent?.session,
        signal: exec.signal,
      })
    },
  })
}

/**
 * The `data_profile` model tool: deterministic dataset profiling through
 * `ctx.dataQuality.profileDataset` — never model arithmetic.
 * @module dsh-data-quality/tools/profile
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { DataQualityService } from '../service.ts'
import { renderProfileText, type ProfileReport } from '../profile.ts'
import { PROFILE_REPORT_SCHEMA } from './profile-report-schema.ts'
import { workspaceOf } from './shared.ts'

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
      'Returns row/column counts, inferred column types, missing rates, unique counts, numeric distributions (count/distinct/min/max/mean/median/p25/p75), IQR outlier counts, mixed-type suspicion notes, sha256 duplicate-row detection (rate + sample indexes), file encoding (BOM/UTF-8 validity), and a weighted DAMA six-dimension scorecard.',
      'Pass industryPreset (retail/saas/fund/real-estate/e-commerce/healthcare/logistics/manufacturing/energy) to compare the dataset against that industry\'s expected columns, making the scorecard accuracy dimension determinable. Column cards cover every row by default; pass sample for a deterministic systematic sample on large files. Datasets above the configured row/size caps are rejected — use sample or raise the caps. The full report persists to the data_quality storage domain (reportKey in the result).',
    ].join('\n'),
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative dataset path (.csv/.tsv/.json/.jsonl). JSON datasets must be an array of flat objects.' },
      sample: { type: 'number', description: 'Optional systematic sample size (every ceil(N/sample)-th row) for the column cards; row counts stay exact.' },
      industryPreset: { type: 'string', enum: ['retail', 'saas', 'fund', 'real-estate', 'e-commerce', 'healthcare', 'logistics', 'manufacturing', 'energy'], description: 'Optional industry preset id; its expected columns feed the scorecard accuracy dimension.' },
    },
    output: {
      schema: PROFILE_REPORT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: renderProfileText(value as unknown as ProfileReport) }],
    },
    async execute(args, exec) {
      return service.profileDataset({
        dataset: args.path,
        sample: args.sample,
        ...(args.industryPreset !== undefined ? { industryPreset: args.industryPreset } : {}),
        workspace: workspaceOf(exec),
        session: exec.agent?.session,
        signal: exec.signal,
      })
    },
  })
}

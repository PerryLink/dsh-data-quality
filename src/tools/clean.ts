/**
 * The `data_clean` model tool: declarative cleaning rules through
 * `ctx.dataQuality.cleanDataset`. The source file is never overwritten;
 * without `outputPath` the run is preview-only.
 * @module dsh-data-quality/tools/clean
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { CleanRule, CleanRunReport, DataQualityService } from '../service.ts'
import { PROFILE_REPORT_SCHEMA } from './profile-report-schema.ts'
import { renderCleanText, workspaceOf } from './shared.ts'

const STRING_MAP_SCHEMA = { type: 'json' } as const

const CLEAN_RULE_SCHEMA = {
  type: 'array',
  items: {
    oneOf: [
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'dedupe', required: true },
          columns: { type: 'array', items: { type: 'string' }, description: 'Key columns; all columns when omitted.' },
        },
        additionalProperties: false,
        description: 'Remove rows whose key-column values duplicate an earlier row (first occurrence kept).',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'fill-missing', required: true },
          column: { type: 'string', required: true },
          strategy: { type: 'string', enum: ['constant', 'mean', 'median', 'forward'], required: true },
          value: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'Required for strategy "constant".' },
        },
        additionalProperties: false,
        description: 'Fill missing cells: a constant, the column mean/median (numeric columns), or the previous non-missing value.',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'coerce-type', required: true },
          column: { type: 'string', required: true },
          to: { type: 'string', enum: ['number', 'date', 'boolean'], required: true },
        },
        additionalProperties: false,
        description: 'Coerce cells to number / ISO date / boolean; failures become missing and are counted in the log.',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'normalize-unit', required: true },
          column: { type: 'string', required: true },
          factors: { ...STRING_MAP_SCHEMA, description: 'Unit suffix to multiplier, e.g. {"万": 10000, "亿": 100000000}.' },
        },
        additionalProperties: false,
        description: 'Strip a unit suffix and multiply by its factor; plain numeric values convert too.',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'trim', required: true },
          columns: { type: 'array', items: { type: 'string' }, description: 'Columns to trim; all columns when omitted.' },
        },
        additionalProperties: false,
        description: 'Trim leading/trailing whitespace of string cells.',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'map-values', required: true },
          column: { type: 'string', required: true },
          map: { ...STRING_MAP_SCHEMA, description: 'Exact-match value mapping, e.g. {"Y": "yes", "N": "no"}.' },
          else: { type: 'string', enum: ['keep', 'missing'], description: 'Policy for unmapped values (default keep).' },
        },
        additionalProperties: false,
        description: 'Map enum values by exact match.',
      },
    ],
  },
  description: 'Ordered cleaning rules; each rule sees the previous rule\'s output.',
} as const

/**
 * Build the `data_clean` tool definition against a mounted service.
 * @param service - the mounted ctx.dataQuality implementation.
 * @returns the tool definition to register.
 */
export function defineCleanTool(service: DataQualityService) {
  return defineTool({
    name: 'data_clean',
    description: [
      'Apply declarative cleaning rules to a workspace CSV/TSV/JSON/JSONL dataset with deterministic TypeScript computation (no mental math).',
      'Rules apply in array order: dedupe (by column group), fill-missing (constant/mean/median/forward), coerce-type (number/date/boolean; failures counted and set to missing), normalize-unit (e.g. 万/亿 suffixes to base units), trim (whitespace), map-values (enum mapping).',
      'The source file is NEVER overwritten. Without outputPath the run is preview-only; with outputPath the cleaned dataset is written there (workspace-confined, .csv/.tsv/.json/.jsonl). Returns the per-rule audit log, the pre-delivery contract summary (with per-column decision trace), and a bounded preview. Pass dryRun: true to skip the write and get the cleaning plan plus the expected contract/diff preview instead. The full report persists to the data_quality storage domain (reportKey).',
    ].join('\n'),
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative dataset path (.csv/.tsv/.json/.jsonl).' },
      rules: { ...CLEAN_RULE_SCHEMA, required: true },
      outputPath: { type: 'string', description: 'Optional workspace-relative output path for the cleaned dataset (must differ from path).' },
      dryRun: { type: 'boolean', description: 'When true, do not write any output file; return the cleaning plan and expected contract/diff preview instead (default false).' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          dataset: { type: 'string', required: true },
          inputRows: { type: 'number', required: true },
          outputRows: { type: 'number', required: true },
          dryRun: { type: 'boolean', required: true },
          generatedAt: { type: 'number', required: true },
          outputPath: { type: 'string' },
          reportKey: { type: 'string' },
          diffPreview: {
            type: 'object',
            properties: {
              dataset: { type: 'string', required: true },
              before: { ...PROFILE_REPORT_SCHEMA, required: true },
              after: { ...PROFILE_REPORT_SCHEMA, required: true },
              generatedAt: { type: 'number', required: true },
            },
            additionalProperties: false,
          },
          logs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ruleIndex: { type: 'number', required: true },
                rule: { type: 'string', enum: ['dedupe', 'fill-missing', 'coerce-type', 'normalize-unit', 'trim', 'map-values'], required: true },
                affectedRows: { type: 'number', required: true },
                detail: { type: 'string', required: true },
              },
              additionalProperties: false,
            },
            required: true,
          },
          contract: {
            type: 'object',
            properties: {
              inputRows: { type: 'number', required: true },
              outputRows: { type: 'number', required: true },
              removedRows: { type: 'number', required: true },
              dedupeColumns: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }], required: true },
              uniqueKeys: { type: 'boolean', required: true },
              remainingDuplicateRows: { type: 'number', required: true },
              remainingMissing: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'string', required: true },
                    count: { type: 'number', required: true },
                  },
                  additionalProperties: false,
                },
                required: true,
              },
              typeConformance: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'string', required: true },
                    to: { type: 'string', enum: ['number', 'date', 'boolean'], required: true },
                    invalidCount: { type: 'number', required: true },
                  },
                  additionalProperties: false,
                },
                required: true,
              },
              columnDecisions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'string', required: true },
                    decisions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          strategy: { type: 'string', required: true },
                          affectedRows: { type: 'number', required: true },
                        },
                        additionalProperties: false,
                      },
                      required: true,
                    },
                  },
                  additionalProperties: false,
                },
                required: true,
              },
            },
            additionalProperties: false,
            required: true,
          },
          preview: {
            type: 'object',
            properties: {
              columns: { type: 'array', items: { type: 'string' }, required: true },
              rows: { type: 'array', items: { type: 'json' }, required: true },
            },
            additionalProperties: false,
            required: true,
          },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: renderCleanText(value as unknown as CleanRunReport) }],
    },
    async execute(args, exec) {
      return service.cleanDataset({
        dataset: args.path,
        rules: args.rules as unknown as readonly CleanRule[],
        ...(args.outputPath !== undefined ? { outputPath: args.outputPath } : {}),
        ...(args.dryRun !== undefined ? { dryRun: args.dryRun } : {}),
        workspace: workspaceOf(exec),
        session: exec.agent?.session,
        signal: exec.signal,
      })
    },
  })
}

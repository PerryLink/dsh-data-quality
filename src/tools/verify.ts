/**
 * The `data_verify` model tool: declarative verification rules through
 * `ctx.dataQuality.verifyDataset`. A failing dataset is a normal result
 * (`passed: false` with evidence), never a tool error.
 * @module dsh-data-quality/tools/verify
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { DataQualityService, VerifyExpectation, VerifyRule } from '../service.ts'
import { renderVerifyText, type VerifyReport } from '../verify.ts'
import { workspaceOf } from './shared.ts'

const EXPECTATION_METRICS = ['rowCount', 'columnSum', 'columnMean', 'uniqueCount', 'nullCount'] as const

const EXPECTATION_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      metric: { type: 'string', enum: [...EXPECTATION_METRICS], required: true, description: 'Metric to reconcile: rowCount/columnSum/columnMean/uniqueCount/nullCount.' },
      column: { type: 'string', description: 'Required for every metric except rowCount.' },
      expected: { type: 'number', required: true, description: 'The expected value to reconcile against.' },
      tolerance: { type: 'number', description: 'Optional relative tolerance in [0, 1]; defaults to defaultTolerance.' },
    },
    additionalProperties: false,
    description: 'Reconcile a deterministic computed metric against an expected value with relative tolerance.',
  },
  description: 'Optional metric expectations; each yields passed true or passed false with actual/expected/tolerance detail.',
} as const

const EXPECTATION_RESULT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      metric: { type: 'string', enum: [...EXPECTATION_METRICS], required: true },
      column: { type: 'string' },
      expected: { type: 'number', required: true },
      actual: { type: 'number', required: true },
      tolerance: { type: 'number', required: true },
      passed: { type: 'boolean', required: true },
    },
    additionalProperties: false,
  },
} as const

const VERIFY_RULE_SCHEMA = {
  type: 'array',
  items: {
    oneOf: [
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'not-null', required: true },
          column: { type: 'string', required: true },
        },
        additionalProperties: false,
        description: 'Fail rows where the column is missing (null/empty/whitespace).',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'unique', required: true },
          columns: { type: 'array', items: { type: 'string' }, required: true, description: 'Key columns; every row whose key repeats fails.' },
        },
        additionalProperties: false,
        description: 'Fail rows whose key-column combination appears more than once.',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'range', required: true },
          column: { type: 'string', required: true },
          min: { type: 'number' },
          max: { type: 'number' },
        },
        additionalProperties: false,
        description: 'Fail rows where the numeric cell is missing, unparseable, or outside [min, max] (inclusive; at least one bound required).',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'regex', required: true },
          column: { type: 'string', required: true },
          pattern: { type: 'string', required: true },
          flags: { type: 'string', description: 'Optional JS regex flags, e.g. "i".' },
        },
        additionalProperties: false,
        description: 'Fail rows where the cell is missing or does not match the pattern (full JS regex semantics).',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'enum', required: true },
          column: { type: 'string', required: true },
          values: { type: 'array', items: { type: 'string' }, required: true },
        },
        additionalProperties: false,
        description: 'Fail rows where the trimmed cell text is not one of the allowed values.',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'cross-column', required: true },
          left: { type: 'string', required: true, description: 'Left column name.' },
          op: { type: 'string', enum: ['<', '<=', '==', '!=', '>=', '>'], required: true },
          rightColumn: { type: 'string', description: 'Compare against another column…' },
          value: { oneOf: [{ type: 'number' }, { type: 'string' }], description: '…or against this literal (exactly one of rightColumn/value).' },
        },
        additionalProperties: false,
        description: 'Compare two columns (e.g. startDate < endDate) or a column against a literal. Numeric when both sides parse, string equality for ==/!= otherwise.',
      },
      {
        type: 'object',
        properties: {
          rule: { type: 'string', const: 'freshness', required: true },
          column: { type: 'string', required: true, description: 'Date column (YYYY-MM-DD, YYYY/MM/DD, or ISO datetime).' },
          maxAgeDays: { type: 'number', required: true, description: 'Fail rows whose date is older than this many days before asOf.' },
          asOf: { type: 'string', description: 'Reference date; defaults to the current date.' },
        },
        additionalProperties: false,
        description: 'Fail rows whose date cell is missing, unparseable, or older than maxAgeDays before asOf.',
      },
    ],
  },
  description: 'Verification rules; a missing cell fails every rule that reads it.',
} as const

/**
 * Build the `data_verify` tool definition against a mounted service.
 * @param service - the mounted ctx.dataQuality implementation.
 * @returns the tool definition to register.
 */
export function defineVerifyTool(service: DataQualityService) {
  return defineTool({
    name: 'data_verify',
    description: [
      'Verify a workspace CSV/TSV/JSON/JSONL dataset against declarative quality rules with deterministic TypeScript computation (no mental math).',
      'Rules: not-null, unique (column group), range (numeric bounds), regex, enum, cross-column (e.g. startDate < endDate), freshness (date column within N days of asOf). A missing cell fails every rule that reads it.',
      'Optional expectations reconcile deterministic metrics (rowCount/columnSum/columnMean/uniqueCount/nullCount) against expected values with relative tolerance; a mismatch is a normal passed: false with actual/expected/tolerance detail, never a tool error.',
      'Returns per-rule pass/fail with capped failing-row evidence plus the expectation outcomes. Overall failure is a NORMAL result with passed: false — not a tool error. The full report persists to the data_quality storage domain (reportKey).',
    ].join('\n'),
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative dataset path (.csv/.tsv/.json/.jsonl).' },
      rules: { ...VERIFY_RULE_SCHEMA, required: true },
      expectations: { ...EXPECTATION_SCHEMA, description: 'Optional metric expectations to reconcile (rowCount/columnSum/columnMean/uniqueCount/nullCount).' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          dataset: { type: 'string', required: true },
          passed: { type: 'boolean', required: true },
          rowCount: { type: 'number', required: true },
          generatedAt: { type: 'number', required: true },
          reportKey: { type: 'string' },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ruleIndex: { type: 'number', required: true },
                rule: { type: 'string', enum: ['not-null', 'unique', 'range', 'regex', 'enum', 'cross-column', 'freshness'], required: true },
                passed: { type: 'boolean', required: true },
                failedCount: { type: 'number', required: true },
                checkedCount: { type: 'number', required: true },
                evidence: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      rowIndex: { type: 'number', required: true },
                      values: { type: 'json', required: true },
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
          expectations: { ...EXPECTATION_RESULT_SCHEMA, required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: renderVerifyText(value as VerifyReport) }],
    },
    async execute(args, exec) {
      return service.verifyDataset({
        dataset: args.path,
        rules: args.rules as unknown as readonly VerifyRule[],
        ...(args.expectations !== undefined ? { expectations: args.expectations as unknown as readonly VerifyExpectation[] } : {}),
        workspace: workspaceOf(exec),
        session: exec.agent?.session,
        signal: exec.signal,
      })
    },
  })
}

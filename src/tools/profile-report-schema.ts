/**
 * Shared JSON-Schema spec for the profile report's canonical value, reused by
 * `data_profile` (its output) and `data_clean` (the `diffPreview` before/after
 * snapshots). One source of truth so the two tools never drift.
 * @module dsh-data-quality/tools-profile-report-schema
 */

const SCORECARD_DIMENSION_NAMES = ['completeness', 'uniqueness', 'validity', 'consistency', 'timeliness', 'accuracy'] as const

/** One column card's schema. */
export const COLUMN_PROFILE_SCHEMA = {
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
        count: { type: 'number', required: true },
        distinct: { type: 'number', required: true },
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

/** The full profile report's schema. */
export const PROFILE_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'number', required: true },
    dataset: { type: 'string', required: true },
    rowCount: { type: 'number', required: true },
    sampled: { type: 'boolean', required: true },
    profiledRows: { type: 'number', required: true },
    columnCount: { type: 'number', required: true },
    duplicateRows: { type: 'number', required: true },
    duplicateRate: { type: 'number', required: true },
    duplicateSampleRowIndexes: { type: 'array', items: { type: 'number' }, required: true },
    scorecard: {
      type: 'object',
      properties: {
        overall: { oneOf: [{ type: 'number' }, { type: 'null' }], required: true },
        weightedOverall: { oneOf: [{ type: 'number' }, { type: 'null' }], required: true },
        dimensions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', enum: [...SCORECARD_DIMENSION_NAMES], required: true },
              score: { oneOf: [{ type: 'number' }, { type: 'null' }], required: true },
              note: { type: 'string', required: true },
            },
            additionalProperties: false,
          },
          required: true,
        },
      },
      additionalProperties: false,
      required: true,
    },
    encoding: {
      type: 'object',
      properties: {
        bom: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
        validUtf8: { type: 'boolean', required: true },
      },
      additionalProperties: false,
    },
    generatedAt: { type: 'number', required: true },
    reportKey: { type: 'string' },
    columns: { type: 'array', items: COLUMN_PROFILE_SCHEMA, required: true },
  },
  additionalProperties: false,
} as const

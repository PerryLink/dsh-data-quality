/**
 * Plugin version, kept in one place so `scripts/release.mjs` can stamp it and
 * reports can name their generator.
 * @module dsh-data-quality/version
 */

/** The package version reported in persisted reports. */
export const VERSION = '0.3.2'

/**
 * Version of the persisted report schema. Bump it whenever a report's
 * canonical shape changes in a way old consumers cannot read (the durable
 * `data_quality` records keep their own `schemaVersion` so a future reader
 * can detect and reject an incompatible record instead of misreading it).
 */
export const REPORT_SCHEMA_VERSION = 1

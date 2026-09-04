# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.5] - 2026-09-04

### Changed

- Align the devDependency pins to the published dsh `0.1.2-rc.1` line, bump the `dshWorkshop` compatibility list and the compat CI harness probes, and refresh the adaptive-event facts (rc.1 re-adopts the `ignorable` envelope, but `Session.append` still cannot stamp it — the gate still skips); no behavior change.

## [0.3.4] - 2026-09-02

### Docs

- Sync the five-language READMEs to the 0.1.2-alpha.5 facts; no behavior change.

## [0.3.3] - 2026-09-02

### Changed

- Align the devDependency pins to the published dsh 0.1.2-alpha.5 line and re-verify the adaptation claims; no behavior change.

## [0.3.2] - 2026-09-01

### Changed

- Align devDeps pins to the published dsh 0.1.2-alpha.2 line (0.1.1-rc.2 -> 0.1.2-alpha.2); no behavior change to envelope/gating semantics.
- Align devDeps pins to the published dsh 0.1.2-alpha.3 line (0.1.2-alpha.2 -> 0.1.2-alpha.3), widen the `dsh-storage-json` peer to `>=0.1.0-rc.8 <0.2.0`, and align `cordis`/`schemastery` to `^4.0.2`/`^3.18.2`. The adaptive event gate keeps failing safe on `0.1.2-alpha.3` (`Session.append` still cannot stamp the `ignorable` marker); the five-language READMEs record the alpha.3 fact.

## [0.3.1] - 2026-08-30

### Fixed

- Tests and the loader runner no longer import the `CallId` brand from `@deepseek-ai/dsh-llm` (renamed to `ToolCallId` on host master): the call-id brand is now derived from the `dsh-tools` execution contract, staying green on both the published rc line and the 0.1.2-alpha.1 checkout.
- The adaptive-append comments now state the 0.1.2-alpha.1 reality (the `ignorable` envelope was removed, so the probe fails safe and the append is skipped). Behavior unchanged.

## [0.3.0] - 2026-08-26

### Added

- **Self-contained offline HTML report.** `data_report` gains `format: html` (with `key`): a profile or clean report renders as a single `.html` file with inlined CSS/JS, no external requests (no CDN, `<link>`, or `<script src>`), the DAMA six-dimension scorecard, the per-column profile summary table, and the per-rule cleaning summary table. Dataset values are HTML-escaped before reaching the markup.
- **Versioned report schema.** The profile report now carries `schemaVersion` (a new `REPORT_SCHEMA_VERSION = 1`), declared in the profile report's JSON schema so future consumers can detect an incompatible persisted record instead of misreading it.

## [0.2.0] - 2026-08-23

### Added

- DAMA six-dimension quality scorecard in `data_profile`: completeness, uniqueness, validity, consistency, timeliness, and accuracy (limited declared-schema definition; accuracy is reported undetermined without a declared schema rather than fabricated). The scorecard flows through the profile report, the persisted storage-domain record, and the tool result.
- Full-row sha256 content-hash duplicate detection in `data_profile`, reporting the duplicate rate plus a bounded sample of 0-based duplicate row indexes (capped by `evidenceRowLimit`).
- Pre-delivery contract validation summary on `data_clean` (dedupe before/after row comparison, uniqueness regression, non-null and type regressions) plus a persisted clean before/after profile diff report under the new `clean-diff` storage record kind.
- `data_report` tool plus `ctx.dataQuality.getReport`/`listReports` query methods to read persisted reports back by `reportKey` (path-safe validation, missing records fail loud) or by `kind`, ordered chronologically.
- `data_clean` `dryRun` parameter: no file written and no report persisted, returning the per-column cleaning plan (in `contract.columnDecisions`) plus the expected `contract`/`diffPreview`.
- Numeric distribution `count`/`distinct` fields on numeric column profiles.
- Config `scorecardWeights` (six per-dimension weights, non-negative, equal by default) driving a `weightedOverall` scorecard total.
- Per-column decision trace in the clean contract (`columnDecisions`: strategy + affected rows), persisted with the clean report.
- File-encoding reporting in `data_profile` (`encoding`: UTF-8 BOM presence and validity; invalid UTF-8 is reported, not fatal).
- Built-in industry profile presets (`retail`, `saas`, `fund`, `real-estate`, `e-commerce`, `healthcare`, `logistics`, `manufacturing`, `energy`) via the `data_profile` `industryPreset` parameter, feeding the scorecard `accuracy` dimension; unknown ids fail loud.
- Metric reconciliation on `data_verify`: optional `expectations` (rowCount/columnSum/columnMean/uniqueCount/nullCount, each with `column`, `expected`, optional relative `tolerance`) reconcile deterministic computed values; a mismatch is a normal `passed: false` verdict with actual/expected/tolerance detail, while invalid metrics, columns, and out-of-range tolerances fail loud. Results flow into the verify report and its persisted record.

### Deviations

Documented, deliberate non-goals for this repository (recorded rather than silently omitted):

- **Native xlsx** — a real Excel parser needs a new dependency (or a sidecar); this repo keeps a zero-dependency parsing contract, so CSV/TSV/JSON/JSONL are the supported dataset formats, now with UTF-8/BOM encoding detection.
- **SQL / DuckDB access** — database drivers are out of scope for the zero-dependency, in-process TypeScript seam; tabular datasets are files.
- **`qsv` as an alternative parser** — an external binary violates the no-external-processes contract.
- **Slot client report panel** — a browser report panel needs a client half and bundle changes; the consumption path is covered by the `data_report` tool plus storage-domain persistence instead.
- **Computer-use fallback collection** — macOS-only and brittle; the regular filesystem capability already covers the supported collection path.

## [0.1.3] - 2026-08-23

### Changed

- Persist the bounded clean `preview` in the durable `clean` report so the model-visible canonical result is fully reconstructable from its `reportKey` (model-visible ⟺ logged).

## [0.1.2] - 2026-08-22

### Changed

- Bumped the `@deepseek-ai/dsh-*` dev dependencies to the 0.1.1-rc.2 release line (peers stay `>=0.1.0-rc.8 <0.2.0`; no rc.2-only API is used) and re-verified the full gate against the published 0.1.1-rc.2 types. Compatibility metadata (`dshWorkshop.compatibility.dshVersions`) now advertises `0.1.1-rc.2`, and the CI compat workflow pins the `dsh`/`dsh-base`/`dsh-headless` installs to 0.1.1-rc.2. Session-event behavior is unchanged: 0.1.1-rc.2 still exposes no plugin event-registration surface and no `ignorable` append option, so the adaptive gate keeps skipping the append and the storage-domain report stays the durable record.

## [0.1.1] - 2026-08-21

### Changed

- Bumped the `@deepseek-ai/dsh-*` peer and dev dependencies to the 0.1.0-rc.8 release line (peers now `>=0.1.0-rc.8 <0.2.0`) and re-verified the full gate against the published rc.8 types. Session-event behavior is unchanged: rc.8 still exposes no plugin event-registration surface and no `ignorable` append option, so the adaptive gate keeps skipping the append and the storage-domain report stays the durable record.

## [0.1.0] - 2026-08-19

### Added

- The `ctx.dataQuality` capability seam (Service Definition / local deterministic Provider / tool Consumers) with the frozen cross-plugin `verifyCitations(request)` contract for document-number ↔ dataset checks (verified / mismatch / not-found / unverifiable, relative-tolerance numeric comparison).
- `data_profile` tool: deterministic dataset profiling (row/column counts, inferred types, missing rates, unique counts, numeric distributions, IQR outliers, mixed-type notes, duplicate-row counts) over workspace CSV/TSV/JSON/JSONL, with optional systematic sampling.
- `data_clean` tool: ordered declarative cleaning rules (`dedupe`, `fill-missing`, `coerce-type`, `normalize-unit`, `trim`, `map-values`) with a per-rule audit log; the source file is never overwritten and cleaned output writes only inside the workspace.
- `data_verify` tool: declarative verification rules (`not-null`, `unique`, `range`, `regex`, `enum`, `cross-column`, `freshness`) with capped failing-row evidence; overall failure is a normal `passed: false` result, never a tool error.
- Durable report persistence to the `data_quality` storage domain (keyed by run timestamp + dataset fingerprint), adaptive `data-quality/profile|clean|verify` session events on hosts that can carry them safely, fail-loud Schemastery config, and workspace-confined path resolution (escape + extension + size + row guards).

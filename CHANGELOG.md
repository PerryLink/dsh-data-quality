# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.13] - 2026-09-23

### Added

- `typecheck:checkout` (`tsc -p tsconfig.checkout.json --noEmit`) compiles the same `src` + `test` + `vitest.config.ts` program as `typecheck`, with the 13 `@deepseek-ai/*` packages this repo imports mapped to the local harness checkout's built type faces instead of the installed published ones. Every `@deepseek-ai/*` specifier under `src/` and `test/` was enumerated first and every mapped path verified to exist on disk. The repo previously had no checkout ruler, so nothing compiled against the checkout. It complements, not replaces, `typecheck` (installed published faces) and `typecheck:ci` (published faces, `skipLibCheck` off). Two failures the ruler surfaced were ruler-construction bugs rather than repo defects and were fixed without touching `src/` or any test. `AGENTS.md`'s checks chain and ruler note now name all three rulers.

### Changed

- Move the verified baseline to the published `0.1.7-alpha.2` line: all ten `@deepseek-ai/dsh-*` dev/test pins move from `0.1.5-rc.2` to `0.1.7-alpha.2`, `@deepseek-ai/cordis` to `^4.0.4` and `@deepseek-ai/schemastery` to `^3.18.4`. The schemastery caret also converges the tree on the single `3.18.4` copy the harness packages resolve, so the repo's copy can no longer fall behind the host's. The `@deepseek-ai/cordis` peer stays `^4.0.2`, which already admits `4.0.4`.
- Every declared host range gains `|| >=0.1.7-0 <0.2.0`: the five `@deepseek-ai/dsh-*` peer bands now read `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0`. This is a correctness fix, not a tightening: under npm semver's prerelease rule a comparator set whose only prerelease comparators sit on earlier `[major, minor, patch]` tuples cannot admit a later alpha, so the three-clause band excluded the very host line this release targets. No existing segment moved and nothing was narrowed.
- `dshWorkshop.compatibility.dshVersions` records `0.1.7-alpha.2`; the five-language README compatibility rows name `dsh-v0.1.7-alpha.2` and quote the four-clause band; the `compat.yml` profile smoke installs the `0.1.7-alpha.2` CLI and bundle.

### Fixed

- `THIRD_PARTY_NOTICES.md` stated a peer surface from several lines back — `@deepseek-ai/dsh-*` at `0.1.1-rc.2`, `@deepseek-ai/cordis` `^4.0.1` and `@deepseek-ai/schemastery` `^3.18.0`. The table now matches what `package.json` actually declares: the four-clause `@deepseek-ai/dsh-*` band, `^4.0.2` and `^3.18.2`.

## [0.3.12] - 2026-09-19

### Added

- `pnpm run check:lockfile` (`scripts/check-lockfile-drift.mjs`) fails fast when `package.json` and `pnpm-lock.yaml` disagree; the probe is read-only and the documented checks chain runs it alongside the other gates.

### Changed

- The release workflow now publishes through **npm trusted publishing** (OIDC) instead of the long-lived `NPM_TOKEN` secret: `setup-node` no longer sets `registry-url` (its empty `_authToken` line made the registry answer 404 on PUT), npm is upgraded to >= 11.5.1 before publishing, and the "NPM_TOKEN is not set -> skip" guard is gone so a missing publisher cannot turn a release into a silent no-op.
## [0.3.11] - 2026-09-18

### Fixed

- Hold the four tool registrations (`data_profile` / `data_clean` / `data_verify` / `data_report`) in one effect whose disposer unregisters them in reverse order, and release a storage domain that finishes opening after the plugin fiber was already disposed. An unmount during `apply` can no longer lose the registrations (the previous shape registered them outside any effect, so an interrupt left nothing to roll back) nor leak the freshly opened domain handle. No user-visible behavior change.

### Docs

- Refresh the append-gate contract in `src/events.ts` for the 0.1.6-alpha.2 line: `Session.append<T>(type, data, ...opts)` takes a third argument only for surface-eligible event types, and that argument is a `SurfaceIntent`, never an `ignorable` envelope — a non-surface `data-quality/*` type has no third parameter at all, so the gate still skips and the storage-domain report stays the durable copy.

## [0.3.10] - 2026-09-12

### Changed

- Rename the four translated READMEs to `README-<lang>.md`. npm selects the package-page readme as the first markdown file matching its `{README,README.*}` glob (`@npmcli/package-json`, publish path), and that glob order puts `README.<lang>.md` ahead of `README.md` — so npm was serving the Simplified-Chinese file for this package too (measured on 15/15 sampled packages of the family). The new names sit outside the glob, so the English source is served again. No content changed apart from the language-switcher link each translation holds to its siblings, and the repo readme gate still passes. Takes effect with the next release; an already-published version cannot gain a corrected readme retroactively.
- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to the published `0.1.5-rc.2` line and record `0.1.5-rc.2` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now runs against `0.1.5-rc.2`. The peer range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` is unchanged, so no supported host line is dropped.

### Fixed

- The release workflow claimed provenance but never passed the flag: it runs `npm publish --access public`, and npm only attests a token-based publish when `--provenance` is given explicitly. The publish step is now `npm publish --access public --provenance`, matching the rest of the family. Takes effect from the next release; an already-published version cannot gain attestations retroactively.

## [0.3.9] - 2026-09-10

### Changed

- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to the published `0.1.5-rc.1` line and record `0.1.5-rc.1` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now runs against `0.1.5-rc.1`. The peer range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` is unchanged, so no supported host line is dropped.

### Docs

- Refresh the five-language README compatibility baseline to `dsh-v0.1.5-rc.1` (verified 2026-09-10).

## [0.3.8] - 2026-09-09

### Changed

- Align the `@deepseek-ai/dsh-*` peer ranges to `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` and pin the dev/test dependencies to the published `0.1.5-alpha.1` line: adaptation to DeepSeek Harness `dsh-v0.1.5-alpha.1` (session format V3, `ctx.agent` removal, `Inbox` type-only interface); runtime behavior is unchanged for every supported host line.
- Record `0.1.5-alpha.1` in `dshWorkshop.compatibility.dshVersions`.

### Docs

- Refresh the five-language README compatibility baseline to `dsh-v0.1.5-alpha.1` (verified 2026-09-09).

## [0.3.7] - 2026-09-07

### Fixed

- Align the `@deepseek-ai/dsh-*` peer ranges to `>=0.1.2-rc.1 <0.2.0`: the older `>=0.1.0-rc.8 <0.2.0` band resolved to only the `0.1.0-rc.8` prerelease under registry-driven resolution and broke fresh tarball installs; no behavior change.

### Docs

- Refresh the five-language README support-version wording: the verified GitHub tag `dsh-v0.1.3-alpha.1` now leads the compatibility claim, while npm `0.1.2-rc.1` stays the published dependency-pin line (peers `>=0.1.2-rc.1 <0.2.0`); no behavior change.


## [0.3.6] - 2026-09-04

### Fixed

- Remove the `storage` / `storage-json` / `storage-domain` rows from the bundle patch: the shipped profiles compose that stack through `dsh-base`, so the inserted rows collided with the same ids and made the profile refuse to boot (`duplicate loader entry id: storage`). The patch now mounts only the plugin row; bare profiles compose the storage stack themselves.

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

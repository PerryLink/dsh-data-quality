# AGENTS.md

Standalone DeepSeek Harness plugin repository (`dsh-data-quality`). Development follows the dsh-plugin-guide skill and the official plugin contract; this file records repo-local decisions.

## Layout

- `src/index.ts` — function-plugin contract (`name`/`inject`/`Config`/`apply`; NO default export). Injects `tools` and `storageDomain`. Async `apply`: resolves config, opens the `data_quality` domain, constructs the service (publishes `ctx.dataQuality`), registers the three tools, and closes the domain from one `ctx.effect` disposer.
- `src/service.ts` — the Service Definition: the frozen cross-plugin `CitationCheckRequest`/`CitationCheckResult` contract (byte-stable; change only with an ecosystem migration), the internal request/report types, the abstract `DataQualityService`, and the `Context` declaration merge.
- `src/provider-local.ts` — the local deterministic Provider: orchestrates loading, engines, persistence, and the adaptive session events. Uses TypeScript `private` (never ECMA `#` fields — cordis proxies service access and `#` fields throw on the proxy receiver).
- `src/dataset.ts` — workspace-confined path resolution, size/row guards, hand-rolled CSV/TSV/JSON/JSONL parsers, deterministic systematic sampling, strict scalar parsers. Cells are `JsonValue`.
- `src/profile.ts` / `src/clean.ts` / `src/verify.ts` — the pure engines. No I/O, no clock, no RNG; timestamps and the freshness clock are injected.
- `src/config.ts` — Schemastery schema + explicit `resolveConfig` (no hidden `?? default` in run paths). Numeric bounds fail loud at mount.
- `src/store.ts` — the `data_quality` storage-domain declaration (zod record schema) and the deterministic report-key format.
- `src/events.ts` — the `data-quality/*` `SessionEventMap` merge plus the adaptive append gate.
- `src/present.ts` — display truncation for tool-facing row payloads (safety invariant, not a tunable).
- `src/tools/*.ts` — the three `defineTool` Consumers; all computation goes through the service layer, `workspaceOf(exec)` mirrors the official fs tools' session-cwd rule.
- `scripts/` — `prepare.mjs` (build), `fix-dts.mjs`, `verify-self-contained.mjs`, `verify-artifacts.mjs` (also greps for leftover `.ts` imports), `check-readme-sync.mjs` (five-language gate), `loader-runner.mjs` (real Loader composition + keyless three-tool chain), `release.mjs`, `changelog-section.mjs`.
- `test/` — vitest; REAL `Context`/`SessionStore`/`Session`/`SystemPrompt`/`ToolRuntime` and the REAL storage seam (dsh-storage + dsh-storage-json + dsh-storage-domain) from the 0.1.1-rc.2 peers. No hand-written service mocks. Engine specs are pure.
- `fixtures/` — small dirty datasets for the loader-runner smoke.

## Hard rules applied here

- **Deterministic computation.** Same input, same output; floats never compare with raw `===` (relative tolerance); the only clock is injected (`now` for reports and `freshness` defaults).
- **Session events are adaptive.** The rc.2 `Session.append` has no `ignorable` flag and there is no plugin event-registration surface, so appending an unknown `data-quality/*` type would make the persistence coordinator refuse the log on restore. `src/events.ts` appends only when the host knows the vocabulary or supports the `ignorable` append flag (source probe, fails safe); the storage-domain report is always the durable copy.
- **Path confinement.** Dataset/output paths resolve inside the session workspace (`verifyCitations` uses the configured `workspaceRoot`); both sides go through `path.resolve` before the containment check (Windows slash trap).
- **Fail loud.** Misconfiguration, malformed files, unknown columns, invalid rules, oversized inputs, and path escapes all throw actionable errors; a failing `data_verify` verdict is a normal `passed: false` result, never a tool error.
- **No tunables hardcoded.** Every knob is a validated `Config` field with a default in `src/config.ts`, an inline comment in `cordis.patch.yml`, and a row in the five-language README configuration table. `MAX_CELL_TEXT` is a documented display-safety invariant, not a tunable.
- **This plugin registers no waterfall listeners.** If one is ever added, allow/passthrough MUST call `next()`.

## Checks

`pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && node scripts/check-readme-sync.mjs && pnpm pack`

- `typecheck` resolves `@deepseek-ai/*` through the installed 0.1.1-rc.2 peers; `typecheck:ci` clears `skipLibCheck` and enables `verbatimModuleSyntax` against the published types. Both must stay green.

## Release

`node scripts/release.mjs <x.y.z>` bumps package.json + `src/version.ts`, stamps the CHANGELOG `[Unreleased]` section, re-runs the full gate, and commits + tags (never pushes). `git push origin main --follow-tags` triggers `.github/workflows/release.yml`, which re-runs the gate, publishes to npm with provenance, and creates the GitHub Release from the stamped CHANGELOG section.

## Docs

- Five-language READMEs (`README.md`, `README.zh.md`, `README.es.md`, `README.pt.md`, `README.hi.md`) — keep all five in sync; the English file is the source of truth and the `## ` headings stay in English (the sync gate enforces structure and config keys). `scripts/check-readme-sync.mjs` (CI) is the enforcer.
- GitHub topics `dsh`, `dsh-plugin`, `deepseek-harness`, `cordis`, `data-quality`, `data-cleaning`, `data-profiling`, `data-verification` (mirror `package.json` keywords).
- License is Apache-2.0 (`LICENSE` + the package.json `license` field). `THIRD_PARTY_NOTICES.md` documents the build-time dependencies.

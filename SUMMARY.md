# dsh-data-quality — Completion Summary

Standalone DeepSeek Harness plugin repository (`dsh-data-quality`): deterministic TypeScript data profiling / cleaning / verification for the agent harness, built as the full three-layer capability seam (Service Definition / local Provider / three model tool Consumers) with durable report storage and adaptive session events.

## Deliverables

### Capability seam

- **`ctx.dataQuality` Service Definition** (`src/service.ts`) — `DataQualityService extends Service`, registered under `dataQuality`. Exposes the frozen cross-plugin contract:
  - `verifyCitations(request: CitationCheckRequest): Promise<CitationCheckResult>` — the byte-stable cross-plugin contract (§6.2 of the plugin spec), change only with an ecosystem migration.
  - `profileDataset`, `cleanDataset`, `verifyDataset` — the internal report pipeline used by the tools.
- **Local deterministic Provider** (`src/provider-local.ts`) — no I/O in the engines, no clock (injected `now` / `freshness`), no RNG; TypeScript `private` fields only (ECMA `#` fields throw on cordis' proxied service receiver).
- **Consumers** (`src/tools/*.ts`) — `data_profile`, `data_clean`, `data_verify` `defineTool`s; all computation via the service; `workspaceOf(exec)` mirrors the official fs tools' session-cwd rule.

### Engines (pure, deterministic)

- `src/dataset.ts` — workspace-confined path resolution, size/row guards, hand-rolled CSV/TSV/JSON/JSONL parsers, deterministic systematic sampling, strict scalar parsers (`Cell = JsonValue`).
- `src/profile.ts` — row/column counts, inferred types, missing rates, unique counts, numeric distribution (min/max/mean/median/p25/p75), IQR outlier counts, mixed-type suspicion notes, duplicate-row counts, text rendering.
- `src/clean.ts` — six rule kinds, exactly the spec's list: `dedupe` (column group), `fill-missing` (constant/mean/median/forward), `coerce-type` (number/date/boolean with failure counts), `normalize-unit` (万/亿-style factor map), `trim`, `map-values` (enum mapping with `else: keep|missing`).
- `src/verify.ts` — seven rule kinds, exactly the spec's list: `not-null`, `unique`, `range`, `regex`, `enum`, `cross-column`, `freshness` (date column vs `asOf`, default injected clock) — plus `checkCitations`/`parseLocator`/`walkLocator` and the four verification states (`verified` / `mismatch` / `not-found` / `unverifiable`).

### Integration surfaces

- `src/store.ts` — `data_quality` storage domain (zod record schema, version 1, table `reports`), deterministic report key `YYYYMMDDHHmmssSSS-<kind>-<8-hex-sha256>`.
- `src/events.ts` — `data-quality/profile|clean|verify` in the `SessionEventMap` declaration merge. Adaptive append gate: known vocabulary → plain append; unknown vocabulary → probe the unbound `append` source for an `ignorable` marker and only then append with `{ ignorable: true }`; otherwise skip (the storage-domain report is always the durable copy). This is required because the rc.6 `Session.append` has no `ignorable` flag and no plugin event-registration surface exists, so an unknown appended type makes the persistence coordinator refuse the session log on restore.
- `src/config.ts` — Schemastery schema + explicit `resolveConfig` (no hidden `?? default`); numeric bounds fail loud at mount.

### Model tools (per plugin contract)

| Tool | Input | Output |
|---|---|---|
| `data_profile` | dataset path, sample? | row/column counts, per-column cards (type, missing, unique, numeric stats, notes), duplicate rows, reportKey |
| `data_clean` | dataset path, rules[], output path (optional, workspace-confined) | cleaned rows, per-rule audit log (affected rows), reportKey |
| `data_verify` | dataset path, rules[], evidence cap | verdict `passed`, per-rule pass/fail with evidence rows, reportKey |

## Configuration (cordis.yml `config`)

| Key | Default | Notes |
|---|---|---|
| `enabled` | `true` | master switch |
| `maxRows` | `200000` | row guard, fail loud |
| `maxFileSizeMB` | `64` | file size guard, fail loud |
| `defaultTolerance` | `1e-9` | numeric comparison relative tolerance |
| `evidenceRowLimit` | `20` | evidence rows per failed verify rule |
| `allowedExtensions` | `.csv .tsv .json .jsonl` | dataset file extensions |
| `workspaceRoot` | `''` | service-level citation checks resolve here; tools resolve in the session workspace |
| `storeReports` | `true` | persist reports to the `data_quality` storage domain |

All knobs are documented in the five-language README configuration tables and mirrored in `cordis.patch.yml` with inline comments.

## Acceptance

### Gate chain — re-run green on the final tree (2026-08-20)

```
pnpm run typecheck                 PASS   tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit
pnpm run typecheck:ci              PASS   tsc -p tsconfig.ci.json --noEmit (published 0.1.0-rc.6 peers)
pnpm test                          PASS   112 tests / 8 files (clean 22, verify 28, dataset 25, plugin 10, citations 9, profile 8, events 6, config 4)
pnpm run build                     PASS   lib/index.js 82.82 kB; fix-dts rewrote 11 files / 37 specifiers
pnpm run verify:self-contained     PASS   all dependency specs resolve from the registry
pnpm run verify:artifacts          PASS   syntax + ESM import + plugin face + no .ts leftovers + bundle patch present
pnpm run verify:readme-sync        PASS   all 5 READMEs share section structure and config keys
pnpm run pack:check                PASS   dsh-data-quality-0.1.0.tgz (lib/index.js + lib/types + cordis.patch.yml + READMEs + src)
```

`pnpm run test:coverage` thresholds (statements 90 / branches 80 / functions 90 / lines 90) pass.

### Real composition smokes

1. **Loader runner** (`node scripts/loader-runner.mjs .tmp/loader-smoke/cordis.yml fixtures`) — boots a real `Context` + vendored Loader with the Include builtin against the real storage seam (dsh-storage + dsh-storage-json + dsh-storage-domain), dsh-system-prompt, dsh-tools, and the BUILT `lib/index.js` bundle with `workspaceRoot` = fixtures dir. Keyless three-tool chain over the dirty fixture:

   ```
   DSH_LOADER_RESULT {"tools":["data_profile","data_clean","data_verify"],"profileRows":10,"profileColumns":6,"cleanOutputRows":8,"verifyPassed":false,"citationStatus":"verified"}
   ```

   profile 10 rows / 6 columns; clean (trim → dedupe → normalize-unit → coerce-type) drops 2 duplicate rows (8 out); verify `passed:false` is the correct verdict (the fixture's missing `holding_value` on FUND005 fails `range` — evidence flows); `verifyCitations` resolves a cited value from the CSV → `verified`.

2. **dsh-test-drive isolated install matrix (preferred path, run 2026-08-20)** — programmatic drive of the dsh-test-drive pipeline (`D:\deepseek-harness\Project\Plugins\dsh-test-drive\`, real `LocalSubprocessRuntime` → real `dsh` CLI + pnpm) against this checkout:

   ```
   verdict: pass
   install   pass   dsh plugin add <checkout> ok (exit 0, allowBuildsNeeded: false)
   config    pass   patchEffective: true, layers: ["dsh-data-quality"], full bundle patch visible in --dump-config
   smoke     boot-ok  booted without loader failures; MISSING_CREDENTIAL (no API key) proves the tree mounted
   capability skipped  disabled by config and no per-drive spec (requires DEEPSEEK_API_KEY)
   uninstall pass   dsh plugin remove ok (exit 0)
   cleanup   pass   owned temp root quarantined and removed
   isolation hostHomeTouched: false, tempDshHome/tempWorkspace/tempStore: true
   ```

3. **Real dsh CLI temp-profile install** (earlier session, recorded here): `dsh plugin --profile dq add @deepseek-ai/dsh-base@0.1.0-rc.6 @deepseek-ai/dsh-headless@0.1.0-rc.6 ./dsh-data-quality-0.1.0.tgz` → install succeeds; `--dump-config` shows the bundle patch merging the storage rows + `dsh-data-quality` row; keyless headless exits with `MISSING_CREDENTIAL` (a pending service would hang to timeout instead); `dsh plugin remove` reverts cleanly.

## Commit history (13 commits, `main`)

```
d5e1c7b docs: record v0.1.0 release status
d9201d2 chore(release): 0.1.0
f2f95b7 fix: release script stamps a first release whose version is already set
3261e77 chore: keep loader-runner output byproduct untracked
433f9d4 docs: completion summary
6f9c4e5 docs: five-language READMEs and repo policy files
90ae5ed ci: ci/compat/release workflow trio
daca96f build: self-contained prepare/verify/release scripts and loader-runner smoke
8ad596d test: real-service vitest suite (112 specs) plus dirty-data fixtures
2048c6e feat: data_profile/data_clean/data_verify tools and plugin entry with fail-loud config
be634cd feat: ctx.dataQuality seam (frozen verifyCitations contract, local provider, storage domain, adaptive session events)
0be188f feat: deterministic dataset layer and pure engines (profile/clean/verify)
d6af7b6 chore: project scaffold (package manifest, tsconfig trio, build/test config)
```

## Deviations from the plugin spec (vetted, intentional)

1. **Session events are adaptive, not unconditional.** The spec requires a `SessionEventMap` merge for model-visible content; that merge exists (`src/events.ts`). On rc.6 hosts the append surface has no `ignorable` flag and no plugin event-registration surface, so appending an unknown `data-quality/*` type would make the persistence coordinator refuse the session log on restore. The gate appends only when the host knows the vocabulary or supports the ignorable marker, and fails safe to skipping; the storage-domain report remains the durable record. (The original SUMMARY predated this refinement; the current code is authoritative.)
2. **Rule names match the spec verbatim.** The six clean rules (`dedupe`, `fill-missing`, `coerce-type`, `normalize-unit`, `trim`, `map-values`) and seven verify rules (`not-null`, `unique`, `range`, `regex`, `enum`, `cross-column`, `freshness`) use the spec's kebab-case names. An earlier SUMMARY draft described an intermediate snake_case rule set; the shipped code never shipped those names.
3. **Render shape is text, not a table.** The spec suggests a "generic + table render"; the tools use `generic` tools with a human-readable text summary in `output.render` (tables are ill-suited to the variable-width evidence rows). Semantics unchanged: canonical JSON in `output.schema`, human text in `output.render`.
4. **`workspaceRoot` added for the service plane.** Tool calls always resolve inside the session workspace (spec). `verifyCitations` has no session, so a `workspaceRoot` config (default: process launch directory) anchors service-level checks; it is fixed at provider construction.
5. **Extra config keys `enabled` / `storeReports`.** Both default on and are settable from cordis.yml — additions to, not replacements of, the spec's five keys.
6. **`MAX_CELL_TEXT` (120 chars) is a display-safety invariant**, not a tunable; documented in AGENTS.md.
7. **Push/publish did not happen in the development session.** The spec forbids push and publish here; `d9201d2`/`d5e1c7b` record the release session's stamp/status work, and the remote (`PerryLink/dsh-data-quality`) plus npm (`dsh-data-quality@0.1.0`, published 2026-08-19T13:54Z) were populated by that release session.

## Repo & release state

- 13 conventional commits on `main`, tag `v0.1.0`, working tree clean. Remote: `github.com/PerryLink/dsh-data-quality` (pushed by the release session).
- npm registry: `dsh-data-quality@0.1.0` published 2026-08-19T13:54Z (`latest` = 0.1.0); the earlier "npm publish skipped (no NPM_TOKEN)" note is superseded — the release session closed that gap.
- `dsh-data-quality-0.1.0.tgz` is gitignored and reproducible via `pnpm pack`.

## Known limitations & follow-up suggestions

- **Session events are best-effort on pre-rc.7 hosts**: on a host whose append lacks the `ignorable` marker, `data-quality/*` events are skipped rather than risking log-restore refusal; the storage-domain report remains the durable record. Revisit when the harness exposes a real plugin event-registration surface.
- **No fuzzy/LLM-based cleaning**: rule semantics are strictly deterministic by design; a future `data_clean` rule kind could delegate fuzzy matching to an LLM tool as an opt-in.
- **`workspaceRoot` is process-start-time**: the provider caches the resolved root at construction; a runtime configuration change requires remounting the plugin.
- **Numeric parsing is strict**: locale-formatted numbers (`"1,234.56"`) and currency strings are text until `coerce-type`/`normalize-unit` run.
- **Cross-column date comparison uses epoch fallback**: strings that do not parse as numbers fall back to `Date.parse`; unparseable pairs fall back to strict string equality (only for `==` / `!=`).
- **Evidence rows are truncated** by `MAX_CELL_TEXT` (120 chars).

## Project overview suggestion

Add one row to the Project/Plugins overview roster: `dsh-data-quality` — `ctx.dataQuality` three-layer seam (deterministic profiling/cleaning/verification) with `data_profile` / `data_clean` / `data_verify` tools; v0.1.0 on npm since 2026-08-19.

## Release-session handoff (PHASE2 §0.3 chain) — execution status

The chain was executed (2026-08-20) as far as the session's capabilities allow:

1. **Community feedback check** — DONE: GitHub API audit shows `PerryLink/dsh-data-quality` has 0 open/0 closed issues, 0 stars; no feedback to fold in before the next release.
2. **Standard item B (community engineering)** — DONE: all 8 GitHub topics are set (`dsh`, `dsh-plugin`, `deepseek-harness`, `cordis`, `data-quality`, `data-cleaning`, `data-profiling`, `data-verification` — mirror of `package.json` keywords); five-language READMEs pass `verify:readme-sync`; `THIRD_PARTY_NOTICES.md` current. The Project/Plugins overview (`D:\deepseek-harness\Project\Plugins\README.md`) now lists `dsh-data-quality` under "已发布 GitHub + npm" (30 projects / 13 published).
3. **Standard item A (ecosystem delivery)** — npm closed (`dsh-data-quality@0.1.0`, 2026-08-19T13:54Z). Ecosystem catalog submission is BLOCKED: community catalogs exist (`awesome-dsh-plugins/awesome-dsh-plugins` et al., none listing this plugin yet) but submitting requires GitHub write credentials — no `gh` CLI and no `GH_TOKEN`/`GITHUB_TOKEN` in this session; a release session with credentials should open the catalog PR.
4. **Standard item C (publish upload)** — CLOSED for 0.1.0: tag `v0.1.0`, GitHub Release (2026-08-19T13:45Z), npm publish (2026-08-19T13:54Z). `main` synced to origin (`d669a19`). For the next version: `node scripts/release.mjs <x.y.z>` (stamps CHANGELOG, re-runs the gate, commits + tags, never pushes), then push — `release.yml` publishes to npm with provenance and creates the GitHub Release from the stamped CHANGELOG section (needs the `NPM_TOKEN` secret configured on the repo).

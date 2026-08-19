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
- `src/profile.ts` — numeric profile (min/max/mean/median/distinct/blank/duplicate rows), column stats, text rendering.
- `src/clean.ts` — six rule kinds: `fill_missing`, `strip_whitespace`, `drop_duplicates`, `convert_type`, `normalize_case`, `cross_column` (numeric / date-epoch / string comparison).
- `src/verify.ts` — seven rule kinds: `not_null`, `unique`, `range`, `regex_match`, `allowed_values`, `date_range`, `cross_column`; plus `checkCitations`/`parseLocator`/`walkLocator` and the four verification states (`verified` / `mismatch` / `not-found` / `unverifiable`).

### Integration surfaces

- `src/store.ts` — `data_quality` storage domain (zod record schema, version 1, table `reports`), deterministic report key `YYYYMMDDHHmmssSSS-<kind>-<8-hex-sha256>`.
- `src/events.ts` — `data-quality/profile|clean|verify` in the `SessionEventMap` declaration merge. Adaptive append gate: known vocabulary → plain append; unknown vocabulary → probe the unbound `append` source for an `ignorable` marker and only then append with `{ ignorable: true }`; otherwise skip (the storage-domain report is always the durable copy). This is required because the rc.6 `Session.append` has no `ignorable` flag and no plugin event-registration surface exists, so an unknown appended type makes the persistence coordinator refuse the session log on restore.
- `src/config.ts` — Schemastery schema + explicit `resolveConfig` (no hidden `?? default`); numeric bounds fail loud at mount.

### Model tools (per plugin contract)

| Tool | Input | Output |
|---|---|---|
| `data_profile` | dataset path, columns?, max rows | column stats, row/column counts, blank/duplicate counts |
| `data_clean` | dataset path, rules[], output path (optional, workspace-confined) | rule log, applied/kept/dropped rows |
| `data_verify` | dataset path, rules[], output path?, evidence limit | verdict `passed`, per-rule results with evidence rows |

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

### Gate chain (all green on the final tree)

```
pnpm run typecheck                 PASS
pnpm run typecheck:ci              PASS
pnpm test                          PASS   112 tests / 8 files
pnpm run build                     PASS   lib/types + lib/index.js; fix-dts rewrote 11 files / 37 specifiers
pnpm run verify:self-contained     PASS   all dependency specs resolve from the registry
pnpm run verify:artifacts          PASS   syntax + ESM import + plugin face + no .ts leftovers + bundle patch present
node scripts/check-readme-sync.mjs PASS   all 5 READMEs share section structure and config keys
pnpm run pack:check                PASS   dsh-data-quality-0.1.0.tgz (lib/index.js + lib/types + cordis.patch.yml + READMEs + src)
```

`pnpm run test:coverage` thresholds (statements 90 / branches 80 / functions 90 / lines 90) pass.

### Real composition smokes

1. **Loader runner** (`node scripts/loader-runner.mjs <cordis.yml> fixtures`): boots a real `Context` + vendored Loader with the Include builtin against a cordis.yml of the real storage seam (dsh-storage + dsh-storage-json + dsh-storage-domain), dsh-system-prompt, dsh-tools, and the BUILT `lib/index.js` bundle with `workspaceRoot` = fixtures dir. Result:

   ```
   DSH_LOADER_RESULT {"tools":["data_profile","data_clean","data_verify"],"profileRows":10,"profileColumns":6,"cleanOutputRows":8,"verifyPassed":false,"citationStatus":"verified"}
   ```

   This is the keyless three-tool chain over the dirty fixture: profile 10 rows / 6 columns; clean drops 2 duplicate rows (8 out); verify `passed:false` is the correct verdict (the fixture's missing `holding_value` on FUND005 fails `range` — evidence flows); `verifyCitations` resolves a cited value from `holdings-summary.json` → `verified`.

2. **Real dsh CLI temp-profile install** (DSH_HOME under the plugin's `.tmp/`): `dsh plugin --profile dq add @deepseek-ai/dsh-base@0.1.0-rc.6 @deepseek-ai/dsh-headless@0.1.0-rc.6 ./dsh-data-quality-0.1.0.tgz` → install succeeds; `dsh --profile dq --dump-config` shows the bundle patch merging the storage rows + `dsh-data-quality` row into the boot config; keyless headless `dsh --profile dq "Reply with exactly: ok"` exits with `MISSING_CREDENTIAL` (proves the plugin tree mounted — a pending service would hang to timeout instead); `dsh plugin --profile dq remove dsh-data-quality` reverts cleanly (dump-config shows no `dsh-data-quality` / `data_quality` residue, bundles list back to base+headless).

## Repo state

- 8 conventional commits on `main` (scaffold → dataset layer + engines → seam → tools + entry → tests → scripts → CI → docs). Working tree clean. No pushes; release is deferred to the release session.
- `.tmp/` (smoke sandboxes) removed; `dsh-data-quality-0.1.0.tgz` left outside the tree (gitignored) for the release session.

## Known limitations & follow-up suggestions

- **Session events are best-effort on pre-rc.7 hosts**: on a host whose append lacks the `ignorable` marker, `data-quality/*` events are skipped rather than risking log-restore refusal; the storage-domain report remains the durable record. Revisit when the harness exposes a real plugin event-registration surface.
- **No fuzzy/LLM-based cleaning**: rule semantics are strictly deterministic by design; a future `data_clean` rule kind could delegate fuzzy matching to an LLM tool as an opt-in.
- **`workspaceRoot` is process-start-time**: a service-level citation check caches the resolved root at provider construction; a runtime configuration change (if the harness ever supports it) requires remounting the plugin.
- **Numeric parsing is strict**: locale-formatted numbers (`"1,234.56"`) and currency strings are treated as text, not coerced — add `convert_type` first.
- **Cross-column date comparison uses epoch fallback**: strings that do not parse as numbers fall back to `Date.parse`; unparseable pairs fall back to strict string equality (only for `==` / `!=`).
- **Evidence rows are truncated** by `MAX_CELL_TEXT` (120 chars) — display safety invariant, not tunable.
- **Release session work**: re-run the gate chain, `node scripts/release.mjs <x.y.z>` (bumps package.json + `src/version.ts`, stamps CHANGELOG, commits + tags), then `git push origin main --follow-tags` triggers `.github/workflows/release.yml` (gate re-run + npm publish with provenance + GitHub Release from the stamped CHANGELOG section).

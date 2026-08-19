# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-19

### Added

- The `ctx.dataQuality` capability seam (Service Definition / local deterministic Provider / tool Consumers) with the frozen cross-plugin `verifyCitations(request)` contract for document-number ↔ dataset checks (verified / mismatch / not-found / unverifiable, relative-tolerance numeric comparison).
- `data_profile` tool: deterministic dataset profiling (row/column counts, inferred types, missing rates, unique counts, numeric distributions, IQR outliers, mixed-type notes, duplicate-row counts) over workspace CSV/TSV/JSON/JSONL, with optional systematic sampling.
- `data_clean` tool: ordered declarative cleaning rules (`dedupe`, `fill-missing`, `coerce-type`, `normalize-unit`, `trim`, `map-values`) with a per-rule audit log; the source file is never overwritten and cleaned output writes only inside the workspace.
- `data_verify` tool: declarative verification rules (`not-null`, `unique`, `range`, `regex`, `enum`, `cross-column`, `freshness`) with capped failing-row evidence; overall failure is a normal `passed: false` result, never a tool error.
- Durable report persistence to the `data_quality` storage domain (keyed by run timestamp + dataset fingerprint), adaptive `data-quality/profile|clean|verify` session events on hosts that can carry them safely, fail-loud Schemastery config, and workspace-confined path resolution (escape + extension + size + row guards).

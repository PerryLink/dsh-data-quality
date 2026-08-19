# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately through GitHub's private vulnerability reporting:

**https://github.com/YOUR_ORG/dsh-data-quality/security/advisories/new**

That flow keeps the report confidential while we triage, and it is the channel we watch first.

## Before you report

- **Redact sensitive data** from any logs or session excerpts you attach: tokens, API keys, secrets, Authorization/request headers, personal paths, and account identifiers.
- Include, when possible: the plugin version, the harness (`dsh`) version, Node and OS versions, and the minimal steps to reproduce.

## What to expect

- **Acknowledgment**: within 5 business days.
- **Triage**: within 10 business days we confirm the issue and assess severity, or ask for more details.
- **Fix**: security fixes are prepared in a private fork, released as a patch version, and announced in the release notes.

## Disclosure and credit

- We follow coordinated disclosure: a public advisory (and CVE request where appropriate) is published once a fix ships.
- Reporters are credited in the advisory unless they ask to remain anonymous. There is no bug bounty program at this time.

## Scope

This plugin reads and writes datasets inside the session workspace. Its guarantees are:

- **Workspace confinement** — every dataset and output path resolves inside the session workspace (service-level calls use the configured `workspaceRoot`); `..` escapes and absolute paths outside the root are rejected, and extensions are allowlisted.
- **Bounded work** — row and file-size caps reject oversized inputs loudly; evidence and preview rows are capped; cell text in tool results is display-truncated.
- **No source mutation** — `data_clean` never overwrites its input dataset; cleaned output writes only to a distinct workspace-confined path.
- **No network or credentials** — the plugin performs no outbound requests and stores no secrets; reports persist to the local harness storage domain.
- **Fail-loud configuration** — every tunable is validated at mount.

Vulnerabilities in the harness itself should be reported to the official harness maintainers instead.

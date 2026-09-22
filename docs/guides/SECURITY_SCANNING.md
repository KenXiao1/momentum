# Security scan contracts and open findings

## Blocking scans

CI includes dependency auditing, Semgrep, and secret scanning in the stable
`required` result. Scanner failures are failures, even when no findings were
written. Semgrep uses a pinned CLI and the `p/ci` ruleset; it must exit successfully
and produce valid JSON with no errors, no findings, and scanned application files.
Its report is uploaded even when a scan fails.

Gitleaks uses a pinned CLI with a verified release checksum. Pull requests scan
all commits between the event's base and head SHA; pushes scan their before/after
range. This avoids truncating long changes to one page of a commits API. New refs,
scheduled runs, manual runs, and `npm run security:gitleaks` without an event scan
complete history. Reports redact credentials. The runner treats every nonzero exit
code as a failure and rejects missing or invalid reports. It never posts pull request comments.
A passing change-range scan does not certify the full repository history.

`npm run security:npm-audit` audits development and runtime dependencies. The
September 2026 dependency refresh has no known npm audit findings or exemptions.
The lockfile and narrow same-major overrides carry the patched transitive
versions; verify parent upgrades before removing those overrides.

## Open historical Supabase credential finding

Status as of 2026-09-20: **revocation or rotation is not yet confirmed**.

A local Gitleaks 8.30.1 full-history scan inspected 393 commits and found a
Supabase personal access token in the `SUPABASE_ACCESS_TOKEN` environment setting
of a historical MCP configuration. The file is absent from the current checkout;
that does not revoke the token or remove it from existing clones. Local `.mcp.json`
files are now ignored to reduce the chance of another accidental commit.

| Field         | Value                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| Commit        | `72c36ab8ff042af8e90454224b05839afe513da3`                              |
| File and line | `.mcp.json:14`                                                          |
| Rule          | `generic-api-key`                                                       |
| Fingerprint   | `72c36ab8ff042af8e90454224b05839afe513da3:.mcp.json:generic-api-key:14` |
| Token value   | Redacted; never copy it into reports or issues                          |
| Disposition   | Open; no scanner exemption                                              |

The account owner must revoke or rotate this personal access token in Supabase
and update any integrations that still depend on it. Record confirmation without
recording either token value. No production credentials were used or changed
while preparing this fix, and no repository history was rewritten.

Until revocation is confirmed and a reviewed disposition is recorded, complete
history scanning is expected to fail on this finding. Do not describe a green
pull request range as resolution, or add a broad path/rule exclusion to hide it.

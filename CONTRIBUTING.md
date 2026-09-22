# Contributing

## Setup

Use `.nvmrc` for the development Node version (`package.json` defines supported
versions), then `npm ci`. Start the web app with `npm run dev` or the desktop app
with `npm run tauri dev`. Native development also requires Rust and the
[platform dependencies](docs/guides/DEPLOYMENT.md).

## Finding the implementation

- [Architecture](docs/guides/ARCHITECTURE.md): application, storage, lifecycle,
  and browser/native boundaries.
- [Domain and product documentation](docs/README.md): feature behavior.
- [Testing](docs/guides/TESTING_GUIDE.md): suite selection, fixtures, and CI.
- [Database migrations](docs/guides/apply-migration.md): schema and persistence changes.
- [Deployment](docs/guides/DEPLOYMENT.md): web and native releases.

## Local verification

Select checks for the diff. There are no pre-commit hooks or mandatory local
full-pipeline runs. `package.json` is the command reference.

| Change               | Useful checks                                                                |
| -------------------- | ---------------------------------------------------------------------------- |
| Documentation        | Prettier and Markdown lint on changed files                                  |
| React/TypeScript     | Targeted tests, `npm run typecheck`, ESLint on changed files                 |
| CSS                  | `npm run lint:css`, `npm run quality:css-structure`, inspect the affected UI |
| Imports or dead code | `npm run quality:knip`, `npm run quality:arch-gate`                          |
| Persistence          | Relevant unit and integration tests; migration guide for SQL                 |
| Tauri                | `npm run quality:rust` for Rust; affected adapter tests and native build     |

Examples (replace the file paths):

```sh
npx prettier --check docs/guides/ARCHITECTURE.md
npx markdownlint-cli2 docs/guides/ARCHITECTURE.md
npm run test:all -- path/to/file.test.ts
```

`npm run build` builds the web bundle; it does not typecheck. The combined local application lane
is available through `npm run quality:ci:required` when the change warrants it
(after `npx playwright install chromium`). CI runs static checks, behavior tests,
Rust, builds, dependencies, browser journeys, database tests, Semgrep, and secret
scanning independently. The stable `required` job fails if any blocking job
fails, is cancelled, or is skipped. The default branch requires that check,
including for administrators, and requires pull requests with resolved conversations.

`npm run typecheck:tests` checks test fixtures and mocks. `npm run test:database`
executes real PostgreSQL tests; see the migration guide for its local prerequisites.
Run `npm run security:semgrep` separately with the pinned scanner installed to
match the security lane. Local quality commands do not change GitHub settings.

## Diagnostics

New interface text should use typed keys in `src/i18n/translations.ts` through
`useI18n().t`, with both English and Chinese entries and named interpolation
parameters. Migrate existing inline translations by complete screen or workflow
when changing it: task editing first, then focus/completion, import/export, and
RSIP. Keep localized strings out of persisted business identities and receipts.
The loading screen, editor header/description, and diagnostics settings now use
central keys. The remaining inline `tr` calls are a migration backlog; they are
not all centralized by this change. Ratchet `tools/quality/i18n-tr-baseline.json`
down after each migration, and run `quality:i18n` plus the affected language/UI
tests. Do not increase the budgets to make a new screen pass.

`npm run quality:smell-audit` collects Knip, duplication, and SonarJS findings.
These are investigation inputs, not instructions to split files or create
abstractions. Reports go under `reports/quality/` and `reports/jscpd/`.

For performance work, use [performance benchmarks](docs/guides/PERFORMANCE_BENCHMARKS.md)
and capture measurements relevant to the reported problem. Production users can
export bounded local diagnostics from Personal Settings. `npm run benchmark:browser`
records real Chromium startup/tree timings and verifies the export flow.
`docs/plans/` and
`docs/history/` contain dated context, not current development requirements.

Security scans are available as `security:npm-audit`, `security:semgrep`,
`security:gitleaks`, and `lint:sql`. See [scan contracts and open findings](docs/guides/SECURITY_SCANNING.md)
for the historical credential that still needs verified revocation. Install the Semgrep version pinned in its workflow; missing tools,
scan errors, findings, and absent or empty scan reports fail the Semgrep command.
SQL lint requires SQLFluff and PowerShell; missing SQLFluff is advisory locally
and fails in CI. Dependabot opens weekly npm, Cargo, and Actions updates.

The September 2026 dependency refresh keeps the Node 20 toolchain and uses
same-major overrides for vulnerable transitive YAML, Markdown, glob, and query
parsers whose parents pin older versions. Keep the overrides until the parents
adopt patched versions; review removals with a fresh `npm audit` and the affected
lint/test tools. No npm vulnerability exemptions are currently needed.

## License

Contributions use the repository [license](LICENSE).

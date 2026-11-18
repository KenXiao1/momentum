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
scanning independently. Feature branches run CI on pull requests; push CI runs
only on `new-feature-branch`, avoiding duplicate checks on the same PR commit.
PRs changing only root or `docs/` Markdown run formatting, Markdown/spelling
checks and the secret scan. Other PRs, default-branch pushes and manual runs use
the full lane. The stable `required` job always runs and rejects failures,
cancellations, missing results and skips outside the selected lane. Non-admin
changes to the default branch require that check and pull requests with resolved
conversations. Administrators can bypass the PR and status-check requirements
and push directly; those pushes still run CI and report failures.

`npm run typecheck:tests` checks test fixtures and mocks. `npm run test:database`
executes real PostgreSQL tests; see the migration guide for its local prerequisites.
Run `npm run security:semgrep` separately with the pinned scanner installed to
match the security lane. Local quality commands do not change GitHub settings.

## Diagnostics

Interface text uses typed keys in `src/i18n/translations.ts` through
`useI18n().t`, or `t` from `src/utils/runtimeI18n.ts` outside React. Add both
English and Chinese entries with identical named placeholders, for example
`{count}`. Pass the corresponding named object to `t`; TypeScript requires
parameters inferred from the English template, and `quality:i18n` checks the
actual argument names as well as dictionary parity. Use literal semantic keys
so the gate can identify missing translations. Keep localized strings out of
persisted business identities and receipts.

The inline `tr(zh, en)` API has been removed. Its call and file budgets are
zero, and the gate rejects increasing them. Run `npm run quality:i18n`,
`npm run typecheck`, `npm run typecheck:tests`, and the affected language/UI
tests when adding or changing translations. Shared translator tests verify
interpolation and language selection; workflow tests should verify the text
that matters to the user in both languages.

The gate also rejects common local bilingual dictionaries and inline language
branches or Chinese JSX copy. Shared domain formatting can use the pure
`translate(language, key, params)` helper. Canonical stored preset values,
migration markers, and compatibility error-matching strings stay stable;
centralizing labels does not rewrite historical or user-provided data.

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

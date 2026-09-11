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

`npm run build` builds the web bundle; it does not typecheck. Full local CI parity
is available through `npm run quality:ci:required` when the change warrants it.

## Diagnostics

`npm run quality:smell-audit` collects Knip, duplication, and SonarJS findings.
These are investigation inputs, not instructions to split files or create
abstractions. Reports go under `reports/quality/` and `reports/jscpd/`.

For performance work, use [performance benchmarks](docs/guides/PERFORMANCE_BENCHMARKS.md)
and capture measurements relevant to the reported problem. `docs/plans/` and
`docs/history/` contain dated context, not current development requirements.

Security scans are available as `security:npm-audit`, `security:semgrep`, and
`lint:sql`. The latter two require their external tools (and the PowerShell
runner); they skip missing tools locally and fail for missing tools in CI.

## License

Contributions use the repository [license](LICENSE).

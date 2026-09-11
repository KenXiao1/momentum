# Momentum

React/TypeScript focus and habit app implementing CTDP and RSIP, with local or
Supabase persistence and a Tauri native shell.

## Navigation

Read the documents relevant to the task; this is a map, not a reading checklist.

| Topic                                            | Source                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Development and verification                     | [CONTRIBUTING.md](CONTRIBUTING.md)                                                       |
| Architecture, storage, lifecycle, platform/Tauri | [Architecture](docs/guides/ARCHITECTURE.md)                                              |
| Product and domain behavior                      | [Documentation index](docs/README.md), [feature overview](docs/FEATURES_OVERVIEW.md)     |
| Database schema and migrations                   | [Schema](docs/api/DATABASE_SCHEMA.md), [migration guide](docs/guides/apply-migration.md) |
| Automated tests and manual scenarios             | [Testing guide](docs/guides/TESTING_GUIDE.md)                                            |
| Web and native builds/releases                   | [Deployment](docs/guides/DEPLOYMENT.md)                                                  |

## Boundaries worth knowing

- UI/AppShell containers and domain hooks use public storage hooks and
  `src/storage/ports.ts`; views receive props. Concrete adapters belong below
  that boundary. See `.dependency-cruiser.cjs` for enforced import rules.
- Local and Supabase storage are both supported. Switching modes changes the
  data source without merging data; pet state stays local even in cloud mode.
- Existing missing-column fallbacks support databases with pending migrations.
  Preserve that compatibility when changing persistence; details are in the
  migration guide.
- Database changes use new files in `supabase/migrations/`. Preserve user-scoped
  RLS and explicit caller checks in `SECURITY DEFINER` RPCs; UI filtering is not
  authorization. Keep RPC named arguments aligned with SQL signatures.
- Native APIs are loaded through `src/utils/tauri-bridge.ts` and
  `src/utils/platform-adapters/`. Shared code also runs in browsers; Tauri builds
  intentionally disable the PWA service worker.

## Useful commands

Use the Node version in `.nvmrc`; `package.json` owns the complete script list.

```sh
npm ci
npm run dev
npm run tauri dev
npm run typecheck
npm run lint
npm run test:all -- path/to/file.test.ts
npm run test:integration -- path/to/file.integration.test.ts
npm run quality:arch-gate
```

`npm test` and `test:all` run the same unit suite, excluding integration and
performance tests. `test:coverage` combines unit and integration suites.
`build` runs Vite, not the typechecker.

Use targeted checks while iterating and verification appropriate to the final
diff. Documentation-only changes need document checks, not application tests.
The full CI lane and scheduled mutation tests are described in the testing guide.

Explicit task requirements take precedence over ordinary project guidance.
Security, data-integrity, and external operational constraints still apply.

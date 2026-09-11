# Momentum architecture

Momentum implements CTDP task chains and RSIP policy trees. Product behavior is
documented in the [domain and feature index](../README.md); this document maps
the implementation. Dependency versions and commands live in
[package.json](../../package.json).

## Application and domain logic

| Area                     | Entry point                                   | Responsibility                                  |
| ------------------------ | --------------------------------------------- | ----------------------------------------------- |
| UI and application shell | `src/components/`, `src/app/`                 | Presentation, interaction, orchestration        |
| Pure domain logic        | `src/domain/`                                 | Models and calculations without React           |
| React domain integration | `src/hooks/domains/`                          | State transitions and persistence orchestration |
| Services                 | `src/services/`                               | Shared business operations                      |
| Storage                  | `src/storage/`, `src/infra/storage/supabase/` | Persistence contracts and implementations       |
| Platform                 | `src/utils/platform-adapters/`, `src-tauri/`  | Browser/native capabilities                     |

AppShell, FocusMode, and ChainEditor use container/view separation: containers
coordinate state and effects; views and sections receive props. File length is
not an architectural boundary. Pure domain functions need no hook or service
wrapper unless a caller needs React integration or shared orchestration.

`src/types/index.ts` exports the shared product types. `Chain` is a discriminated
union of `UnitChain` and `GroupChain`; `ChainDraft` preserves that union for forms.
`src/domain/result.ts` supplies `Result<T, E>` for operations with explicit failure
results. The types themselves are the reference for fields and variants.

## Storage

`src/storage/ports.ts` defines focused contracts such as `ChainStore` and
`SessionStore`. `MomentumStorage.ts` composes them into the full adapter contract.
`useStorage()` and `useStorageMode()` expose storage to containers and hooks.
UI/AppShell code uses these public entry points; concrete adapters and storage
internals remain below that boundary. The executable import rules live in
[.dependency-cruiser.cjs](../../.dependency-cruiser.cjs).

The two implementations are:

- `src/storage/localStorageAdapter.ts`, backed by `src/utils/storage/`.
- `src/infra/storage/supabase/SupabaseStorage.ts`, composed from table modules
  and mappers in that directory. `src/lib/supabase.ts` wraps the SDK client;
  `src/utils/supabaseConfig.ts` checks configuration without loading the SDK.

Hooks may call a storage port directly or use a service; not every operation
passes through every layer. Contract changes affect both adapters and their
tests. Supabase schema/type changes are covered by the
[migration guide](apply-migration.md).

`StorageContext.tsx` selects and wires the adapter. Tauri starts in local mode
unless a valid cloud preference was saved. Web defaults to cloud when Supabase
is configured. Switching modes selects a different data source and does not
merge or migrate records. Pet data remains local in both modes. `storage.kind`
identifies the adapter; capability checks in `ports.ts` describe supported
operations such as authentication and betting.

## Lifecycle

`src/app/app-shell/useAppShellBootstrap.ts` reaches
`src/app/hooks/useServiceLifecycle.ts`, which starts/stops the forward timer,
rule state manager, cache, and development monitoring. `SystemRuntime` in
`src/services/runtime/` groups cache and monitoring access. The lifecycle hook
is the integration point for these services.

`MigrationCoordinator` in `src/services/migration/` coordinates startup, data,
and exception-rule migrations. `StorageProvider` in `StorageContext.tsx` supplies
the current adapter to migration, realtime sync, and recycle-bin services and
clears that wiring on cleanup.

## Platform and Tauri

`src/utils/platform.ts` detects `web`, `tauri-desktop`, or `tauri-mobile`.
Adapters in `src/utils/platform-adapters/` implement notifications, file I/O,
window operations, haptics, and updates. Native commands use the lazy
`src/utils/tauri-bridge.ts`; plugin APIs are also loaded inside native paths.
This allows shared modules to load in browsers without invoking native APIs.

`src-tauri/src/lib.rs` registers Rust commands and plugins; `main.rs` is the
desktop entry. `src-tauri/capabilities/` controls permissions and
`src-tauri/Cargo.toml` separates desktop/mobile dependencies. The mobile code
path exists, but release CI currently builds desktop targets; mobile packaging
remains in progress. See [deployment](DEPLOYMENT.md) for prerequisites and builds.

Vite disables the PWA plugin when Tauri sets `TAURI_ENV_PLATFORM`, avoiding
service-worker conflicts with the native WebView.

## Shared utilities and verification

`src/utils/env.ts` centralizes environment checks; `logger.ts`, `toast.ts`, and
`errors/normalizeError.ts` provide logging, user feedback, and unknown-error
normalization. Existing callers show their APIs.

Formatting and code rules live in Prettier/ESLint configuration, import rules in
Dependency Cruiser, and behavior in tests. See the [testing guide](TESTING_GUIDE.md)
for suite boundaries and [CONTRIBUTING.md](../../CONTRIBUTING.md) for local checks.

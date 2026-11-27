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

`useAppShellDomains` wires the domain hooks in one place. `useAppShellViewModels`
derives chain context and modal data directly into the view's prop types; there
is no separate builder layer or primary/secondary domain grouping.

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

Single-policy and split-template submissions use `createNodes` through the public
`createRSIPNodesWithMeta` port. The domain queues both affected slices and publishes
persisted nodes and metadata in one state update. Local storage uses the existing
recovery journal; Supabase uses `create_rsip_nodes_with_meta` and its returned rows.
An unchanged failed form keeps its node IDs for retry. Metadata updater functions
are evaluated inside the domain queue, so mode changes retain committed creation
metadata without a second UI metadata snapshot or queue.

Bulk RSIP/history replacement and complete-session/import operations use the
transaction and recovery contracts in [operations recovery](OPERATIONS_RECOVERY.md).
The local adapter writes a recovery journal; cloud operations use authenticated
RPCs with observed-row comparison and durable operation receipts. Notifications
and UI success transitions follow confirmation of the core commit.

`StorageContext.tsx` selects and wires the adapter. Tauri starts in local mode
unless a valid cloud preference was saved. Web defaults to cloud when Supabase
is configured. Switching modes selects a different data source and does not
merge or migrate records. Pet data remains local in both modes. `storage.kind`
identifies the adapter; capability checks in `ports.ts` describe supported
operations such as authentication and betting.

## Lifecycle

`src/app/app-shell/useAppShellBootstrap.ts` reaches
`src/app/hooks/useServiceLifecycle.ts`, which starts/stops the forward timer
and development monitoring directly. The lifecycle hook is the integration point
for these services. Rule creation returns the persisted ID; execution reads storage
and validates the current rule. There is no service-level temporary ID registry or
rule-state mirror. The rule manager UI keeps its own optimistic update/rollback.

Exception rules go through `exceptionRuleManager`, which combines pure functions
in `src/domain/rules.ts` with the active storage's `RuleStore` port.
`StorageProvider` hands the manager each new storage; the switch waits for
queued rule operations. Local mode uses `src/storage/localRuleStore.ts`. Cloud
mode uses the per-user `exception_rule_sets` row
(`src/infra/storage/supabase/exceptionRules.ts`), whose `revision` rejects a
save based on stale rules; each device merges its pre-sync local rules into
that row once, and the store stays local while the table is not migrated.
It runs one operation at a time, so concurrent writes cannot overwrite each other.
Focus-mode creation passes `{ reuseExisting: true }`: an exact name reuses the
existing rule, a similar name is created with a warning. Rule failures surface to
the caller; there is no service-level error recovery.

Chain trees are derived from chain arrays. Dashboard and group rendering use
local React memoization; domain actions build the tree when needed. There is no
shared query cache, chain revision counter, or manual invalidation protocol.

AppShell passes a task lifecycle callback into session operations to invoke RSIP
task-link integration. `useTaskLifecycleIntegration` keeps the mounted handler
current, ignores new dispatches after unmount, and isolates asynchronous errors.
It does not use a global event bus.

Database schema changes are SQL files in `supabase/migrations/`. On the client,
the only data migration is the completion-history timing normalization that
`useAppDataLoad` applies after loading (`utils/completionHistoryTimingMigration.ts`).
Add a client migration only for stored data that cannot be normalized on read,
and make it run once. `StorageProvider` in `StorageContext.tsx` hands the
current adapter to the exception rule manager. There is no cross-device push.
In cloud mode `useRemoteChangeNotice` compares the `get_sync_fingerprint` digest
from when the app went to the background with the one when it returns, and
offers a reload when another device changed the data; nothing reloads by itself.

## Error handling

Errors are caught in two places. Storage adapters translate failures into the
errors their port promises (and keep missing-column fallbacks); UI action entry
points, such as a modal's submit handler, log the failure once and show it to
the user. Layers in between let errors propagate, unless they compensate (roll
back optimistic state, retry) before throwing again. A write must never be reported
as saved when it was not: only writes whose loss is harmless, such as UI
preferences, may swallow failures, and they say why with `// best-effort:`.
`npm run quality:error-handling` enforces this.

## Platform and Tauri

`src/utils/platform.ts` detects `web`, `tauri-desktop`, or `tauri-mobile`.
Adapters in `src/utils/platform-adapters/` implement notifications, file I/O,
window operations, haptics, and updates. Native commands use the lazy
`src/utils/tauri-bridge.ts`; plugin APIs are also loaded inside native paths.
This allows shared modules to load in browsers without invoking native APIs.
Adapter getters return the module-owned instances without a second instance cache.
The capability center reads adapter support on demand. Each operation reads only
its own adapter, without a callback through the aggregate capability query. Its
wrappers preserve unsupported, cancellation, and failure results used by UI workflows.

`src-tauri/src/lib.rs` registers Rust commands and plugins; `main.rs` is the
desktop entry. `setup` copies webview data from the previous app identifier
(`identifier_migration.rs`) before it creates the main window. Desktop-only
commands keep the tray menu in the app language (`set_tray_labels`) and post a
system notification when a timed focus session ends (`schedule_session_end` /
`cancel_session_end`, scheduled by `useSessionEndAlarm`), because the
webview's own timers are throttled while the window is hidden. For the same
reason `set_daily_reminders` hands this device's daily chain reminders to a
Rust thread (`daily_reminders.rs`, local time via `chrono`);
`useDailyReminderScheduler` sends the list, or keeps a page timer on the web. `src-tauri/capabilities/` controls permissions and
`src-tauri/Cargo.toml` separates desktop/mobile dependencies. The mobile code
path exists; release CI builds desktop targets and Android, while iOS packaging
remains in progress. See [deployment](DEPLOYMENT.md) for prerequisites and builds.

Vite disables the PWA plugin when Tauri sets `TAURI_ENV_PLATFORM`, avoiding
service-worker conflicts with the native WebView.

## Shared utilities and verification

`src/utils/env.ts` centralizes environment checks; `logger.ts`, `toast.ts`, and
`toError` in `errorMessage.ts` provide logging, user feedback, and unknown-error
normalization. Existing callers show their APIs.

Formatting and code rules live in Prettier/ESLint configuration, import rules in
Dependency Cruiser, and behavior in tests. See the [testing guide](TESTING_GUIDE.md)
for suite boundaries and [CONTRIBUTING.md](../../CONTRIBUTING.md) for local checks.

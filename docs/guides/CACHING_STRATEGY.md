# Caching and derived state

This guide describes existing caches, not a requirement to add caching to new
code. A cache needs evidence that its saved work outweighs invalidation,
ownership, and stale-data risks.

## Chain trees

`buildChainTree` derives a tree from the supplied chain array. Dashboard and group
rendering memoize this calculation locally with React `useMemo`; event handlers
build a tree when they need one. Chain updates replace the array, so changing a
name, repeat count, streak, or data source produces a fresh tree.

There is no global `QueryOptimizer`, query TTL, hash comparison, chain revision
counter, or `onDataChange` protocol. Initial loading already reads storage through
`useAppDataLoad` and its helpers. The removed optimizer's generic query and batch
APIs had no production callers.

A synthetic 10,000-chain tree took about 20ms to build on the audit machine. This
justifies retaining render-local memoization, but does not establish a need for
shared query caches. See the [ablation experiment](../plans/ablation-driven-simplification-2026-09-11.md)
for fixtures, measurements, and limitations.

## Remaining caches

| Area                               | Implementation                                                                    | Ownership and behavior                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Exception rules                    | `src/utils/cache/CacheCore.ts`, `ExceptionRuleCache.ts`                           | In-memory entries with TTL, oldest-entry eviction, namespace invalidation, and rule subscribers         |
| Rule search                        | `src/utils/rule-search-optimizer/RuleSearchCache.ts`                              | Up to 100 cached searches and 50 history entries; separate popularity counts; clearCache clears results |
| Validation and duplicate detection | `src/services/enhanced-rule-validation/cache.ts`, `EnhancedDuplicationHandler.ts` | Namespaces in the exception-rule cache                                                                  |
| Supabase schema capabilities       | `src/infra/storage/supabase/schemaCapabilities.ts`                                | Tracks capabilities reported missing by older user databases; participates in compatibility fallbacks   |
| Task time statistics               | `src/infra/storage/supabase/taskTimeStats.ts`                                     | Module-level cache of locally persisted statistics with a five-second TTL                               |
| Platform capabilities              | `src/utils/platform-capabilities/center.ts`                                       | Caches supported operations obtained from platform adapters                                             |

`src/constants/cache.ts` owns the common exception-rule cache defaults: five-minute
TTL, 1,000 entries, and one-minute cleanup. Search/duplicate TTLs are two minutes;
statistics use ten minutes. Callers can override TTLs. These values describe the
current implementation and are not performance guarantees.

`useServiceLifecycle` starts/stops the exception-rule cache cleanup interval.
`RealTimeSyncService.clearAllCaches` asks the selected storage implementation to
clear its caches. Other invalidation behavior belongs to each cache and caller;
there is no universal invalidation mechanism.

## Persistence and compatibility

Local preferences, timer snapshots, pet state, and RSIP journals are persistent
data. They must not be removed as if they were disposable query caches.
`localPreferences` exposes the preference functions through one object, preserving
existing keys and parsers.

Storage mode changes select a different source without merging records. Supabase
schema capability fallbacks support databases with pending migrations. A failed
write, user change, mode change, or imported replacement must not expose stale
records. Relevant storage and migration behavior is documented in
[architecture](ARCHITECTURE.md) and the [migration guide](apply-migration.md).

## Evaluating another cache

Measure the uncached operation using a real clock and realistic data. Verify
updated values and failure behavior, including equal-size replacement arrays,
switching users/modes, and out-of-order asynchronous completion. Retain a cache
only if its observed benefit justifies its state and invalidation rules.

The rule caches and platform capability caches remain candidates for separate
experiments. Their existence alone is not evidence of a performance requirement.

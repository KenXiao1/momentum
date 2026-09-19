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

| Area                         | Implementation                                       | Ownership and behavior                                                                                  |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Rule search                  | `src/utils/rule-search-optimizer/RuleSearchCache.ts` | Up to 100 cached searches and 50 history entries; separate popularity counts; clearCache clears results |
| Supabase schema capabilities | `src/infra/storage/supabase/schemaCapabilities.ts`   | Tracks capabilities reported missing by older user databases; participates in compatibility fallbacks   |
| Task time statistics         | `src/infra/storage/supabase/taskTimeStats.ts`        | Module-level cache of locally persisted statistics with a five-second TTL                               |

Rule selection reloads rules from storage and filters by chain, action type, and
active status. React state holds the displayed list. Duplicate checks also read
current storage; they do not keep a separate TTL snapshot. This prevents edited or
deleted rules and a previous action's list from surviving a reload. The unused
exception-rule cache framework, subscribers, and cleanup timer were removed with
the last two consumers in the [third ablation round](../plans/ablation-driven-simplification-2026-09-18-round-3.md).

`RealTimeSyncService.clearAllCaches` asks the selected storage implementation to
clear its caches. Other invalidation behavior belongs to each cache and caller;
there is no universal invalidation mechanism.

The unused rule prevalidation cache was removed in the
[second ablation round](../plans/ablation-driven-simplification-2026-09-18.md).
Runtime rule usage still validates through `rule-classification/ruleValidator.ts`;
creation warnings and health checks call `validateRulesIntegrity.ts` directly.
Platform support is read from adapters on demand, without a capability snapshot
cache. Native notification permission handling remains in the native adapter.

Search debouncing belongs to `useRuleSearchResults`: its effect cancels pending
work when query/rules change or the component unmounts. Empty queries reuse the
optimizer's usage-order sorting. The optimizer owns only search computation and
reuse, with no callback timer that can restore an outdated list.

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

The third-round probe retained search index and result reuse: at 10,000 synthetic
rules, forcing reindexing cost 34–48ms per query on the audit machine. This is a
stress measurement, not a production rule-count distribution. Direct duplicate
checks also cost 19–33ms at that scale; investigate a measured large-library issue
before introducing another cache, and preserve freshness in any replacement.

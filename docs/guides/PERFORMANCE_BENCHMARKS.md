# Performance measurement

Measure actual operations and user-visible latency before adding an optimizer.
The September 2026 [ablation report](../plans/ablation-driven-simplification-2026-09-11.md)
contains the chain-tree comparison and build-size results.

## What is currently measured

| Tool                    | Source                                                | Purpose                                                                          |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| React Profiler          | `src/app/app-shell/AppShellProfiler.tsx`              | Development render durations for shell views                                     |
| React render statistics | `src/utils/reactPerformanceMonitor.ts`                | Render counts, averages, maxima, and per-component statistics                    |
| Browser monitoring      | `src/utils/performance-monitor/PerformanceMonitor.ts` | FPS, layout shifts, paint observations, and explicit measurements                |
| Performance logging     | `src/utils/performanceLogger.ts`                      | Development timing and diagnostics; critical errors also log outside development |
| Layout diagnostics      | `src/utils/LayoutStabilityMonitor.ts`                 | Layout observations and issue reports                                            |
| Development panel       | `src/components/PerformanceMonitor.tsx`               | Realtime-sync status, React render statistics, and force refresh                 |
| Build output            | `npm run build`                                       | Vite asset/chunk sizes and compressed-size estimates                             |

The development panel no longer reports query-cache hits or offers a cache-clear
button: the global query optimizer was removed. Tree construction still has
`performanceLogger.time` instrumentation, and React owns memoization in rendering.

## Existing APIs

Use the source for complete signatures. These are available APIs, not extra
layers that every operation must pass through.

```typescript
import { performanceLogger } from '../../utils/performanceLogger';
import { reactPerformanceMonitor } from '../../utils/reactPerformanceMonitor';

const result = performanceLogger.time('calculation', () => calculate());
const renders = reactPerformanceMonitor.getStats();
const components = reactPerformanceMonitor.getComponentStats();
```

`useServiceLifecycle` starts/stops browser monitoring in development. Importing
monitoring code does not require a separate runtime facade.

## Automated checks and their limits

```sh
npm run test:performance
npm run test:all -- src/utils/__tests__/chainTree.test.ts
npm run build
```

The performance suite currently tests its measurement helpers. It does not
establish latency guarantees for product flows. Before the ablation, its setup
replaced `performance.now()` with a counter that advanced by 0.1ms per call.
That mock has been removed; results from the old harness must not be interpreted
as real timing measurements. JSDOM also does not reproduce browser layout,
painting, native WebView performance, or mobile hardware.

Use Vitest's case/file duration output to investigate slow tests. A separate
runtime-budget script no longer reruns all unit tests or applies fixed timing
limits across different machines.

## Running a useful experiment

- Choose a user operation and realistic data shape, then record a baseline.
- Measure cold and repeated execution separately with a real monotonic clock.
- Warm up the code; report multiple samples and spread, not only one duration.
- Keep logging, environment, build mode, and concurrency comparable.
- Verify correctness as well as speed: for trees, include changed metadata,
  group completion, reorder, and replacement data with the same IDs.
- Compare emitted JS and compressed chunks with the same build configuration.
- Check the affected browser/native platform when the bottleneck depends on it.

A 16.7ms frame budget is useful context for a 60Hz display, not a blanket test
threshold. Total interaction latency includes rendering, I/O, and scheduling.
No repository-wide size or cache-hit target proves a real user improvement.

For the audit's synthetic flat group, real-clock median tree construction was
about 0.15ms for 100 chains, 1.4ms for 1,000, and 20ms for 10,000. Render-local
memoization was retained because repeatedly rebuilding the largest fixture would
be costly. These figures are machine-specific observations, not mobile or
production guarantees.

## Further investigation

Exception-rule search/validation caches, layout monitoring, and schema capability
caches should be evaluated independently. See [caching and derived state](CACHING_STRATEGY.md)
for ownership and persistence distinctions. Remove an unnecessary cache instead
of adding more invalidation paths merely to preserve its current design.

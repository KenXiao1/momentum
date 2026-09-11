# RSIP Backlog Completion Implementation Plan

Historical plan; current development guidance is in [CONTRIBUTING.md](../../CONTRIBUTING.md).

**Goal:** Complete the five RSIP follow-up items recorded in commit `f998428` without changing user-visible workflows.

**Architecture:** Move pure RSIP interaction decisions into the RSIP domain, route session lifecycle notifications through a generic event bus subscribed by the application shell, and split Supabase RSIP persistence by entity. Assume the current RSIP database migrations are deployed and remove only RSIP's legacy basic/strict write fallback.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase JS, ESLint/SonarJS quality gates.

---

## Task 1: Extract RSIP interaction rules

**Files:**

- Create: `src/hooks/domains/rsip/viewInteractionRules.ts`
- Create: `src/hooks/domains/rsip/__tests__/viewInteractionRules.test.ts`
- Modify: `src/components/rsip/hooks/useRSIPViewInteractionActions.ts`
- Modify: `src/components/rsip/rsipViewHelpers.ts`

1. Write failing unit tests for linked-action filtering, group-collapse assessment, fallback node transitions, library restoration, descendants, and constraint power.
2. Run the focused test and confirm imports fail because the domain rules module does not exist.
3. Implement pure domain functions and update the hook to keep only UI state, confirmation, and callback orchestration.
4. Run the focused test and the existing RSIP component/domain tests.

## Task 2: Reset the RSIP integration singleton in tests

**Files:**

- Modify: `src/services/rsip-integration/__tests__/RSIPTaskIntegrationService.test.ts`
- Modify: `src/hooks/domains/__tests__/useRsipDomain.test.ts`

1. Add a singleton reset regression test and reset the exported singleton in `beforeEach` hooks that exercise it.
2. Run the focused service/domain tests and confirm isolation.

## Task 3: Introduce TaskLifecycleEvent bus

**Files:**

- Create: `src/types/taskLifecycle.ts`
- Modify: `src/types/index.ts`
- Create: `src/services/task-lifecycle/TaskLifecycleEventBus.ts`
- Create: `src/services/task-lifecycle/__tests__/TaskLifecycleEventBus.test.ts`
- Modify: `src/hooks/domains/useSessionsDomain.ts`
- Modify: `src/hooks/domains/sessions/start.ts`
- Modify: `src/hooks/domains/sessions/completion.ts`
- Modify: `src/app/AppShellContainer.tsx`
- Modify: affected tests

1. Write failing bus tests for publish/subscribe, unsubscribe, reset, and listener-error isolation.
2. Run the focused test and confirm the bus is missing.
3. Implement the generic bus and lifecycle event types.
4. Replace `onRsipTaskEvent` session dependencies with the generic publisher and subscribe RSIP in `AppShellContainer`.
5. Update tests to assert generic lifecycle events and subscription wiring.
6. Run bus, sessions, and app-shell tests.

## Task 4: Remove RSIP basic/strict write probing

**Files:**

- Modify: `src/infra/storage/supabase/rsipPayloadBuilder.ts`
- Modify: `src/infra/storage/supabase/rsipIntents.ts`
- Modify: `src/infra/storage/supabase/__tests__/rsipPayloadBuilder.test.ts`
- Modify: `src/infra/storage/supabase/__tests__/rsipIntents.test.ts`
- Modify: RSIP persistence tests

1. Replace legacy-fallback expectations with failing assertions that all node/meta writes use the complete schema exactly once and surface missing-column errors.
2. Run focused persistence tests and confirm old fallback behavior fails the new expectations.
3. Simplify payload building and node/meta writes to a single complete-schema path.
4. Run focused persistence tests.

## Task 5: Split Supabase RSIP persistence by entity

**Files:**

- Create: `src/infra/storage/supabase/rsipShared.ts`
- Create: `src/infra/storage/supabase/rsipNodes.ts`
- Create: `src/infra/storage/supabase/rsipMeta.ts`
- Create: `src/infra/storage/supabase/rsipCollections.ts`
- Create: `src/infra/storage/supabase/rsipExecutionRecords.ts`
- Modify: `src/infra/storage/supabase/rsip.ts`

1. Move existing verified behavior into entity-focused modules without changing the `rsip.ts` public API.
2. Run all Supabase RSIP tests and the structural large-file gate.
3. Remove obsolete RSIP capability code/imports once no references remain.

## Task 6: Full verification

1. Run formatting on touched files.
2. Run focused and smoke tests.
3. Run `npm run typecheck`, `npm run lint`, `npm run quality:large-files`, `npm run quality:arch-gate`, and `npm run build`.
4. Inspect `git diff --check`, `git status --short`, and the final diff against all five requirements.

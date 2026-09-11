# CI Quality Hardening Implementation Plan

Historical plan; current development guidance is in [CONTRIBUTING.md](../../CONTRIBUTING.md).

**Goal:** Make Momentum's required CI gates truthful again by enforcing architecture violations, removing the known circular dependency, and restoring formatting checks.

**Architecture:** Keep React views isolated from persistence implementations while allowing containers, controllers, and domain hooks to depend on the public storage contract and context hooks. Dependency Cruiser remains the executable boundary specification, and a governance test deliberately injects a forbidden UI-to-infrastructure dependency to prove that the command exits non-zero.

**Tech Stack:** TypeScript, Vitest, dependency-cruiser, Madge, Prettier, Rustfmt

---

## Task 1: Lock the architecture gate behavior with a failing test

**Files:**

- Modify: `src/__tests__/repo-governance.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

Add a governance assertion that the `quality:arch-gate` script uses Dependency Cruiser's `err` reporter. Add an integration-style test that temporarily creates a component importing Supabase infrastructure, runs the gate, and expects a non-zero exit code.

**Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.ts src/__tests__/repo-governance.test.ts`

Expected: FAIL because the package script still uses `--output-type text`.

**Step 3: Write minimal implementation**

Change the package script to `depcruise src --config .dependency-cruiser.cjs --output-type err`.

**Step 4: Run test to verify the reporter behavior passes**

Run: `npx vitest run --config vitest.config.ts src/__tests__/repo-governance.test.ts`

Expected: The reporter assertion passes; the full test remains blocked until existing architecture-rule false positives are resolved.

## Task 2: Align the executable architecture rules with the documented boundary

**Files:**

- Modify: `.dependency-cruiser.cjs`
- Modify: `docs/guides/ARCHITECTURE.md`
- Modify: `AGENTS.md`

**Step 1: Capture the current violations**

Run: `npx depcruise src --config .dependency-cruiser.cjs --output-type err`

Expected: FAIL with 28 violations, including six test fixtures and containers/controllers that use public storage hooks.

**Step 2: Implement the narrow boundary**

Exclude tests from production architecture rules. Permit UI containers, controllers, and domain hooks to use `src/storage/ports.ts`, `useStorage.ts`, and `useStorageMode.ts`; continue forbidding UI imports from `src/infra/storage/supabase/` and concrete adapters. Update architecture documentation to state this boundary explicitly.

**Step 3: Verify the architecture gate**

Run: `npm run quality:arch-gate`

Expected: PASS with zero production violations.

**Step 4: Verify the deliberate violation test**

Run: `npx vitest run --config vitest.config.ts src/__tests__/repo-governance.test.ts`

Expected: PASS, proving a forbidden import makes the gate exit non-zero.

## Task 3: Remove the RSIP circular dependency

**Files:**

- Create: `src/services/rsip-insights/rsipLocalization.ts`
- Modify: `src/services/rsip-insights/rsipRecommender.ts`
- Modify: `src/services/rsip-insights/rsipHighRiskRecommenders.ts`
- Modify: `src/services/rsip-insights/RSIPInsightsService.ts`
- Test: `src/services/rsip-insights/__tests__/RSIPInsightsService.test.ts`

**Step 1: Verify the existing hard gate fails**

Run: `npm run quality:circular`

Expected: FAIL with the `rsipRecommender.ts` and `rsipHighRiskRecommenders.ts` cycle.

**Step 2: Extract stateless localization helpers**

Move `toLocale`, `localize`, and `joinList` into `rsipLocalization.ts`. Import both recommenders and the service from that leaf module so dependencies become one-way.

**Step 3: Run focused behavior tests**

Run: `npx vitest run --config vitest.config.ts src/services/rsip-insights/__tests__/RSIPInsightsService.test.ts`

Expected: PASS with unchanged recommendation text and locale behavior.

**Step 4: Verify the circular dependency gate**

Run: `npm run quality:circular`

Expected: PASS with zero circular dependencies.

## Task 4: Restore format gates

**Files:**

- Modify: files reported by `npx prettier . --check`
- Modify: `src-tauri/src/commands/file_ops.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Apply deterministic formatters**

Run: `npm run format`

Run: `cargo fmt --all --manifest-path src-tauri/Cargo.toml`

**Step 2: Verify formatting**

Run: `npm run format:check`

Run: `cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check`

Expected: Both commands PASS.

## Task 5: Verify the CI-first batch

**Files:**

- No additional files

**Step 1: Run focused quality checks**

Run: `npm run lint && npm run lint:css && npm run lint:md && npm run typecheck && npm run quality:arch-gate && npm run quality:circular`

Expected: PASS.

**Step 2: Run tests and production build**

Run: `npm test`

Run: `npm run build`

Expected: PASS.

**Step 3: Review the final diff**

Run: `git diff --check`

Run: `git status --short`

Expected: No whitespace errors; only intended quality-hardening and formatter changes are present.

# Momentum Smell Cleanup Implementation Plan

Historical plan; current development guidance is in [CONTRIBUTING.md](../../CONTRIBUTING.md).

**Goal:** Reduce Momentum’s “屎山” signals (dead code, unused exports, complex hotspots, risky async patterns) with measurable deltas and no behavior regressions.

**Architecture:** Treat this as a cleanup campaign with guardrails: keep behavior stable, refactor in small increments, add focused unit tests around extracted pure logic, and continuously re-run the smell audit. Prefer deleting or quarantining dead code over “keeping it around”.

**Tech Stack:** Vite + React 18 + TypeScript + ESLint; smell tooling: Knip, ts-prune, SonarJS rules via ESLint, Madge, depcheck.

---

## Baseline (captured 2026-01-27)

Run: `powershell -ExecutionPolicy Bypass -File tools/quality/smell-audit.ps1`

Expected report files:

- `tools/quality/reports/knip.txt`
- `tools/quality/reports/ts-prune.txt`
- `tools/quality/reports/eslint-sonarjs.txt`
- `tools/quality/reports/madge-circular.txt`
- `tools/quality/reports/depcheck.txt`

Baseline numbers to beat:

- Knip: `60` unused files, `118` unused exports, `animejs` unused dependency, `@types/animejs` unused devDependency, `4` duplicate exports
- ESLint SonarJS: `157 problems (156 errors, 1 warning)`
- Madge: no cycles (starting from `src/main.tsx`, ~279 files analyzed)

## Working rules (to avoid accidental regressions)

- Before each refactor chunk, run: `npm test` and `npm run typecheck`
- After each refactor chunk, run: `powershell -ExecutionPolicy Bypass -File tools/quality/smell-audit.ps1`
- Prefer changes that _reduce_ the surface area: remove `export` when not needed, delete unused files, and avoid introducing new barrels.
- For UI-heavy refactors: extract pure helper functions into `src/utils/*` or a nearby module and unit-test the pure helpers (not React rendering).

---

### Task 1: Create an isolated workspace for the cleanup

**Files:**

- Modify: none

**Step 1: Create a worktree (recommended)**

- Run: `git worktree add ../momentum-smell-cleanup -b chore/smell-cleanup`
- Expected: new folder `../momentum-smell-cleanup` and a new branch `chore/smell-cleanup`

**Step 2: Install dependencies**

- Run: `npm install`
- Expected: completes without errors

**Step 3: Capture baseline reports**

- Run: `powershell -ExecutionPolicy Bypass -File tools/quality/smell-audit.ps1`
- Expected: report files updated under `tools/quality/reports/`

---

### Task 2: Remove the confirmed unused dependency (`animejs`)

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Search: `src/**/*`

**Step 1: Confirm no runtime usage**

- Run: `rg -n \"animejs|from 'animejs'|from \\\"animejs\\\"\" src`
- Expected: no matches (or only dead code candidates)

**Step 2: Remove dependency**

- Run: `npm uninstall animejs @types/animejs`
- Expected: `package.json` and `package-lock.json` updated

**Step 3: Verify**

- Run: `npm run typecheck`
- Expected: PASS
- Run: `npm test`
- Expected: PASS
- Run: `knip --config .knip.json`
- Expected: `animejs` and `@types/animejs` no longer reported

---

### Task 3: Fix Madge entrypoint usage and keep “no cycles” as a hard invariant

**Files:**

- Modify: `tools/quality/smell-audit.ps1` (only if needed)

**Step 1: Validate Madge analyzes real files**

- Run: `madge --circular --ts-config tsconfig.app.json --extensions ts,tsx src/main.tsx`
- Expected: “Processed N files … No circular dependency found!”

**Step 2: If cycles appear later**

- Run: `madge --circular --ts-config tsconfig.app.json --extensions ts,tsx src/main.tsx --json > tools/quality/reports/madge.json`
- Expected: JSON file with cycle details to guide refactors

---

### Task 4: Delete or quarantine “unused files” reported by Knip (reduce 60 → near 0)

**Files:**

- Modify/Delete: the specific files below
- Optional create: `src/experiments/README.md` (if you choose quarantine over delete)

**Step 1: Decide policy: delete vs. quarantine**

- If code is genuinely dead: delete.
- If code is “maybe useful later”: move to `tools/experiments/` (non-production) or `src/experiments/` and document that it’s not shipped.

**Step 2: Process unused files in batches (repeat until list is empty)**

- Run: `knip --config .knip.json --include files`
- For each file:
  - Run: `rg -n \"<FilenameWithoutExt>|<ExportName>\" src` (quick sanity check)
  - Action A (delete): `git rm <path>`
  - Action B (quarantine): `git mv <path> src/experiments/<path>` and add a short note in `src/experiments/README.md`

**Step 3: Current unused file list (from baseline)**

- `src/components/AccessibilityAnnouncer.tsx`
- `src/components/HighPerformanceSlider.tsx`
- `src/components/index.ts`
- `src/components/MigrationDialog.tsx`
- `src/components/MigrationDialogContainer.tsx`
- `src/components/MigrationDialogView.tsx`
- `src/components/SliderDemo.tsx`
- `src/components/SmoothSlider.tsx`
- `src/components/TimeLimitTest.tsx`
- `src/components/useMigrationDialog.ts`
- `src/hooks/useContainerWidth.ts`
- `src/hooks/useDarkMode.ts`
- `src/hooks/useLayoutOverflowDetection.ts`
- `src/hooks/useOptimisticUpdates.ts`
- `src/hooks/useScrollReveal.ts`
- `src/hooks/useThemeAnnouncer.ts`
- `src/services/BettingService.ts`
- `src/services/index.ts`
- `src/services/SessionService.ts`
- `src/services/UserSettingsService.ts`
- `src/types/browser.d.ts`
- `src/utils/animations.ts`
- `src/utils/compatibilityCheck.ts`
- `src/utils/consoleMigrationHelper.ts`
- `src/utils/debugRuleCreation.ts`
- `src/utils/deploymentValidator.ts`
- `src/utils/featureValidation.ts`
- `src/utils/renderOptimization.tsx`
- `src/utils/schemaOptimizer.ts`
- `src/utils/SearchErrorRecovery.ts`
- `src/utils/SearchIndex.ts`
- `src/utils/SearchStrategies.ts`
- `src/utils/theme.ts`
- `src/utils/timerConfig.ts`
- `src/components/chain-card/ChainCardDeleteDialog.tsx`
- `src/components/chain-card/useChainCardTimer.ts`
- `src/components/intro/IntroDiagrams.tsx`
- `src/components/pet/index.ts`
- `src/components/rsip/index.ts`
- `src/hooks/domains/index.ts`
- `src/services/duplication/DuplicationDetector.ts`
- `src/services/exception-rule-storage/types.ts`
- `src/services/integrity/IntegrityRules.ts`
- `src/utils/cache/index.ts`
- `src/utils/layout-stability/StabilityMetrics.ts`
- `src/utils/layout-stability/StabilityTypes.ts`
- `src/components/intro/diagrams/DiagramDelayMeme.tsx`
- `src/components/intro/diagrams/DiagramExamEfficiency.tsx`
- `src/components/intro/diagrams/DiagramIntegralPreference.tsx`
- `src/components/intro/diagrams/DiagramSacredSeat.tsx`
- `src/components/intro/diagrams/DiagramShortVideoLoop.tsx`
- `src/components/intro/diagrams/index.ts`
- `src/components/intro/diagrams/types.ts`
- `src/components/intro/diagrams/utils.tsx`
- `src/components/rsip/hooks/index.ts`
- `src/hooks/domains/sessions/index.ts`
- `src/components/intro/diagrams/shared/IconCheck.tsx`
- `src/components/intro/diagrams/shared/IconCross.tsx`
- `src/components/intro/diagrams/shared/index.ts`
- `src/components/intro/diagrams/shared/PlotPanel.tsx`

**Step 4: Verify after each batch**

- Run: `npm run typecheck`
- Expected: PASS
- Run: `npm test`
- Expected: PASS
- Run: `knip --config .knip.json --include files`
- Expected: unused file count decreases

---

### Task 5: Reduce unused exports (118 → small number) and fix duplicate exports (4 → 0)

**Files:**

- Modify: the modules reported by Knip/ts-prune (start with barrels like `src/services/index.ts`)

**Step 1: Fix duplicate exports first (low-risk)**

- Run: `knip --config .knip.json --include duplicates`
- Expected: 4 items:
  - `src/services/CheckinService.ts` (`CheckinService|default`)
  - `src/components/ToastViewport.tsx` (`ToastViewport|default`)
  - `src/components/DailyCheckin.tsx` (`DailyCheckin|default`)
  - `src/utils/iconMap.tsx` (`Icon|default`)
- Action: remove redundant `default` exports or rename to named exports consistently.

**Step 2: Convert “internal-only” exports to non-exports**

- Use `ts-prune -p tsconfig.app.json` output as the guide: if it’s “(used in module)”, remove `export` and keep it file-local.

**Step 3: Verify**

- Run: `npm run typecheck`
- Expected: PASS
- Run: `knip --config .knip.json --include exports`
- Expected: unused export count decreases

---

### Task 6: Standardize fire-and-forget async (reduce `sonarjs/void-use`)

**Files:**

- Create: `src/utils/fireAndForget.ts`
- Test: `src/utils/fireAndForget.test.ts`
- Modify: files reported with `sonarjs/void-use` in `tools/quality/reports/eslint-sonarjs.txt`

**Step 1: Add helper**

- Implement `fireAndForget(promise, { onError? })` that attaches `.catch()` and routes errors to existing logger (`src/utils/logger.ts`) to avoid unhandled rejections.

**Step 2: Add a unit test**

- Test that a rejected promise is handled (e.g., `onError` called).
- Run: `npm test`
- Expected: PASS

**Step 3: Replace usages**

- Replace `void someAsync()` with `fireAndForget(someAsync())`
- Run: `npx eslint -c eslint.sonar.config.js src`
- Expected: `sonarjs/void-use` count decreases materially

---

### Task 7: Remove nested ternaries (reduce `sonarjs/no-nested-conditional`)

**Files (start here):**

- Modify: `src/components/AccountModal.tsx`
- Modify: `src/components/BettingModalView.tsx`
- Modify: `src/components/RecycleBinModalView.tsx`
- Modify: `src/components/ImportUnitsModal.tsx`
- Modify: `src/components/ImportExportModalParts.tsx`
- Modify: `src/utils/notifications.ts`
- Modify: `src/utils/theme.ts`

**Step 1: Refactor each nested ternary into a named helper or if/else**

- For rendering logic: extract a small `renderXxx()` helper.
- For value derivation: extract a pure `getXxx()` function and unit-test it if it has branches.

**Step 2: Verify**

- Run: `npm run typecheck`
- Expected: PASS
- Run: `npm test`
- Expected: PASS
- Run: `npx eslint -c eslint.sonar.config.js src`
- Expected: `sonarjs/no-nested-conditional` count drops

---

### Task 8: Reduce cognitive complexity hotspots (reduce `sonarjs/cognitive-complexity` + `sonarjs/no-nested-functions`)

**Files (start here):**

- Modify: `src/app/viewUrlState.ts`
- Modify: `src/app/hooks/useAppDataLoad.ts`
- Modify: `src/app/hooks/usePeriodicCleanup.ts`
- Modify: `src/utils/errorMessage.ts`
- Modify: `src/utils/performanceMonitor.ts`
- Modify: `src/services/rule-manager/RuleExportImportService.ts`

**Step 1: Extract pure decision logic**

- Move complicated branching into small pure helpers that accept plain inputs and return plain outputs.

**Step 2: Add unit tests for the extracted helpers**

- Create adjacent unit tests under `src/**/__tests__/**` or `src/**/*.test.ts` (unit suite).
- Run: `npm run test:all`
- Expected: PASS

**Step 3: Verify SonarJS deltas**

- Run: `npx eslint -c eslint.sonar.config.js src`
- Expected: fewer `cognitive-complexity` and `no-nested-functions` hits

---

### Task 9: Fix “pseudo-random” warnings by using Web Crypto (reduce `sonarjs/pseudo-random`)

**Files:**

- Create: `src/utils/random.ts`
- Modify: `src/utils/toast.ts` (and any other file flagged by `sonarjs/pseudo-random`)
- Test: `src/utils/random.test.ts`

**Step 1: Add `randomId()`**

- Use `crypto.getRandomValues` (browser-safe) instead of `Math.random()`.

**Step 2: Replace usage sites**

- Update `src/utils/toast.ts` and any other flagged locations.

**Step 3: Verify**

- Run: `npm test`
- Expected: PASS
- Run: `npx eslint -c eslint.sonar.config.js src`
- Expected: `sonarjs/pseudo-random` count decreases

---

### Task 10: Reconcile depcheck “unused devDependencies” (avoid deleting real build chain deps)

**Files:**

- Modify (only if truly unused): `package.json`, `package-lock.json`
- Inspect: `postcss.config.js`, `tailwind.config.js`, `src/styles/**`

**Step 1: Confirm Tailwind/PostCSS pipeline usage**

- Check `postcss.config.js` and `tailwind.config.js` for actual usage.
- Run: `npm run build`
- Expected: PASS (this is the real signal, depcheck can be noisy here)

**Step 2: Only remove if proven unused**

- If removing, do one dep at a time and re-run `npm run build`.

---

### Task 11: Define a “done” gate (measurable improvements)

**Files:**

- Modify: none (gate is process + reports)

**Step 1: Run final full audit**

- Run: `powershell -ExecutionPolicy Bypass -File tools/quality/smell-audit.ps1`

**Step 2: Done criteria (target)**

- Knip: unused dependency `0`, unused devDependency `0`, duplicate exports `0`, unused files `<= 5` (only if intentionally quarantined), unused exports reduced by at least `70%`
- ESLint SonarJS: reduce errors by at least `50%` without turning rules off globally
- Tests: `npm test` + `npm run typecheck` + `npm run lint` all PASS
- Madge: still no cycles

---

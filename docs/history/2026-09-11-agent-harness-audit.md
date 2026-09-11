# Agent harness audit — 2026-09-11

Baseline: `d44707e`. Target: GPT-6 Astra / modern Codex.
This is a dated audit record, not an additional instruction source.

## Before

| Source                                                                 | Size / scope                                                                          | Problem                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `$CODEX_HOME/AGENTS.md`, `AGENTS.override.md`                          | Neither exists                                                                        | No user-owned global prose to migrate                                                                               |
| `$CODEX_HOME/config.toml`                                              | About 3.6 KB                                                                          | Already selects `gpt-6-astra` with extra high reasoning; no injected instructions or fallback instruction filenames |
| Global skills                                                          | 6 system and 34 cached plugin skill entry points                                      | Supplier-managed capabilities; no Momentum-specific personal skill                                                  |
| Root `AGENTS.md`                                                       | 213 lines / 9,791 bytes                                                               | Repeated scripts, types, architecture, testing and database handbook                                                |
| Root `CLAUDE.md`                                                       | 266 lines / 12,941 bytes                                                              | Second drifting handbook; nonexistent agent assignments; generic principles                                         |
| Nested/model-specific files                                            | No nested AGENTS/overrides, repository skills, or other model instruction files found | No subtree needing a separate harness                                                                               |
| Contributor/architecture docs                                          | 117 / 418 lines                                                                       | Duplicated commands; mandatory campaign template; outdated lifecycle and file-size targets                          |
| README pair, docs index, testing/schema/deployment guides, dated plans | Read and cross-checked against source/config                                          | Mislabelled test suite, Node mismatch, stale RPC signatures, missing QA SQL links, unavailable skill requirements   |
| Executable harness                                                     | 60 npm scripts, 39 quality-tool files, 6 workflows, lint/test/mutation configs        | Overlapping analyzers, repeated CI scans, shape budgets, tests freezing the harness roster                          |

No ancestor instruction file was found. Repository `.codex`, `.claude`,
`.cursor`, `.augment`, `.serena`, and `.agents` directories are absent.
Global skill entry points were inspected for scope and instruction/approval
triggers; cached package versions are not all active in a task. No supplier
cache, authentication state, permissions, or global settings were modified.

Architecture, commands, type catalogs, lifecycle, testing and database policy
were repeated across AGENTS, CLAUDE, CONTRIBUTING and architecture docs.
Conflicts included:

- CLAUDE said UI cannot use storage, then told it to use storage hooks.
- Lifecycle guidance named AppShellContainer; the owner is `useServiceLifecycle`.
- Both handbooks called `npm test` a smoke subset, although it already selected
  the unit suite. Its config was nearly a copy of `vitest.config.ts`.
- CLAUDE's coverage and duplication thresholds disagreed with executable values.
- Deployment docs said Node 18; `.nvmrc` and Netlify specify 20.19.0.
- Plans required unavailable `superpowers` skills; CLAUDE mandated agents that
  were never configured.
- File/import-count tests froze particular containers and compatibility facades.

## New hierarchy

1. **Global Codex environment:** cross-project preferences and model/tool settings.
   Existing configuration remains unchanged. No global AGENTS was created merely
   to relocate generic advice or duplicate host-provided autonomy/style rules.
2. **[AGENTS.md](../../AGENTS.md):** 60 lines / 3,288 bytes, a task-oriented map
   and five non-obvious boundary notes. Explicit task intent takes precedence
   over ordinary project guidance.
3. **[CLAUDE.md](../../CLAUDE.md):** 3 lines / 97 bytes, pointing to AGENTS.
   Both agents share the same repository guidance.
4. **Canonical knowledge:** [architecture](../guides/ARCHITECTURE.md) owns storage,
   lifecycle and platform design; [testing](../guides/TESTING_GUIDE.md) owns suites,
   fixtures and CI; [migration guide](../guides/apply-migration.md) owns persistence
   changes; [schema](../api/DATABASE_SCHEMA.md) describes the database; existing
   domain docs remain indexed in [docs/README.md](../README.md).
   [CONTRIBUTING.md](../../CONTRIBUTING.md) owns development entry points, and
   [deployment](../guides/DEPLOYMENT.md) owns release procedures.
5. **Executable policy:** package/config files, migrations, lint, architecture
   checks and behavior tests. No nested instructions were needed.

Root AGENTS bytes fell about 66%; the two agent files together fell about 85%.
Architecture went from 418 to 95 lines. No new skills, roles, management tooling,
or Markdown governance tests were added. The only new document is this report.

## Instruction disposition

A = global preference; B = project invariant; C = repository knowledge;
D = executable policy; E = generic knowledge; F = historical sediment.
Repeated instructions are grouped by meaning, covering both old agent files.

| Existing guidance                                                        | Class | Disposition / owner                                                                   |
| ------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------- |
| Autonomy, questions, communication, universal git/delegation preferences | A     | Global/host layer; no Momentum rules transplanted there                               |
| Build/dev/install/preview and full npm command catalog                   | C     | Package scripts and CONTRIBUTING; root retains useful entry points                    |
| Stack, versions, license, directory/service/hook catalogs                | C     | Package manifests, LICENSE, architecture and domain docs                              |
| UI/domain/storage layering and public ports                              | B/D   | Short root note; explanation in architecture; import enforcement retained             |
| View/container split and domain-hook/service organization                | C     | Architecture, without a file-length target or required wrapper hierarchy              |
| Local and Supabase implementations; storage mode identification          | B/C   | Root compatibility note; architecture explains modes and capabilities                 |
| Chain union, variants, ChainDraft and branching advice                   | C/E   | Types and architecture; deleted TypeScript micromanagement                            |
| Timer/cache/rule/monitor service lifecycle                               | C/F   | Corrected to actual lifecycle hook; removed stale startup example                     |
| SystemRuntime and MigrationCoordinator examples                          | C     | Architecture points to actual integration sites                                       |
| Tauri detection, lazy APIs, backend commands and PWA behavior            | B/C   | Root browser/native compatibility note; architecture/deployment details               |
| `as any`, `console.*`, unused variables, a11y and React rules            | D     | ESLint owns these; no second prose rulebook                                           |
| Cognitive complexity 15                                                  | D/F   | Existing ESLint warning remains; deleted prose treating it as a hard limit            |
| `env`, `logger`, `toast`, error normalization, Result helpers            | C     | One architecture pointer to utilities and callers                                     |
| KISS/YAGNI/DRY/SOLID, naming tables, minimal comments, fix-errors-first  | E     | Deleted rather than moved into global context                                         |
| Unit/integration/performance discovery and watch commands                | C/F   | Testing guide and configs; corrected false smoke-suite description                    |
| JSDOM storage, MSW handlers, timer setup                                 | C     | Testing guide explains the actual harness                                             |
| SUT mocks, composition mocks, assertion quality                          | C/D   | Concise test-boundary explanation; ESLint/assertion analyzer enforce supported cases  |
| Storage contract changes need both adapters and tests                    | B/C   | Architecture and migration guide; TypeScript checks contracts                         |
| New migrations, user-scoped RLS, authenticated SECURITY DEFINER calls    | B     | Short root exception; detailed operational guidance in migration guide                |
| RPC overloads, named parameters and mapper/schema/type synchronization   | B/C   | Root warning plus migration guide; copied signature tables replaced with source links |
| Older-schema fallbacks                                                   | B     | Root note because removing them can break existing installations                      |
| CLI type generation and migration application recipes                    | C/F   | Reviewed type-file workflow; corrected CLI description; removed obsolete repair SQL   |
| Cast/clone/file-count budgets and copied coverage thresholds             | D/F   | Shape budgets deleted; behavioral coverage thresholds stay in config                  |
| Mandatory review/performance agents and plan execution skills            | F     | Removed; dated plans no longer impose agent workflows                                 |
| Universal 300-line and 12-import caps; exact facade roster/removal dates | F     | Removed shape tests; retained real dependency-boundary tests                          |
| Campaign PR template and required historical pre-reading                 | F     | Removed; dated reports remain available as background                                 |

## Executable harness changes

| Mechanism                                                                        | Decision and independent value                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Knip / ts-prune / depcheck                                                       | Knip is the single unused-file/export/dependency check and now runs in required CI. Removed the other dependencies/configs/wrapper. Both old detectors identified the same unreachable RSIP cluster; removed those three unreferenced source files. |
| Madge / Dependency Cruiser                                                       | Added cycle detection to the existing architecture gate; removed Madge/config/report wrappers. A real circular-import fixture proves nonzero exit. Existing storage boundary rules remain.                                                          |
| File, import, comment and regex-cast budgets                                     | Deleted scripts/baselines and related shape tests. These measured layout or syntax totals rather than behavior, encouraging splitting and facade creation.                                                                                          |
| Test lint plus custom warning budget                                             | One ESLint invocation uses the existing 20-warning allowance. Conditional assertions remain lint errors. Deleted the second lint run, parser and baseline.                                                                                          |
| Full SonarJS and JSCPD                                                           | Retained as informational diagnostics; Sonar config reuses production ESLint config. Removed these from required CI and removed strict aggregate clone counts.                                                                                      |
| Unit test configs                                                                | Deleted duplicate `vitest.ci.config.ts`; npm test/test:all, watch commands, mutation and runtime tooling use `vitest.config.ts`. Kept the helper-file exclusion.                                                                                    |
| Critical/broad mutation                                                          | Preserved scope and score requirements; both run in the scheduled/on-demand lane. Removed critical mutation from per-PR required CI. Failures remain visible.                                                                                       |
| Coverage, report freshness and mutation scope checks                             | Retained: they connect reports to the measured revision/configuration and detect stale evidence or dropped mutation scope. They do not require every local edit to regenerate reports.                                                              |
| Test assertion analyzer                                                          | Retained: direct SUT replacements and tautologies are distinct from ordinary test lint. Its behavior tests remain.                                                                                                                                  |
| CSS structure and i18n checks                                                    | Retained: cross-file style hazards and translation consistency provide project-specific signals beyond basic formatting.                                                                                                                            |
| Type coverage, compiler, production/test lint, formatting, spell/Markdown checks | Retained. Markdown lint now includes root instruction and contributor files through its normal glob.                                                                                                                                                |
| Rust checks and web build                                                        | Retained in required CI; native release workflow and permission/signing configuration unchanged.                                                                                                                                                    |
| Semgrep / CodeQL / Gitleaks / npm audit / SQLFluff                               | Retained; Semgrep's duplicate auto scans were removed from aggregate lanes because its dedicated workflow already owns them. Removed redundant Python setup from mutation CI.                                                                       |
| Lane runners                                                                     | Kept the existing reporting runner; deleted its unused duplicate entry point and the structural-budget lane. Info/smell diagnostics no longer repeat required test checks or consume absent coverage artifacts.                                     |
| Runtime timing report                                                            | Retained as an informational diagnostic, not a required PR gate.                                                                                                                                                                                    |

Scripts fell from 60 to 50; quality-tool files from 39 to 28; required commands
from 24 to 18. Removing three direct development dependencies eliminated 123
lockfile entries without changing any retained package version.

## Remaining permanent exceptions

The brief root notes protect boundaries that are easy to miss during a local
change: public storage ports, two supported persistence modes, local-only pet
data, delayed database migrations, RPC/RLS authorization, and browser-safe native
integration. Their consequences justify a reminder even where checks cover part
of the boundary. SQL authorization and old-schema behavior are not proven by
TypeScript or MSW tests. Other architectural details are discovered on demand.

## Six task dry runs

All Codex scenarios load the same 60-line project file, with no global Markdown
or nested override. Claude additionally reads its three-line pointer.
These are navigation/constraint dry runs, not six claimed implementation tests.

| Task                          | Discoverable context                                         | Proportional verification / hidden risk addressed                             |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Small React bug               | Component, architecture only if needed                       | Targeted UI test/type/lint; storage port note prevents adapter imports        |
| Supabase persistence change   | Migration guide, schema, table module, MSW harness           | Both adapters/compatibility path; SQL authorization needs database validation |
| Domain feature                | Feature index, domain types/hooks                            | Relevant behavior tests; no forced service or file split                      |
| Tauri feature                 | Architecture platform section, deployment, Rust capabilities | Adapter/native checks and browser build where shared; PWA exception visible   |
| Dead/duplicated-code refactor | Knip, import graph, callers                                  | Relevant behavior tests and architecture gate; no clone quota/facade roster   |
| Documentation update          | CONTRIBUTING and affected canonical doc                      | Formatting, Markdown and links; no local application/mutation requirement     |

Root navigation does not require reading every linked document. Historical plans
are labelled as such. No model-specific team or confirmation workflow remains.

## Verification and limits

- Passed: typecheck, production lint, test lint, Knip, architecture gate,
  assertion analyzer, web build, Markdown lint, changed-document spelling,
  changed-file formatting, local Markdown link checks, and `git diff --check`.
- Harness-focused run: 17 tests passed, including actual forbidden-import and
  cycle failures, report freshness, runner exit behavior and mutation scope.
- Full unit suite: 1,914 passed, one failed. The failure at line 75 of
  [useRSIPViewCreationActions.domain-chain.test.ts](../../src/components/rsip/hooks/__tests__/useRSIPViewCreationActions.domain-chain.test.ts)
  expects rejection from an atomic creation path. The same test fails on an
  untouched checkout of the baseline commit.
- Critical mutation: 97.15%, 239 killed / 7 survived / 0 uncovered; below the
  existing 100% threshold. An untouched baseline checkout produced the same
  score and counts. Thresholds and product behavior were not changed to hide it.
- Diagnostic lane completed and recorded one advisory SonarJS `void-use`
  finding in `useRSIPReparent.ts`; diagnostics are not falsely reported as clean.
- Full coverage, broad nightly mutation, Rust/native builds, external security
  scanners, live database validation and remote CI were not rerun. This change
  does not establish that the entire CI pipeline is green.
- Global Codex configuration and supplier-managed skills were audited, not
  rewritten. There was no user-owned global handbook to shrink.

The instruction-discovery decisions follow
[Codex's documented global/project loading rules](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
The focus on conflicting directives and proportional verification matches
[OpenAI's Astra guidance](https://developers.openai.com/api/docs/guides/latest-model).

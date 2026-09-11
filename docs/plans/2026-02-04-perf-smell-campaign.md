# Momentum 性能 + 坏味道优化战役计划（静态分析驱动，2–4 周）

Historical plan; current development guidance is in [CONTRIBUTING.md](../../CONTRIBUTING.md).

> 本文目标：用现有“静态分析 + 报告产物”工具链，把性能优化与屎山/坏味道治理变成可量化、可回归、可分 PR 推进的工程战役。
>
> 约束：
>
> - 保持“本地少阻塞”：不引入 pre-commit hooks；所有动作通过显式 `npm run ...` 命令。
> - CI 现有 Hard gate（lint/typecheck/tests/type-coverage）保持不变；新增 Lighthouse/DevTools 仅做“基线与复测”，不做门禁。

---

## 1. 摘要

本战役分两条线并行推进：

- **性能**：首屏/包体（Lighthouse + `stats.html`）+ 关键交互（DevTools trace + 现有 performance tests）双线推进。
- **坏味道**：Knip / ts-prune / depcheck / SonarJS / Madge / JSCPD 联合驱动，先清低风险，再解结构性问题（循环依赖、重复代码、复杂度热点）。

---

## 2. 成功标准（验收口径固定）

### 2.1 性能（对用户体感最敏感）

**Web Vitals / Lighthouse（中位数）**

- Desktop + Mobile 各跑 3 次取中位数。
- 关注：Performance 分数、FCP/LCP/TBT/CLS（具体记录方法见附录 A）。
- 目标（先保底不回退，再逐步抬高）：
  - Performance：不低于基线 -3 分；第 4 周争取提升 +3~+8（视基线而定）
  - TBT：不回退（若当前偏高，优先把 >200ms 的长任务打掉）
  - CLS：维持接近 0

**关键交互（DevTools trace）**

- 场景脚本固定（见附录 B），每次相关 PR 必须复测并给出差异摘要（LCPBreakdown / Main-thread long tasks / React commit 频率等）。

**现有性能测试套件**

- `npm run test:performance` 必须通过。
- 新增性能断言尽量避免“墙钟时间硬阈值”，优先断言复杂度/候选集合大小/缓存命中等稳定信号。

### 2.2 坏味道（工具输出为准）

以 `npm run quality:smell-audit`（输出 `reports/quality/`）为主口径：

- **Madge**：`reports/quality/madge-circular.json` 的 `circularCount = 0`（若当前非 0，则先保证“不新增”，第 3 周清零）。
- **Knip**：unused files 接近 0（允许 ≤5 个“明确标注隔离/实验”）；unused exports 相比基线下降 ≥70%。
- **SonarJS**：`reports/quality/eslint-sonarjs.json` 的 message 总量下降 ≥50%，且不靠全局关规则。
- **JSCPD**：top duplicates（按 tokens/lines）清掉大头，重复块显著下降。

---

## 3. 固定工作流（每个 PR 都按这个做）

### 3.1 PR 模板（必须包含）

1. 本 PR 解决的“热点项”（来自哪个报告：SonarJS/Madge/Knip/JSCPD/Lighthouse/DevTools）
2. **优化前后对比**（至少一个量化对比）
3. 风险评估 + 回滚策略（如何确认行为不变）

### 3.2 PR 验证命令（最小集）

- `npm run lint`
- `npm run typecheck`
- `npm test`

**触及性能关键路径时追加**

- `npm run test:performance`
- Lighthouse 基线复测（附录 A）
- DevTools trace 采集（附录 B）

---

## 3.3 当前进度（✅=已验证）

- [x] PR#1：建立基线与热点清单 ✅（Baseline：smell-audit + stats + Lighthouse + DevTools trace）
- [x] PR#2：生产环境避免“日志参数求值开销” ✅
- [x] PR#3：Knip/ts-prune 驱动清理 ✅（工具噪音已降：`depcheck` rc 生效、`quality:smell-audit` 支持无 `pwsh`、Knip clean；`ts-prune` 先 ignore `index.ts(x)` 消除 barrel 误报；ts-prune 输出：39 → 23 → 0）
- [x] PR#4：构建/包体快速修复 ✅（Auth 后再懒加载 AppShellContainer；首包 `index-*.js` gzip：74.90KB → 43.10KB）
- [x] PR#5：引入 `chainsRevision` ✅
- [x] PR#6：`memoizedBuildChainTree(chains, revision)` revision 主缓存键 ✅
- [x] PR#7：`RuleSearchOptimizer` 候选集索引 + cacheKey 修正 ✅
- [x] PR#8：Madge 循环依赖清零（`circularCount = 0`）✅
- [x] PR#9：JSCPD top duplicates 专项 ✅（clones：19 → 8；duplicated lines：287(0.56%) → 123(0.24%)）
- [x] PR#10：SonarJS 复杂度热点清理（当前 `messages = 0`）✅
- [x] PR#11：收尾固化 ✅（更新对比表格；CI soft 报告：可选）

## 4. 分阶段路线（2–4 周，拆成小 PR）

> 每个 PR 尽量“小且可回滚”，优先用“提纯纯函数 + 单测 + 替换调用点”的方式，避免大范围一次性重构。

### Phase 0（第 0–1 天）：建立基线与热点清单（PR#1）

**目标**：把“优化前长什么样”固定下来，后续所有改动都能对比。

产出（必须落文档）：

- Baseline 表格：commit hash、Node/npm 版本、运行环境（CPU/内存）、以及：
  - `quality:smell-audit` 摘要（Top rules、循环依赖、Knip/ts-prune 统计）
  - `stats.html` 的 Top chunks/modules 摘要（只记前 10）
  - Lighthouse（Desktop/Mobile：Performance/A11y/BP/SEO + FCP/LCP/TBT/CLS 中位数）
  - DevTools trace：关键 3 场景的摘要指标（见附录 B）

#### Baseline（2026-02-04）

> 基线口径：以当前工作区 `HEAD` 为准；后续 PR 以此对比（尤其是 PR#4 的包体/首屏与 PR#11 的收尾对比表格）。

**环境**

| 项         | 值                                                    |
| ---------- | ----------------------------------------------------- |
| Commit     | `e1d6f99c7211ab6ad810b04fa754de8ce952bd2c`            |
| Node / npm | `v22.16.0` / `11.5.2`                                 |
| OS         | Windows 11 家庭中文版 10.0.26200 (64 位)              |
| CPU        | Intel(R) Core(TM) Ultra 9 285H (cores=16, logical=16) |
| RAM        | 31.4 GB                                               |

**坏味道（工具输出）**

| 工具     | 指标                      |     Baseline 值 | 产物/备注                                                          |
| -------- | ------------------------- | --------------: | ------------------------------------------------------------------ |
| Madge    | circular deps             |               0 | `reports/quality/madge-circular.json`                              |
| Knip     | unused deps/exports/files |               0 | `npm run quality:knip`（exit 0）                                   |
| ts-prune | unused exports            |               0 | `npm run quality:ts-prune`（no output）                            |
| depcheck | unused/missing deps       |               0 | `npm run quality:depcheck`（No depcheck issue）                    |
| SonarJS  | messages                  |               0 | `reports/quality/eslint-sonarjs.json`（`files: 347, messages: 0`） |
| JSCPD    | clones / duplicated lines | 8 / 123 (0.24%) | `reports/jscpd/jscpd-report.json`                                  |

**包体（Top 10 assets by gzip，来自 `npm run build` + dist 复算 gzip/br；`stats.html` 见仓库根目录）**

| 文件                                   | Raw KB | gzip KB | br KB |
| -------------------------------------- | -----: | ------: | ----: |
| `assets/index-DVOhyvo8.js`             | 269.20 |   74.90 | 60.84 |
| `assets/vendor-react-VlY-ZC0_.js`      | 138.29 |   44.42 | 38.81 |
| `assets/vendor-supabase-FPiA6NE9.js`   | 163.54 |   42.30 | 36.24 |
| `assets/RSIPView-BY9J1IyQ.js`          |  71.07 |   22.62 | 19.30 |
| `assets/FocusMode-B_N9AV2F.js`         |  73.07 |   21.62 | 18.21 |
| `assets/index-Db7rMfIg.css`            | 132.96 |   20.24 | 15.51 |
| `assets/supabaseStorage-OgcQUV5f.js`   |  34.86 |    9.36 |  8.37 |
| `assets/ImportExportModal-Bn0OW-f1.js` |  24.09 |    7.60 |  6.44 |
| `assets/vendor-icons-B-9L-tV-.js`      |  20.67 |    7.44 |  6.33 |
| `assets/ChainEditor-CZDpOSxJ.js`       |  25.48 |    6.64 |  5.48 |

**Lighthouse（基线：各跑 3 次取中位数；报告在 `reports/lighthouse/`）**

- Lighthouse `12.8.2`；UA：HeadlessChrome `144.0.0.0`

| 模式    | Perf/A11y/BP/SEO（中位数） | FCP / LCP / TBT / CLS（中位数） |
| ------- | -------------------------- | ------------------------------- |
| Desktop | 100 / 94 / 100 / 100       | 449ms / 533ms / 0ms / 0         |
| Mobile  | 95 / 94 / 100 / 100        | 2194ms / 2583ms / 0ms / 0       |

报告文件：

- `reports/lighthouse/2026-02-04_desktop_run1.json`
- `reports/lighthouse/2026-02-04_desktop_run2.json`
- `reports/lighthouse/2026-02-04_desktop_run3.json`
- `reports/lighthouse/2026-02-04_mobile_run1.json`
- `reports/lighthouse/2026-02-04_mobile_run2.json`
- `reports/lighthouse/2026-02-04_mobile_run3.json`

**DevTools trace（已采集 ✅，见附录 B）**

> 采集备注（Codex DevTools MCP）：
>
> - 为避免 Supabase 登录阻塞：采集时使用 local-storage 模式（临时启用 `.env.local`，清空 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）；采集完成后已改名为 `.env.local.disabled`。
> - PWA Service Worker 可能导致 stale assets：采集前先 unregister + 清 caches，并用 `ignoreCache: true` reload。
> - `performance_stop_trace` 默认保存到 VS Code 安装目录，需要 `Move-Item` 到 `reports/devtools/traces/`（MCP 当前不支持直接落到仓库目录）。

- [x] `cold_start`：`reports/devtools/traces/2026-02-04_cold_start.json.gz`
- [x] `tree_build`：`reports/devtools/traces/2026-02-04_tree_build.json.gz`
- [x] `rule_search`：`reports/devtools/traces/2026-02-04_rule_search.json.gz`

摘要（Baseline，2026-02-04；local-storage mode + 固定 seed）：

- `cold_start`
  - LCP：286.9ms（TTFB 7.4ms；render delay 279.5ms；LCP element：`P.text-gray-700 ... font-chinese`）
  - Main-thread long tasks（Top 3 RunTask）：60.7ms（Layout 54.8ms）/ 28.3ms（Layout 23.6ms）/ 25.7ms（v8.evaluateModule 24.3ms）
  - Script hotspots（Top 3 by total time）：`vendor-react-VlY-ZC0_.js` 78.6ms / `index-BYFe-CsB.js` 9.4ms / `registerSW.js` 0.8ms
- `tree_build`
  - Main-thread long tasks（Top 3 RunTask）：1191.5ms（UpdateLayoutTree 662.7ms）/ 504.3ms（未被细分事件覆盖）/ 325.5ms（Layerize 168.9ms）
  - Script hotspots（Top 3 by total time）：`vendor-react-VlY-ZC0_.js` 408.1ms / `index-BYFe-CsB.js` 16.5ms / `GroupView-CiDe3_pk.js` 0.4ms
- `rule_search`（2000 条 chain-scoped pause rules；query=`Rule 1999`）
  - Main-thread long tasks（Top 3 RunTask）：48.0ms（v8.callFunction 47.6ms）/ 42.5ms（LatencyInfo.Flow 42.0ms）/ 42.4ms（MajorGC 42.4ms）
  - Script hotspots（Top 3 by total time）：`vendor-react-VlY-ZC0_.js` 515.0ms / `FocusMode-D92FVa7M.js` 41.8ms / `app-utils-BlAh7-Ou.js` 29.0ms

PR#1 checklist：

- [x] `quality:smell-audit` 摘要（Knip/ts-prune/depcheck/Madge/SonarJS）
- [x] `stats.html` / dist Top chunks（Top 10）
- [x] Lighthouse（Desktop/Mobile 各 3 次取中位数）
- [x] DevTools trace（3 场景）

### Phase 1（第 1 周）：低风险高收益（PR#2–#4）

**PR#2：P0 修复——生产环境避免“日志参数求值开销”**

- 背景：即使 dev-only logger 不输出，参数仍会先构造（如 `chains.map(...)`），造成无意义 O(n)。
- 方案：为 `performanceLogger` 增加 `debugLazy/infoLazy`（回调形式），`group` 在 prod 下不执行回调；并把 `chainTree/queryOptimizer` 等热路径里的“大对象日志”改为 lazy 或 `if (isDev)` 包裹。
- 验收：功能不变；相关性能场景的 trace 中长任务/脚本时间不回退。

**PR#3：Knip/ts-prune 驱动清理（小步多 PR）**

- 先消除工具噪音（如 Knip 的 unlisted binaries / 脚本环境差异），再做删除/隔离。
- 每个 PR 只处理 10–20 个 unused exports/files，优先删除，其次隔离到 `tools/experiments/`。
- 验收：Knip/ts-prune 指标下降，测试不回归。
- 当前（2026-02-04）：`quality:smell-audit` 中 Knip/ts-prune/depcheck 均为 0 ✅

**PR#4：构建/包体快速修复 ✅（2026-02-04）**

- 实施：把 `AppShellContainer` 移出 entry，改为 Auth 通过后再 `React.lazy` 加载（明确“未登录首屏 vs 登录后 App”边界）：
  - `src/AppShell.tsx`：`AuthWrapper` 外层包裹 + `Suspense` fallback + `lazy(() => import('./app/AppShellContainer'))`
  - `src/app/AppShellView.tsx`：移除内部 `AuthWrapper`（避免嵌套，保持边界清晰）
  - `src/app/AppShellContainer.tsx`：data load gating 仅依赖 `isInitialized`（Auth 由外层负责）
  - `src/__tests__/AppShell.lazy-boundary.test.ts`：防回归（`AppShell` 不再直接 re-export `AppShellContainer`）
- 包体对比（dist 复算 gzip/br；基线见上方 PR#1 的 Top assets 表格）：
  - `assets/index-*.js` gzip：74.90KB → 43.10KB（-31.80KB）
  - 新增 `assets/AppShellContainer-*.js` gzip：33.43KB（Auth 通过后才请求；`dist/index.html` 无 modulepreload）
- Lighthouse（各跑 3 次取中位数；报告在 `reports/lighthouse/`）：
  - Desktop：Perf/A11y/BP/SEO 100/94/100/100（不回退）；FCP/LCP/TBT/CLS：449/533/0/0 → 429/532/0/0
  - Mobile：Perf 95 → 96；FCP/LCP：2194/2583 → 1969/2427；TBT/CLS：0/0（不回退）
  - 报告文件：
    - `reports/lighthouse/2026-02-04_pr4_desktop_run1.json`
    - `reports/lighthouse/2026-02-04_pr4_desktop_run2.json`
    - `reports/lighthouse/2026-02-04_pr4_desktop_run3.json`
    - `reports/lighthouse/2026-02-04_pr4_mobile_run1.json`
    - `reports/lighthouse/2026-02-04_pr4_mobile_run2.json`
    - `reports/lighthouse/2026-02-04_pr4_mobile_run3.json`

### Phase 2（第 2 周）：结构性性能（PR#5–#7）

**PR#5：引入 `chainsRevision`（性能接口小改动，收益明确）**

- `AppState` 增加 `chainsRevision: number`，任何更新 `chains` 的 `setState` 必须 `+1`。
- 验收：调用点统一完成；单测通过。

**PR#6：升级 `queryOptimizer.memoizedBuildChainTree(chains, revision)`**

- 用 revision 作为主缓存键，避免对 `chains` 做 `sort().join()` 大字符串 hash（hash 仅用于 debug 或诊断）。
- 验收：新增单测覆盖“revision 不变不重建；变更必重建”；性能 trace 中树构建长任务减少。

**PR#7：`RuleSearchOptimizer` 索引真正用起来 + cacheKey 修正**

- 现状：构建了 `searchIndex` 但仍全量遍历；cacheKey 仅用 rules.length 易误缓存。
- 方案：先用 query 的 name/pinyin/首字母命中候选集合，再打分排序；cacheKey 用规则 revision 或稳定 hash。
- 细节：避免在 UI 层每次 `searchQuery` 变化都强制 rebuild index（会导致 cacheKey 抖动、缓存形同虚设）；让 `searchRules` 内部 `ensureIndexUpToDate` 在 rules 变更时触发更新即可。
- 验收：性能测试（rule-system-performance 等）不回退；搜索结果一致性不变。

### Phase 3（第 3–4 周）：屎山热点清零（PR#8–#11）

**PR#8：Madge 循环依赖清零（每个 cycle 单独 PR）**

- 策略：抽纯函数/类型下沉/反转依赖；禁止“用 barrel 假装解决”。
- 验收：`circularCount = 0`。

**PR#9：JSCPD top duplicates 专项**

- 先清最大块：抽公共 helper/组件片段；避免引入新的耦合导致循环依赖。
- 验收：top duplicates 明显下降，回归测试通过。

**PR#10：SonarJS 复杂度热点提纯（纯函数 + 单测）**

- 从 `eslint-sonarjs.json` 按“文件×规则计数”挑 Top 5。
- 每个热点拆为：纯决策函数 + 单测 + UI 组装层简化。
- 验收：SonarJS messages 相比基线下降 ≥50%。

**PR#11：收尾固化**

- 更新本计划文档的对比表格，记录最终指标。
- 如有必要：把“不得回退”的最稳定信号写成 CI soft 报告（仅 artifact/日志，不阻塞）。

#### 最终对比（Baseline → PR#4 → PR#11）

> 口径：
>
> - Lighthouse：Desktop/Mobile 各跑 3 次取中位数（见 `reports/lighthouse/`）
> - Bundle：`dist/assets` 复算 gzip/br（gzip level=9；br q=11）
> - DevTools trace：local-storage mode + 固定 seed（见下方 trace 文件）

| 项                                              |          Baseline（PR#1） |                      PR#4 |                     PR#11 |
| ----------------------------------------------- | ------------------------: | ------------------------: | ------------------------: |
| `index-*.js` gzip                               |                  74.90 KB |                  43.10 KB |                  43.10 KB |
| `AppShellContainer-*.js` gzip                   |                         — |                  33.43 KB |                  33.43 KB |
| Lighthouse Desktop（Perf/A11y/BP/SEO）          |      100 / 94 / 100 / 100 |      100 / 94 / 100 / 100 |      100 / 94 / 100 / 100 |
| Lighthouse Desktop（FCP/LCP/TBT/CLS）           |   449ms / 533ms / 0ms / 0 |   429ms / 532ms / 0ms / 0 |   429ms / 534ms / 0ms / 0 |
| Lighthouse Mobile（Perf/A11y/BP/SEO）           |       95 / 94 / 100 / 100 |       96 / 94 / 100 / 100 |       96 / 94 / 100 / 100 |
| Lighthouse Mobile（FCP/LCP/TBT/CLS）            | 2194ms / 2583ms / 0ms / 0 | 1969ms / 2427ms / 0ms / 0 | 1969ms / 2433ms / 0ms / 0 |
| DevTools `cold_start` LCP（local）              |                   286.9ms |                         — |                   437.0ms |
| DevTools `tree_build` longest RunTask（local）  |                  1191.5ms |                         — |                   894.4ms |
| DevTools `rule_search` longest RunTask（local） |                    48.0ms |                         — |                    75.7ms |

PR#11 Lighthouse（2026-02-05；各跑 3 次取中位数）：

- Desktop：`reports/lighthouse/2026-02-05_pr11_desktop_run{1..3}.json`
- Mobile：`reports/lighthouse/2026-02-05_pr11_mobile_run{1..3}.json`

PR#11 DevTools traces（local-storage mode）：

- `cold_start`：`reports/devtools/traces/2026-02-04_pr11_cold_start.json.gz`
  - LCP：437.0ms（TTFB 13.1ms；render delay 424.0ms；LCP element：`P.text-gray-700 ... font-chinese`）
  - Main-thread long tasks（Top 3 RunTask）：43.0ms（FireIdleCallback 42.9ms）/ 40.7ms（Layout 31.1ms）/ 40.4ms（v8.evaluateModule 36.8ms）
  - Script hotspots（Top 3 by total time）：`vendor-react-VlY-ZC0_.js` 129.8ms / `AppShellContainer-Dt7MLzB9.js` 19.0ms / `index-BujRuR8v.js` 2.4ms
- `tree_build`：`reports/devtools/traces/2026-02-04_pr11_tree_build.json.gz`
  - Main-thread long tasks（Top 3 RunTask）：894.4ms（UpdateLayoutTree 631.3ms）/ 368.5ms（Commit 140.9ms）/ 361.4ms（未被细分事件覆盖）
  - Script hotspots（Top 3 by total time）：`vendor-react-VlY-ZC0_.js` 337.4ms / `AppShellContainer-Dt7MLzB9.js` 12.0ms / `GroupView-gLLSgX53.js` 0.4ms
- `rule_search`：`reports/devtools/traces/2026-02-04_pr11_rule_search.json.gz`
  - Main-thread long tasks（Top 3 RunTask）：75.7ms（PrePaint 25.7ms）/ 59.0ms（TimerFire 58.9ms）/ 47.6ms（LatencyInfo.Flow 47.4ms）
  - Script hotspots（Top 3 by total time）：`vendor-react-VlY-ZC0_.js` 432.4ms / `FocusMode-BXR6IQWE.js` 154.8ms / `AppShellContainer-Dt7MLzB9.js` 0.3ms

---

## 5. 产物与归档规则（避免仓库变脏）

- `reports/quality/`：由脚本生成，保持 `.gitignore` 忽略。
- `stats.html`：由 build 生成，忽略。
- Lighthouse 原始 JSON：写到 `reports/lighthouse/` 并忽略（见附录 A）。
- DevTools traces：写到 `reports/devtools/` 并忽略（见附录 B）。
- 文档里只记录“摘要表格 + commit hash + 复现实验命令”。

---

## 附录 A：Lighthouse / PageSpeed 基线与复测协议（仅基线+复测，不做门禁）

**运行目标**：对 production build 的 `vite preview` 跑 Lighthouse，Desktop+Mobile 各 3 次取中位数。

**固定命令**

1. 启动：

- `npm run build`
- `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`

2. Desktop（示例 run1；run2/run3 改文件名）：

- `npx lighthouse http://127.0.0.1:4173/ --preset=desktop --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=reports/lighthouse/YYYY-MM-DD_desktop_run1.json --chrome-flags="--headless=new"`

3. Mobile：

- `npx lighthouse http://127.0.0.1:4173/ --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=reports/lighthouse/YYYY-MM-DD_mobile_run1.json --chrome-flags="--headless=new"`

**记录格式（写入计划文档的表格）**

- Desktop/Mobile：Performance/A11y/BP/SEO
- metrics：FCP/LCP/TBT/CLS
- 环境：Node、Chrome/Lighthouse 版本、URL、fetchTime

---

## 附录 B：DevTools MCP（Runbook + Codex 自动采集）

### B1. 当时使用的复测场景

1. **冷启动首屏**：`/` Dashboard 首次加载
2. **树构建路径**：进入 GroupView 或 ChainDetail（触发 `memoizedBuildChainTree`）
3. **规则搜索交互**：打开规则选择/搜索（触发 RuleSearchOptimizer）

### B2. 自动采集示例（历史 MCP 接口）

**输入**：URL（优先 `http://127.0.0.1:4173/`），场景名（cold_start / tree_build / rule_search）

**输出**：`reports/devtools/traces/YYYY-MM-DD_<scenario>.json.gz`（trace）+ 文档里一段摘要：

- LCP 时间 & LCPBreakdown（若可得）
- 主线程 long tasks（Top 3）
- 脚本执行热点（Top functions/frames）

**采集步骤（工具级别）**

- 新建/选择页面 → 导航到 URL
- `performance_start_trace`（建议 `reload: true` 用于冷启动；交互场景 `reload: false`）
- 触发交互（点击/滚动/输入）后 `performance_stop_trace`
- 保存 trace 文件名按上述规范

> 注：DevTools MCP 采集用于“定位与对比”，不作为 CI 门禁。

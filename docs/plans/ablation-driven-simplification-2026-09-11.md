# Momentum 消融式简化实验

## 范围与基线

起点：`8990749582aaca855cd19cdae8f6f7cc1ec2aa5c`，工作区干净；Node 20.19.0。
先阅读中英文 README、开发/架构/测试/迁移文档，再扫描 src、Rust shell、33 个
SQL migrations、测试、quality 工具与 CI；不把现有目录与门禁当作产品规格。

必须保护：

- CTDP 成功增长、失败清零、永久例外、预约时限；正向计时、暂停/恢复与刷新后恢复。
- group 的子任务顺序、重复次数、循环结算、进度重置与时间限制。
- RSIP 树/子树违规、每日新增限制、阶段、运行历史、宽容组及任务联动确认。
- 导入 ID/引用重映射、旧数据默认值、软删除/恢复、时间统计、宠物奖励与属性衰减。
- local / Supabase 切换只更换数据源；Tauri 首启默认 local；pet 始终本机保存。
- 认证、用户隔离 RLS、SECURITY DEFINER 的调用者与归属检查、原子操作重试语义。
- Web 文件选择/下载/通知与 Tauri 原生文件/权限/窗口/触觉的差异；原生构建禁用 PWA。

文档不能代替代码证据：架构文档称 mobile release 尚未接入，但当前
`tauri-build.yml` 已包含 Android 构建和发布依赖；因此把 Android 也纳入兼容范围。
集成测试通过 MSW 执行 SDK/存储代码，不执行真实 Postgres/RLS。

基线结果：typecheck 通过；Web build 通过；集成测试 4 文件 / 32 测试通过。
单测 256 文件中 255 通过，1915 测试中 1914 通过；独立复跑同样失败的是
`useRSIPViewCreationActions.domain-chain.test.ts`：预期 atomic 创建失败被抛出，
实际 Promise resolve。该失败在任何消融修改之前存在。

统计口径：生产 TS/TSX 包含声明与生成的数据库类型，排除测试/fixtures；LOC
为物理行数（含空行/注释，去文件末尾空白）。静态 dependency edges 为不同
source → resolved local module，包括 type imports 和 re-exports，不计 dynamic imports。
这是结构成本指标，不是行为或运行时复杂度分数。

| 基线指标                                              |                   数值 |
| ----------------------------------------------------- | ---------------------: |
| 生产文件 / LOC                                        |           684 / 63,639 |
| class / interface 声明                                |               84 / 446 |
| 模块导出声明/命名再导出                               |                  1,442 |
| 静态本地依赖边                                        |                  1,935 |
| 测试及测试辅助文件 / LOC                              |           276 / 56,900 |
| quality 工具文件 / LOC（不含历史 reports）            |             23 / 2,884 |
| runtime / dev dependencies                            |                15 / 45 |
| package scripts                                       |                     50 |
| Web JS chunks / 原始 bytes / 各 chunk gzip bytes 之和 | 46 / 973,133 / 294,803 |

## A. Complexity map

| 区域                             | 复杂度税与证据                                                                                                                            | 消失后真正失去什么                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| UI / container / controller      | 259 个组件相关生产文件；AppShell 的 primary/secondary domains 与 view model builders 增加跳转                                             | 大型 Focus/Editor 的表单和生命周期隔离有价值；小组件纯转发没有自动保留理由                   |
| domain hooks                     | 真实 CTDP/group/RSIP 状态转移与保存顺序混在 orchestration 中                                                                              | 不变量与失败顺序不能删除；只为绕开文件长度的拆分可再合并                                     |
| QueryOptimizer                   | 7 文件、两个 Map、TTL、两种 hash、revision、10 个失效调用；通用 query/batch API 没有生产调用者；Dashboard 已 useMemo                      | 需要测量共享树缓存的增益；通用查询 API 本身没有用户能力                                      |
| exception-rule services          | RuleManager → Creator/Executor → RuleStateManager → Store/Controller/Queries；另有 validation/duplication/search caches、recovery、health | optimistic 临时 ID、使用记录与错误恢复有行为；多重缓存与探测系统尚缺收益证据                 |
| SystemRuntime                    | class → cache/monitoring objects → 原 singleton；唯一生产消费者为生命周期 hook                                                            | 只转发 start/stop，不新增生命周期保证                                                        |
| LocalPreferencesManager          | 200 行级 class，大多数方法只转发独立函数                                                                                                  | 原始键、解析、默认值、过期规则由下层函数保护；中间实例没有状态                               |
| TaskLifecycleEventBus            | singleton listener Set + publisher interface + 订阅 effect；唯一消费者为 RSIP 联动                                                        | 异步、不阻塞任务、异常隔离需要保留；全局订阅机制不一定需要                                   |
| storage ports / adapters         | 两种实现，细分 ports，local async 包装，Supabase table modules/mappers                                                                    | 真正隔离持久化/认证/错误与异步合同；不能把 async 包装一概视为无效转发                        |
| platform adapters / capabilities | adapter factories + capability center + 操作包装                                                                                          | native lazy loading、权限、取消/不支持与 UI placement 是真实差异；双重 capability 缓存仍可疑 |
| lifecycle / Zustand              | timer 与 rule manager start/stop；AppShell/navigation stores；废弃 UIStore alias                                                          | timer 持久化与 cleanup、同步 snapshot reader 有实际用途；去全局化需复现 StrictMode/异步竞态  |
| migration / defensive paths      | 旧字段 fallback、日期解析、RSIP journal 与重试                                                                                            | 支持用户自建旧库和崩溃恢复；没有最低 schema 淘汰证据，不能按年代删除                         |
| quality / tests                  | 23 个工具文件；runtime 工具额外跑 unit；repo-governance 两次全仓 depcruise；mock-call 测试约束失效通知                                    | 安全/行为检查保留；文件布局、失效调用次数、固定运行时间预算并非用户规格                      |
| experiments                      | 30 个实验源文件，17,694 行；大量历史 Manager/optimizer                                                                                    | 不进入生产并不等于可直接删除研究资产；先记录，不作为生产简化成果                             |

## B. Ablation table

候选在修改前选定；按偏好门面、运行时门面、查询缓存、事件总线、quality 工具的
顺序逐项验证。表内负面结果没有被当作“红灯即恢复所有旧架构”。

| Candidate                   | Hypothesis                                                | Experiment                                                                               | Result                                                                                                    | Decision                                                      |
| --------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| QueryOptimizer              | 局部 useMemo + 直接构树足够，共享缓存和失效协议不值得维护 | 真实时钟对比后删除 optimizer、全局 Map/TTL/hash、revision 和失效通知；渲染处保留 useMemo | tree/group/session/render/import 回归通过；一次失败只要求旧 revision 实参，删除该实现断言，保留结算断言   | 保留消融；拒绝把所有 memoization 一并删除                     |
| TaskLifecycleEventBus       | 唯一订阅者可用明确 callback 连接                          | 先改为闭包 callback；再以 mounted handler ref 保留旧生命周期语义                         | 最简闭包实验 1 失败 / 3 通过：延迟事件调用了旧 handler。改为随 React 更新的引用后，11 文件 / 119 测试通过 | 删除全局 bus、Set、publisher interface；保留小型生命周期 hook |
| LocalPreferencesManager     | 大部分方法只转发，无需 manager 实例                       | 将 30 个转发方法换为原函数引用，把 4 个 storage-mode 方法放入同一对象                    | 34 个 API 键与原来一致；8 文件 / 43 测试通过；typecheck 通过                                              | 删除 class 与一个文件，保持 localPreferences 调用方式         |
| SystemRuntime               | 单消费者门面没有新增不变量                                | lifecycle hook 直接访问现有 cache/monitor；删除聚合入口与纯转发测试                      | 3 文件 / 28 测试通过；typecheck 通过                                                                      | 删除门面，不改变被管理服务的 start/stop                       |
| Runtime/measurement tooling | 固定毫秒门禁的整套重跑和假时钟都没有可靠测量价值          | 先删除 runtime-budget 运行及入口，工具回归通过后，单独移除 performance setup 假时钟      | quality/workflow 2 文件 / 16 测试通过；真实时钟 harness 1 文件 / 2 测试通过                               | 删除 1 个工具和 1 个 script；保留 Vitest 耗时与其他检查       |
| 缺列兼容反证                | 旧 fallback 是否已经没有保存价值                          | 临时让缺列错误直接抛出，只运行完整/旧 schema 两个保存测试，finally 恢复源码              | 无 fallback：1 通过 / 1 失败；恢复：2 通过。失败是旧 schema 无法保存，而非目录/架构断言                   | 拒绝删除，源码与基线逐字一致                                  |

## C. Changes actually made

### 前后结构成本

每行是该实验相对前一实验的增量；负数表示减少。生产 LOC 不包含测试、工具、
文档，避免用删除历史说明夸大产品简化。

| 实验                      | 生产 LOC | 生产文件 | class / interface | 静态依赖边 | 模块导出面 | 测试/辅助 LOC |
| ------------------------- | -------: | -------: | ----------------- | ---------: | ---------: | ------------: |
| LocalPreferencesManager   |     -105 |       -1 | -1 / 0            |         -2 |         -1 |             0 |
| SystemRuntime             |      -45 |       -3 | -1 / 0            |         -6 |         -6 |           -49 |
| QueryOptimizer 及关联诊断 |     -614 |       -8 | -2 / -6           |        -29 |        -13 |          -681 |
| TaskLifecycleEventBus     |      -30 |       -1 | -1 / -1           |         -5 |         -3 |           -29 |
| runtime-budget / 假时钟   |        0 |        0 | 0 / 0             |          0 |          0 |           -26 |
| 合计                      | **-794** |  **-13** | **-5 / -7**       |    **-42** |    **-23** |      **-785** |

| 总指标                     |       Before |        After |
| -------------------------- | -----------: | -----------: |
| 生产 TS/TSX LOC            |       63,639 |       62,845 |
| 生产文件                   |          684 |          671 |
| class / interface          |     84 / 446 |     79 / 439 |
| 静态本地依赖边             |        1,935 |        1,893 |
| 模块导出面                 |        1,442 |        1,419 |
| 测试及辅助 LOC / 文件      | 56,900 / 276 | 56,115 / 273 |
| quality 工具 LOC / 文件    |   2,884 / 23 |   2,689 / 22 |
| package scripts            |           50 |           49 |
| runtime / dev dependencies |      15 / 45 |      15 / 45 |

共删除 **17 个文件**：13 个生产文件、3 个测试文件、1 个 quality 工具；新增本报告。
没有删除 npm dependency。删除的三个测试文件分别验证 25 个无生产调用的查询/缓存
API 场景、2 个 runtime 转发场景、3 个 bus 容器场景。新增两条渲染回归，并把一条
订阅测试扩展为四条异步/生命周期/异常隔离测试，所以单测总数净减少 25。
没有为了数字去删除 domain/存储/安全测试或降低 coverage/mutation 阈值。

### 概念与典型修改路径

- 查询/构树：原来是 `domain 写入 → onDataChange → QueryOptimizer → CacheMap +
ChainTreeCache → buildChainTree`，还要在 24 处更新 revision。
  现在是 `domain 产生新 chains → React useMemo → buildChainTree`；事件处理器直接
  构树。删除 **10 处失效通知**和 **24 处 revision 递增**，同时删除 revision 的传参、
  props、store 字段与测试断言。计数器从未进入持久化数据，不涉及备份格式迁移。
- 缓存状态：删除通用 cache Map、pending-query Map、TTL、lastChains、lastChainHash、
  lastChainsRevision、structural hash entry。关联 cache-hit/tree-cache 诊断也一并删除，
  开发面板继续显示同步状态、React render 指标和 force refresh。
- 偏好：`调用者 → barrel → Manager.method → preference function → localStorage`
  变为 `调用者 → localPreferences 的函数引用 → preference function → localStorage`。
  键、默认值、解析、错误处理和 timer 过期规则保持原样。
- 生命周期：`hook → runtime barrel → SystemRuntime.cache/monitoring → 服务`
  变为 `hook → 服务`。保留 cache/timer/rule manager 自己的 cleanup。
- 任务联动：`session → publisher → 全局 listener Set → effect subscription → RSIP`
  变为 `session callback → 当前 mounted handler → RSIP`。删除全局注册状态；保留
  异步执行、同步 throw/异步 reject 的隔离，以及派发时捕获 handler 的语义。
- 工具：`quality audit/info → runtime-budget → 再跑全套 unit → 自定义 JSON/固定阈值`
  被删除，直接使用正常 Vitest 输出。假时钟的 mock 函数、递增状态和 beforeEach
  同时消失。此次未新增常驻 benchmark runner 或新的质量门禁。

### 性能与构建

临时探针构造一个 group 和 N-1 个合法 unit，实际调用生产构树函数。每种路径热身
10 次，测量 30 次，使用 `process.hrtime.bigint()`；performance setup 当时的 mock
时钟不参与计时。以下为本机单次实验的中位数/p95，单位 ms。

| 链数量 | 直接构树 median / p95 | 原 revision miss | 原 revision hit     | 原 hash hit   |
| ------ | --------------------- | ---------------- | ------------------- | ------------- |
| 100    | 0.152 / 0.194         | 0.135 / 0.208    | 0.000208 / 0.000292 | 0.016 / 0.021 |
| 1,000  | 1.399 / 2.076         | 1.380 / 2.267    | 0.000167 / 0.000209 | 0.104 / 0.116 |
| 10,000 | 19.785 / 26.171       | 19.933 / 30.473  | 0.000250 / 0.000292 | 1.553 / 3.095 |

结论仅是：保留渲染处 memoization 有证据；全局失效协议可以消失。未宣称直接构树
比缓存命中快，也未宣称在移动设备达到相同耗时。React 的 memo 可丢弃，因此构树
本身仍必须正确；保存语义不能依赖命中缓存。探针没有留成新的常驻工具。

相同 Web 构建配置，统计 `dist/assets/*.js`；gzip 对每个 chunk 单独以默认 level 9
压缩再求和，排除 service worker/source map，不等于用户某次导航的网络下载量。

| 构建指标        |  Before |   After |                  差值 |
| --------------- | ------: | ------: | --------------------: |
| JS chunks       |      46 |      46 |                     0 |
| 原始 JS bytes   | 973,133 | 957,354 | **-15,779（-1.62%）** |
| gzip bytes 总和 | 294,803 | 290,476 |  **-4,327（-1.47%）** |

单测墙钟从 10.55s 到 8.99s，但前后并行负载不同，不能归因于此次改动。
确定减少的是 audit/info 入口中一次多余的全量 unit 执行，不虚报稳定的时间收益。

### 验证与边界

- 初次缓存消融：44 个文件通过，仅 completion 测试要求旧 revision 实参而失败；
  删除该实现断言后，相应 completion 和新渲染测试均通过，最终全量回归覆盖全部改动。
- 最终 `npm run test:all`：253 文件，252 通过；**1889 通过 / 1 既有失败**。
- `npm run test:integration`：4 文件 / **32 通过**，包括真实 Supabase SDK + MSW。
- `npm run test:performance`：1 文件 / **2 通过**，已使用真实时钟。
- `npm run typecheck`、`npm run lint`、`quality:arch-gate`、`quality:knip` 通过。
- Web build、`TAURI_ENV_PLATFORM=macos` 与 `TAURI_ENV_PLATFORM=android` 前端构建通过；
  两个 native 输出目录均未生成 service worker。
- 对修改文档与源码进行 Prettier/Markdown 检查，检查无 dangling imports/旧入口引用。
- Rust、SQL、RLS、native adapters 未修改。没有运行 Rust 编译/原生安装包构建、真机
  测试或真实数据库测试；前端平台构建不能替代这些验证。未跑昂贵 mutation/full
  coverage lane；此次证据不包括 coverage/mutation 分数提升。

既有失败值得单独处理：`useRSIPViewCreationActions.domain-chain.test.ts` 期望
`domain.createNodes` / `createRSIPNodesWithMeta` 原子链路，而当前 domain 没有该入口，
UI 创建代码顺序调用 `onSaveNodes` 和元数据保存。消融前独立复跑即失败，消融后仍为
同一失败。它提示现有原子 API 接线与测试预期不一致，不能靠删除测试掩盖。
本轮没有改动该创建链路。

`ARCHITECTURE.md`、测试指南以及缓存/性能指南同步更新。后两份删除了旧 API 示例、
不存在的 hook 示例和无证据的缓存指令；文档缩减不计入上面的生产 LOC 收益。

## D. Rejected simplifications

1. **去掉所有构树 memoization**：真实测量中 10,000 条链的一次构树约 20ms，超过
   常见 60Hz 单帧预算。共享 cache 可删除，但渲染 memo 有明确收益。本轮没有证明
   所有用户都拥有此规模；这是压力探针的负面结果，不是生产规模统计。
2. **用无生命周期的闭包替代 event bus**：实际实验触发旧 handler；这是隐藏的
   React/异步依赖。保留小型 mounted-handler ref/effect，拒绝为了少几行改变语义。
3. **删除缺列 fallback**：模拟旧 schema 的保存确实失败，恢复后成功。属于真实
   external/data compatibility boundary，有用户自建库支持需求；没有淘汰证据。
4. **检查后保留，未做破坏性消融**：storage ports 有 local/Supabase 两种实现，local
   async 包装还统一 Promise/错误合同；Tauri adapters 隔离 native lazy loading、权限
   和取消；timer snapshots 与 RSIP journals 保护刷新/崩溃恢复。不能把这些和纯转发
   门面混为一谈，也没有把这些静态判断伪装成完成的动态实验。

## E. Remaining suspicious complexity

### High confidence

- `src/stores/uiStore.ts` 的 legacy alias 只有自身测试消费，没有生产调用者。可作为
  下一次很小的删除实验；不涉及持久化兼容。Knip 通过也不证明这类被测试“使用”的
  API 有生产价值。
- `src/services/RuleStateManager.ts` 仍有大量 Store/Queries 转发；先移除只由测试调用
  的方法，再评估门面。已有 optimistic temporary ID 语义，不能直接删除整个状态机。
- 单行 barrel → index → implementation 链在 utilities/services 仍普遍存在。可以
  批次缩短无意义入口，但需检查 dynamic import、测试 mock 和文档引用；不能仅数文件。
- 既有 RSIP 原子创建测试失败是明确的接线/预期不一致；进一步简化 persistence 前
  需要先厘清此数据正确性问题。

### Medium confidence

- RuleStateStore 的 states/pendingCreations/idMappings 与真实 rule storage，以及
  validation/duplication/search 多层 cache，存在同步税。缺少真实规则规模、搜索耗时、
  快速创建后立即执行/失败重试的端到端测量。
- AppShell primary/secondary domain hooks 和 view-model builders；小型 container/view
  拆分可能可以合并。缺少 React Profiler 对 rerender/订阅粒度影响的比较，不应合成巨型文件。
- platform capability center 与 adapter getters 均缓存 capability/实例。先复现 Web
  权限变化、桌面/mobile 的不支持与取消，再尝试移除其中一层。
- `quality-runner` 的 registry/config/summary/freshness 和 mutation metadata 有复杂度，
  但 info lane 需要继续收集失败结果，nightly 需要确保报告属于当前代码，不能一概删掉。
- repo-governance 在 unit 内执行两次全仓 dependency-cruiser，成本显著。可用隔离小
  fixture 验证配置，避免源目录临时文件，但本轮未改其安全/架构检测行为。

### Speculative

- 去掉 Zustand/global singleton 并全面回归 React state：可能简化所有权，也可能引入
  过期闭包和重渲染问题；需要 session/RSIP/模式切换的异步生命周期实验。
- 删除旧 migrations、schema compatibility 或 RSIP journals：没有支持期限、数据库
  版本分布与恢复证据，不执行。历史迁移文件不是可随意重写的运行时代码。
- 删除 `tools/experiments` 全部历史代码：不影响生产 bundle，但不确定其研究/诊断
  价值；先核对实际用途和失效导入，不将“归档很多行”当作产品结构简化成果。

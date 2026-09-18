# Momentum 第二轮消融式简化

## 范围与基线

起点为最新 HEAD `837b52e94f6acad44adcf8f4386505b79d45bc5b`（消融实验1），
工作区干净，Node 20.19.0。已阅读该 commit diff、上一轮报告及开发/架构/测试指南。
不重复上一轮 QueryOptimizer、event bus、SystemRuntime、偏好 manager 与 runtime
预算工具实验；保留上一轮对构树 memo、mounted handler 与缺列 fallback 的反证。

基线 `test:all`：253 文件，252 通过；1,889 通过 / 1 失败，仍是
`useRSIPViewCreationActions.domain-chain.test.ts` 中原子创建失败应拒绝却 resolve 的
既有问题。本轮不修改这条创建链路或删掉这个失败测试。

## A. Repository-wide complexity scan

静态扫描所有生产 TS/TSX 的声明、imports/re-exports 与消费者，再核查动态 imports、
测试、工具及文档引用。单消费者只是线索：lazy views、CTDP/group/RSIP 转移、storage
适配器等即使只有一处消费，仍可能保护真实行为。

| 区域                     |   文件 / LOC | 判断                                                                   |
| ------------------------ | -----------: | ---------------------------------------------------------------------- |
| UI components            | 259 / 25,697 | 大表单/交互有实际状态；小转发层再按调用图筛选                          |
| AppShell                 |   25 / 2,420 | builders 重复定义输入和输出；primary/secondary 分组没有独立生命周期    |
| services                 | 112 / 12,846 | exception-rule 状态、验证、重复检测、恢复链是主要候选                  |
| domain hooks             |   30 / 4,566 | session/group 保存顺序与 RSIP 原子链路不能按文件数裁减                 |
| utilities                |  147 / 9,309 | platform 的实例缓存、capability 缓存和操作安全边界需分开实验           |
| storage + Supabase infra |   52 / 4,287 | 两种实现、错误/Promise 合同、旧字段 fallback 是真实边界                |
| Zustand stores           |      3 / 246 | legacy uiStore 无生产消费者；同步 snapshot reader 则被异步 domain 调用 |
| quality tooling          |   22 / 2,689 | 本轮无降低门槛或调整测试发现范围的理由                                 |

### 按预期收益排序的候选（修改前登记）

| 排序 / candidate                              | 当前保护的行为或 invariant                                                              | 结构/认知成本                                                       | Hypothesis / 最小可逆实验                                                           | 成功或失败证据                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. AppShell view-model builders               | 链 ID 查找、betting modal 完整 ID 条件、handler 传递                                    | 271 行、4 份重复输入 interface、5 builders、同一属性重复列两次      | 在现有 hook 直接构造已定义的 view props，内联少量派生值，删除 builders              | container/view 测试；迁移派生链和 modal 行为断言；保留构树 memo、navigation 与生命周期 |
| 2. Enhanced validation facade/cache           | integrity 检查用于创建告警与健康检查；preValidateRuleUsage 仅测试调用                   | facade → class → validators，预验证 TTL/namespace 与维护 API        | 生产调用直接依赖 integrity 函数，删除无生产调用的预验证入口及其缓存                 | 保留 integrity/type-match、真实 rule execution 的错误行为测试；规则子系统回归          |
| 3. RuleState Manager/Store/Queries/Controller | pending 创建 Promise、临时 ID、错误状态、过期清理和恢复同步                             | 4 对象、3 个 Map、多层方法转发                                      | 先合并到现有 manager，同一处拥有状态；消除内部 Map 访问方法；另测是否可去掉状态 TTL | 并发创建、等待、失败隔离、过期、start/stop 与规则子系统测试                            |
| 4. Platform adapter/capability caches         | Web/native 路由、lazy import、unsupported/cancel/error 合同、permission 与 UI placement | 模块单例之上的实例缓存和 capability 副本，factory callback 反向依赖 | 先只去 adapter getter 的额外引用缓存；再独立去 capability snapshot，保留操作边界    | Web/desktop/mobile 路由、并发获取、权限变化、不支持/取消/失败；构建 Web/native         |
| 5. AppShell primary/secondary                 | 保持 hooks 顺序及 session → RSIP callback 接线                                          | 纯聚合 hook 调两组仅一次消费的 hook，额外类型/参数转发              | 合并到 useAppShellDomains，保持原调用顺序和返回键                                   | AppShell、task lifecycle、domain 回归                                                  |
| 6. legacy uiStore                             | 旧名称 resetAllUI，但没有生产调用或持久化字段                                           | getState 每次复制对象 + 类型改写，仅测试消费                        | 删除 alias 文件，核对并保留 navigation 的行为测试                                   | navigation/URL/AppShell 回归和全仓引用检索                                             |
| 7. duplication/search caches                  | 实时名称重复判断、搜索排序/建议                                                         | TTL、namespace、失效和搜索索引多份状态                              | 暂不预设删除；先查生产调用与计算成本                                                | 需真实规则规模、重命名/删除后新鲜度与排序回归                                          |
| 8. storage async wrappers / 全局 Zustand      | 统一异步错误合同、local/cloud 切换、异步读最新快照                                      | 有样板，但有多实现与时间语义                                        | 静态复核，优先级低；不做机械函数引用替换                                            | Promise rejection、认证、刷新/切换、并发保存反证                                       |

每次只实施一个实验；失败先分类，不以旧 class、mock 次数、文件布局作为产品需求。

## B. Ablation table

先跑相关基线，修改后先跑 targeted tests，再跑受影响子系统；下列顺序即实验顺序。
成功组完成后再跑全量验证。测试文件数与用例数是当时该子系统的结果，不能相加
当作不同测试总数。

| Candidate                          | Experiment                                                                                                                                                                          | Evidence / failure classification                                                                                                                                                              | Result / decision                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| E1. View-model builders            | 直接以 `AppShellViewProps` 构造 props，将 5 个链查找与 betting 条件放入原 hook；删除 builders 和重复输入 interface                                                                  | 基线 3 文件 / 16 项；修改后 targeted 2 / 14，AppShell/stores/domain 37 / 307；typecheck 通过。container 覆盖当前/编辑/辅助链、数据替换、弹窗缺 ID、清除辅助判定；view 测试保留                 | 删除 builder 层；保留 view props、React memo 和 mounted-handler 生命周期              |
| E2. 预验证 service/cache           | 调用图确认 `preValidateRuleUsage` 与其 type-match 分支无生产消费者；移除 facade/class、结果缓存、TTL、维护入口、无作用 suggestion handlers；有调用的 integrity 函数直接迁入一个文件 | 基线 6 / 95；修改后 targeted 5 / 78，再新增 2 项真实分类验证回归，子系统 43 / 379。规则类型编辑、删除后立即验证、存储错误后重试通过；生产 validator 仍检查存在/激活/类型并保留错误恢复         | 删除闲置 API；保留实际执行验证与完整性检查，未放宽规则使用条件                        |
| E3. RuleState 转发链               | Manager 直接拥有原 Maps 和创建/查询逻辑；删除 Store、Queries、Controller、types 中间层及无调用的 getRule/ruleExists/clearAllStates 等 API；内部 Map 访问直接进行                    | 基线 3 / 14；修改后 targeted 3 / 13，子系统 44 / 380；typecheck 通过。新增并发创建一成一败、等待不串线、临时 ID 过期、stop 后不清理、restart 后继续清理；以可观察状态替换 cleanup 调用次数断言 | 删除 3 个内部对象；保留现有 ID/Promise/同步/TTL 语义。没有把 state machine 换成新框架 |
| E4. Adapter 实例缓存               | 删除四个 module-level `_adapter` 引用与命中分支，getter 直接返回 dynamic import 的导出对象                                                                                          | 基线平台 9 / 41；targeted 1 / 3，平台 9 / 43。并发获取仍是相同模块对象；Web/desktop 使用无触觉 adapter，mobile 使用原生 adapter                                                                | 删除重复缓存；保留异步 API 与 native lazy import                                      |
| E5. Capability snapshot            | 删除永久 capability 副本；无状态 center 改为模块对象，不再用 class + nullable singleton；操作包装与 factories 保持                                                                  | targeted 1 / 9，平台及相关 UI 18 / 104；typecheck 通过。权限变化、支持状态变化、不支持、取消、磁盘错误与窗口/触觉失败回归通过；热读取探针见下表                                                | 删除缓存和实例化机制。支持状态在下一次查询时重新读取，而非永久冻结；没有新增权限请求  |
| E6. File capability 直接委托       | 假设 adapter 已有同等不支持/错误合同，临时用两条直接 adapter 调用替代 file wrapper                                                                                                  | targeted 2 项均失败：不支持的保存返回 true；磁盘满异常越过边界，原本应 resolve false。取消仍是 false/null。不是 mock 调用次数或 class 存在性失败                                               | **拒绝**。这是操作合同回归；finally 恢复源码，逐字比较一致，恢复后 9 / 9 通过         |
| E7. Primary/secondary domain hooks | 将两组 hook 的调用按原顺序并入 `useAppShellDomains`，依赖直接指向已有变量，保持返回键及覆盖顺序                                                                                     | 前后 targeted 均 2 / 12，AppShell/stores/domain 37 / 307。task callback、RSIP 接线与现有状态 reader 保留                                                                                       | 删除仅供分组的两个 hook 与跨文件 ReturnType，不改变订阅或渲染树                       |
| E8. Legacy UI alias                | 删除无生产消费者的 uiStore 适配层；其 4 项测试已被原 navigationStore 的 6 项行为测试覆盖                                                                                            | 基线 2 / 10；targeted 3 / 19，AppShell/stores/domain 36 / 303。全仓检索无运行时调用；Knip 随后暴露仅供 alias 使用的 NavigationStoreApi，一并删除                                               | 删除 alias、getState 复制和类型改写；保留实际 Zustand stores                          |

### 测试的取舍

- E1 删除 6 项 builder 测试，container 新增 4 项行为用例；原 group 数据替换及
  session → RSIP 测试保留。未给直接属性赋值再造一套全量同形测试。
- E2 删除无生产入口的 8 项 prevalidation 与 9 项 typeMatch 测试；原 3 项 integrity
  测试迁移，实际分类验证新增 2 项编辑/删除/存储失败回归。没有删除生产执行、
  missing/inactive/mismatch、缺类型自动修复或 import/export 的测试。
- E3 将 ID 生成、测试专用查询和 cleanup spy 断言收缩为创建/等待/隔离/过期行为；
  6 项变为 5 项。原错误状态与非临时规则查询测试保留。
- E4/E5 共新增 6 项平台回归。E8 删除的 4 项均是 navigation 行为经 alias 再跑一次。
- 最终 test-lint 发现上一轮留下的 cache-invalidation 测试没有任何断言。保留该
  场景并改为验证保存失败的日志和辅助判定结果；没有用删测试或 lint ignore 掩盖。
- 净用例变化：`-2 -15 -1 +2 +4 -4 = -16`，单测 1,890 → 1,874。

### 性能证据的边界

使用真实 Web adapters 的临时 Vitest 探针，首次 `getCapabilities` 后热身 5 组，
记录 30 组、每组 100 次串行读取，以 `process.hrtime.bigint()` 计时并除以 100。
两边均已移除 E4 的重复实例缓存；before 保留原 capability snapshot，after 为 E5。
探针在实验结束后删除，没有加入定时预算或新工具。

| 每次热读取（ms）    |     median |        p95 |
| ------------------- | ---------: | ---------: |
| capability snapshot | 0.00006167 | 0.00009917 |
| 直接读取 adapters   | 0.00477583 | 0.00727750 |

删除缓存并不比命中缓存快。这里的判断是：通知、文件、窗口操作不是每帧计算，
在本机观测到的微秒级读取代价不足以证明第二份 capability 状态值得维护。
此探针不测原生 IPC、不代表真机延迟，也不证明所有缓存都能删。

## C. Before / after structural cost

沿用上一轮的生产/测试/工具分类。生产 TS/TSX 含 `.d.ts` 与生成数据库类型；
排除 `test`、`__tests__`、fixtures、`*.test.*`、`*.spec.*`。LOC 为物理行数（含
空行/注释，去文件末尾空白）。class/interface 计 AST 声明；本地静态依赖边为不同
source → TypeScript 按 tsconfig 解析的本地模块，含 type imports/re-exports，
不含 dynamic imports。quality 排除历史 reports，package 项按 manifest 键计数。

导出面需要明确校准：上一轮报告为 1,419，本次相同 HEAD 重算为 **1,445**。
本次按每个导出声明 1、named export/re-export 每个 specifier 1、export-star 1
计数（包括类型）。若只计声明语句则为 1,379 → 1,348。下面 before/after 都使用
同一明确的 AST 算法，**不把口径差异当作代码变化**；其余基线数字与上一轮一致。

| 实验增量                               | 生产 LOC | 生产文件 | class / interface | 静态本地依赖边 |  导出面 | 测试/辅助 LOC |
| -------------------------------------- | -------: | -------: | ----------------- | -------------: | ------: | ------------: |
| E1. Builders                           |     -261 |       -1 | 0 / -4            |             -2 |      -5 |          -135 |
| E2. 闲置预验证链                       |     -341 |       -5 | -1 / -2           |            -18 |     -12 |          -370 |
| E3. RuleState 对象合并                 |     -188 |       -4 | -3 / 0            |            -15 |      -7 |           +15 |
| E4. Adapter 缓存                       |      -13 |        0 | 0 / 0             |              0 |       0 |           +26 |
| E5. Capability snapshot / class        |       -7 |        0 | -1 / 0            |              0 |       0 |           +69 |
| E6. 拒绝的 file wrapper 删除           |        0 |        0 | 0 / 0             |              0 |       0 |             0 |
| E7. Domain 分组 hooks                  |      -31 |       -2 | 0 / 0             |             -9 |      -3 |             0 |
| E8. UI alias                           |      -30 |       -1 | 0 / 0             |             -1 |      -3 |           -65 |
| 门禁收尾：孤立类型、测试整理与缺失断言 |       -1 |        0 | 0 / 0             |              0 |      -1 |            +7 |
| **合计**                               | **-872** |  **-13** | **-5 / -6**       |        **-45** | **-31** |      **-453** |

| 总指标                     |       Before |        After |
| -------------------------- | -----------: | -----------: |
| 生产 LOC / 文件            | 62,845 / 671 | 61,973 / 658 |
| class / interface          |     79 / 439 |     74 / 433 |
| 静态本地依赖边             |        1,893 |        1,848 |
| 导出面（本次重新校准）     |        1,445 |        1,414 |
| 测试及辅助 LOC / 文件      | 56,115 / 273 | 55,662 / 270 |
| quality 工具 LOC / 文件    |   2,689 / 22 |   2,690 / 22 |
| package scripts            |           49 |           49 |
| runtime / dev dependencies |      15 / 45 |      15 / 45 |

quality 多出一行的原因：已删除的 test-only `typeMatch.ts` mutation 目标替换为
实际执行的 `rule-classification/RuleTypeValidator.ts` 和 `ruleValidator.ts`。
critical mutation 的目标、100% 分数要求、0 NoCoverage 以及 coverage/typecheck/lint
门槛全部保持原样。没有添加基础设施或 npm dependency。

## D. 验证、负面结果与不可约复杂度

- 全量 `test:all`：250 文件，249 通过；**1,873 通过 / 1 个既有失败**。
- `test:integration`：4 文件 / **32 通过**，包含 SDK + MSW 的 storage 流程。
- `test:coverage`：254 文件，253 通过；**1,905 通过 / 同一个既有失败**。命令因此
  失败，未发布 fresh coverage 报告；不声称 coverage lane 或覆盖率门槛已通过。
- `typecheck`、完整生产 `lint`、Web build、architecture gate、Knip 通过。
  type coverage 为 99.77%（门槛 95%）；完整 test-lint、assertion 检查与
  mutation-scope gate 通过。修改文件 Prettier、Markdown lint、git diff whitespace 检查通过。
- macOS、Android 的 Tauri **前端构建**通过，两个输出均无 service worker。
  未运行 Rust 编译、原生安装包/真机测试、真实 Postgres/RLS 或完整 mutation run。
- 全量执行后的小修仅涉及测试、孤立类型和等价的 import/属性简写，相关 16 项及
  integrity/navigation 9 项回归通过；不把这类变化当作额外 runtime 收益。
- 一次 Knip 与 coverage 的 repo-governance 测试并行，看到了后者临时写入源码目录的
  `__architecture_violation_fixture__.ts`。测试自行清理后串行 Knip 通过。没有修改
  工具忽略列表；这也是下一轮治理工具复杂度的具体证据。

**真正拒绝的实验是 E6**：文件操作的 unsupported/cancel/failure 合同有调用方。
`useExportWorkflow`、`useImportWorkflow` 与规则导入导出操作需要稳定的成功、取消和
失败结果。错误隔离不等于日志装饰，不能用两条直接调用等价替换。恢复干净后没有
留下新旧两套方案。

本轮保留且有行为证据的约束：

1. view 层的链关联和完整 modal IDs；这些派生规则没有随 builders 一起删除。
2. 规则执行对不存在、停用、类型不匹配和存储失败的处理，以及原缺类型修复。
3. Web/native 路由、lazy imports、权限读取、取消和失败边界；模块系统已经提供的
   实例唯一性无需另一份引用缓存。
4. 已保留的 RuleState API 内，并发 Promise 和临时 ID 清理是有时间语义的状态。
   **这只证明其当前 API 的语义，不能证明乐观创建本身是必要的产品入口**，见下一节。
5. 原 storage Promise 合同、RSIP/session 保存顺序、刷新恢复、缺列 fallback 等仍
   属于产品/兼容边界。此次未对它们实施删除实验，不将静态保留包装成新负面结果。

## E. 下一轮最值得怀疑的复杂度

按下一步可获得的证据排序：

1. **RuleState 整条乐观创建/诊断链的真实可达性**。此次只合并对象。全仓调用追踪
   没找到 UI 调用 `createRuleOptimistic`；目前主要由 manager 转发和测试消费。
   同时 `performActualCreation` 仍覆盖 storage 返回的 ID，executor 的 temporary 分支
   也仍依赖 pending entry。这些是原有路径，尚未厘清历史 ID/恢复兼容，不能因本轮
   API 测试通过就宣布整套机制不可约。下一轮应先沿真实 create/use/recovery 流程验证，
   再消融 state 复制、health 同步、三张 Map 和周期清理，而不是继续拆 class。
2. **EnhancedDuplicationHandler + RuleSearchOptimizer + ExceptionRuleCache**。
   前者把冲突结果和 suggestion closures 放入两分钟 namespace；后者又有 index
   revision、100-entry 结果缓存、历史与热门搜索、debounce。索引更新、删除/重命名
   后新鲜度、真实规则规模和排序需要单独测。此次没有做缓存耗时/命中分布实验，
   所以既未判定必要，也未为删除量强行拆除。
3. **ExceptionRuleManager / recovery / health**。初始化含完整性修复和错误恢复，
   不能把所有转发都当作无意义；但 `RuleExportImportService` 的 setter 注入、
   diagnostic scoring 和初始化同步仍需证明有产品消费者或修复成功的证据。
4. **Platform 操作 factories**。E5 删掉 snapshot 后，每种操作仍通过 callback
   获取所有 adapters 的 capabilities。可以继续实验让单项操作只读取自己 adapter，
   但必须保留 E6 证明的操作合同及 native permission 处理，不新增通用 registry。
5. **repo-governance 的源码目录 fixture**。本轮已实际出现它与 Knip 的并行冲突。
   在临时目录的小 fixture 上验证 dependency-cruiser 配置，有望移除副作用和全仓重扫；
   不能用忽略文件或放宽 architecture gate 掩盖。
6. **RSIP 原子创建接线的既有失败**。进一步简化 persistence/orchestration 前先解决
   API 与 UI 保存链路的不一致。旧 migrations、journals、auth/RLS 不在无证据删除范围。

本轮删掉的是重复组装、闲置预验证路径、内部转发对象、冗余缓存所有权和 legacy alias。
仍保留的函数、状态和边界，分别承担派生行为、异步时间语义或外部平台合同；不靠文件
长度、目录对称或 class 名称来证明其价值。

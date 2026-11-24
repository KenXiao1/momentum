# Momentum 第六轮消融：门面、死代码与防御性分支

## 基线与预登记

基线为 `3dc5560`，工作区干净，Node 24.18.0。单测基线 **240 文件 / 1,707 项通过**。
前五轮和 11 月的 catch 清理已经处理了查询缓存、事件总线、偏好门面和吞错写入，
本轮不重复那些链路，只处理当前代码里有证据的三类问题：只转发的门面、只被测试
引用的生产代码、与类型或解码边界矛盾的防御分支。

候选来自三种探针，而不是凭印象挑文件：

1. 只以 `src/main.tsx` 和 `index.html` 为入口的生产模式 Knip。常规 Knip 把测试也当作
   入口，所以只被测试引用的代码不会被报告。
2. 临时开启 `@typescript-eslint/no-unnecessary-condition` 等类型规则（配置放在临时目录，
   未进仓库）。基线 **127 条**：类型上不可能为空或必然为真、却仍被检查的分支。
3. 对有运行时行为的候选，用生产构建和 Playwright 做前后对照。

| 实验                | 假设                                                                   | 接受条件                                                    |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| E1 过期门面         | 单源 re-export 文件只增加一跳，删除后改指真实模块不改变任何行为        | 类型、单测、架构门禁、Knip 不变；`vi.mock` 仍指向同一模块   |
| E2 测试专用代码     | 生产入口不可达的文件和导出只被自己的测试保活                           | 生产 Knip 不再报告；保留合理的测试接缝（类、store 工厂）    |
| E3 构树防御层       | 类型检查、吞错返回空树、只打日志的校验对合法输入没有作用               | 父子、排序、孤儿提升、自指修正、无 id 跳过等契约不变        |
| E4 布局自动修复     | 规则对话框里的布局监控在真实 DOM 上不产生修复，只留下观察者成本        | 生产构建前后 DOM 指标和截图一致，长名称不横向溢出           |
| E5 并行反馈系统     | 专注模式独有的消息系统可以并入全局 toast，不丢失用户可见的错误文案     | 每种可抛出的规则错误文案不变；真实浏览器暂停流程通过        |
| E6 与类型矛盾的分支 | 解码器已保证的字段、SDK 已保证的返回值不需要再判空                     | 只删除有边界证据的分支；浏览器兼容、原始 JSON、下标访问保留 |
| E7 三份错误归一化   | `toError`、`errorHandling.toError`、`normalizeUnknownError` 是同一件事 | 合并后保留 Error 实例、`{ message }` 解析和空消息回退       |

不新增依赖、持久化字段、SQL migration、质量门槛或常驻工具。

## 实验结果

### E1：删除 34 个转发文件

`d41a949` 拆分大文件时留下了 32 个单行 re-export，其中多个文件自己写着
`@deprecated Remove after 2026-09-30`。另有两个双跳（`ChainCard.tsx → chain-card/index.ts →
ChainCardContainer`）和一个桶套桶（`supabase/chains.ts → chains/index.ts → mutations.ts`）。
每个 shim 只有 1–3 个使用者，通常是一个懒加载入口加一个测试 mock。

用 codemod 解析每个导入、`import()`、`vi.mock` 和 `vi.importActual` 的目标；指向 shim 时
改写到真实模块，**92 个文件 138 处**。生产代码和测试改写到同一路径，所以 mock 仍作用
于生产代码实际加载的模块。6 处改名导出（如 `BettingModalContainer as BettingModal`）手工
改为真实名称，同时修正测试 mock 工厂的键。删除 ESLint 中只为这些门面存在的豁免块。

**接受**。单测 240 / 1,707 与基线一致，类型、架构门禁、Knip 通过。

### E2：删除只被测试保活的代码

生产 Knip 报告的文件：`CheckinService`（自注释 “Deprecated: prefer calling storage directly”）、
`AccessibleFormField`（221 行）、两份从未接入 mapper 的 zod 行 schema。导出：只转发默认
语言的 `formatTimeDescription`、没有生产读者的 `selectBettingModal`、与 `toError().message`
相同的 `getErrorMessage`、barrel 中的 `createTranslator`。删除这些代码和只验证它们的测试；
`navigationStore` 测试改为直接断言 store 字段，保留开启/关闭押注流程的行为验证。

**保留**：被导出的 `SupabaseStorage`、`ExceptionRuleManager` 等类和 store 工厂是测试构造
新实例的接缝。`archiveRSIPNodesAndRemove` 同样只有测试使用，但它是 `2894a8c` 接入、两天后
被 `9366759` 回滚留下的写入函数；那两天的构建可能已经写出 `archive_nodes` 日志，回放代码
必须保留。本轮不改日志格式和回放，留给单独评估。

### E3：构树只保留行为

`buildChainTree` 原有：对 `Chain[]` 参数做 `Array.isArray`；整体 `try/catch` 返回空树；
每次调用都在生产环境执行只打开发日志的完整性校验（含 `JSON.stringify`）；构建后再遍历一次
树只为报告丢失节点；每个节点都拼一条只在开发模式输出的中文日志字符串。

吞错返回空树违反 [架构文档](../guides/ARCHITECTURE.md) 的错误处理规则：中间层应让错误
传播。它把任何异常显示成“没有任务链”，这正是此前两次数据丢失问题的同类掩盖。

重写后约 40 行，保留：父节点缺失或指向自身时提升为根并清空 `parentId`、按 `sortOrder`
排序、重复 id 的原有表现、跳过无 id 记录。最后一条有真实理由：解码层不校验 id，而在加载
时丢弃会让下一次整表保存删除它，所以写进了注释。`ChainTreeNode.depth` 只有写入没有读者，
且取决于输入顺序（子节点排在父节点前时计算错误），一并删除，测试夹具删去 63 行。

原 `treeBuilder.test.ts` 主要断言 `performanceLogger.warn/error/debugLazy` 的调用次数，
改为行为测试，新增“子节点在父节点之前”的输入。多节点父子环仍然不出现在树中，与原行为
一致；原实现只是额外打印错误，这里记录为已知边界。

**接受**。受影响 98 文件 / 732 项通过。

### E4：删除布局“自动修复”监控

`LayoutStabilityMonitor` 和 `layout-monitor/` 共 9 个文件，只服务规则选择对话框。它在生产
环境运行（只有日志受 `isDev` 控制）：挂 MutationObserver、ResizeObserver、layout-shift
观察者，对溢出元素写入 `overflow-x: hidden`、`max-width: 100%` 等内联样式，问题数组只增
不清并持有 DOM 引用。

用生产构建和 Playwright 做前后对照：建 chain，在规则管理器中创建 100 字符（含 86 个
连续 `X`）的规则，启动专注模式并点击暂停，在 1280 和 375 宽度下测量对话框。

| 指标               | 删除前（1280 / 375） | 删除后（1280 / 375） |
| ------------------ | -------------------- | -------------------- |
| 监控写入的内联样式 | 0 / 0                | 0 / 0                |
| 可见横向溢出元素   | 0 / 0                | 0 / 0                |
| 文档横向滚动       | 否 / 否              | 否 / 否              |
| 截图（字节）       | 54,096 / 37,918      | 逐字节相同           |

长名称由组件自身 CSS 截断。原因也可以从代码确认：`unstable-width` 依赖
`getComputedStyle().width === 'auto'`，真实浏览器对已渲染元素返回像素值，这一支不可达；
DOM 观察者只检查新增节点本身，不检查其后代，真正被截断的文本元素从未被检查。

**接受**。同时删除只为监控传递的 `containerRef` prop 链和对应测试。

### E5：专注模式反馈并入全局 toast

`UserFeedbackHandler` 门面转发到 `FeedbackPresenter`、`MessageStore`、`ErrorMessageFormatter`，
再由 `UserFeedbackDisplay` 渲染，只服务专注模式的例外规则流程。应用其余部分已经使用
`toast` 和 `ToastViewport`，两者都固定在右上角，同时出现时互相重叠。

旧系统还有两个用户可见问题：错误消息 `persistent: true` 既不自动消失，又因此隐藏了关闭
按钮，出错后右上角会留下关不掉的框；“创建规则”在真正 `await` 之前同步调用
`updateProgress(30)`、`updateProgress(70)`，进度条是假的。模块加载时还会向 `head` 注入样式。

改为 `toast.error/success/warning/info`，标题和正文分开传入。原格式化器的分支压缩为
`describeRuleError`，对生产中实际抛出的六种错误保持原文案（含 `RULE_NOT_FOUND` 的两种
文案和 `VALIDATION_ERROR` 的安全细节）。`EnhancedExceptionRuleException` 的工厂、链式
setter、`toJSON/fromJSON`、分类方法，以及从未抛出的八个枚举成员一并删除。被孤立的 13 个
翻译键在中英文中同时删除，i18n 门禁仍为 0 未使用键。

行为变化：错误 toast 6 秒后自动消失并可手动关闭；成功、警告、信息的时长改用全局默认值；
不再显示假进度。两份 hook 测试改为 spy 真实 `toast`，逐条断言用户看到的文案。

**接受**。专注模式 7 文件 / 48 项通过；浏览器流程中“在暂停对话框创建规则并暂停”通过。

### E6：删除与类型或边界矛盾的分支

只删除能找到边界证据的条目：

- `chain.auxiliaryExceptions?.length || 0` 等 8 处：本地 `decodeChain`、Supabase
  `mapChainRowToChain`、导入解析三条读取路径都保证该字段是数组。
- Supabase 列表查询在错误检查之后的 `data || []`、`data?.length` 等 14 处：SDK 成功时
  返回数组，类型也如此声明。MSW 集成测试执行真实 SDK 代码。
- `error.message ?? 'Sign in failed'` 等认证字段：SDK 类型为非可选字符串，`??` 也不处理
  空字符串，原本就是死分支。
- 闭合联合上的恒真比较、不改变类型的断言和非空断言。

消融暴露两个测试刻意构造了不可能的输入来锁定守卫：一个 `delete` 掉 chain 的必填字段，
一个 mock 列表查询返回 `{ data: null, error: null }`。前者改用合法 chain 后仍验证原行为，
后者删除。

**保留**（探针报告但不是多余代码）：`navigator.locks`、`webkitAudioContext`、
`requestFullscreen?.()` 等浏览器兼容检查；`localRuleStore` 和导入计划对原始 JSON 的校验；
未开启 `noUncheckedIndexedAccess` 时的下标和 `Record` 访问；闭包中修改的标志位；RPC 返回值；
RSIP mapper 中可能服务旧库缺列的默认值。类型探针从 **127 条降到 72 条**，剩余条目属于
这些类别。

### E7：合并三份错误归一化

`errorMessage.toError`、`errorHandling.toError`（对象走 `JSON.stringify`）和包装前者的
`normalizeUnknownError`（空消息回退）语义几乎相同，散布在 49 处调用中，没有任何调用方传入
自定义回退文案。保留 `errorMessage.toError`，加入空消息回退，删除另外两个文件，
codemod 合并重复导入。唯一的可见差异是无 `message` 的普通对象日志从 JSON 变为
`[object Object]`，只影响 4 个日志调用点。

**接受**。

## 结构成本

口径与第三至五轮相同：`src` 下 TS/TSX（含声明及生成类型），路径含 `test`、`__tests__`、
`fixtures` 或 `.test.`/`.spec.` 的属于测试辅助；LOC 含空行注释、去掉文件末尾空白；
class/interface 按 TypeScript AST 声明计数。共享文件归入主要修改它的实验。

| 实验      |   生产 LOC | 生产文件 |   测试 LOC |
| --------- | ---------: | -------: | ---------: |
| E1 门面   |       -137 |      -34 |         +2 |
| E2 死代码 |       -324 |       -4 |       -600 |
| E3 构树   |       -175 |        0 |       -204 |
| E4 布局   |       -673 |       -9 |       -642 |
| E5 反馈   |       -974 |       -7 |       -284 |
| E6 防御   |        -18 |        0 |        -12 |
| E7 归一化 |        -85 |       -2 |        -25 |
| **合计**  | **-2,386** |  **-56** | **-1,765** |

| 指标              |   Before |    After |
| ----------------- | -------: | -------: |
| 生产 LOC          |   55,553 |   53,167 |
| 生产文件          |      565 |      509 |
| class / interface | 38 / 381 | 27 / 374 |
| 测试与辅助 LOC    |   49,184 |   47,419 |
| 测试与辅助文件    |      264 |      256 |
| 类型探针条目      |      127 |       72 |
| 内部模块 mock     |      273 |      262 |

新增文件只有 `ruleErrorMessage.ts`。内部 mock 基线已按门禁提示锁定为 262。

## 验证与边界

- 单测 **232 文件 / 1,630 项通过**，集成 **3 文件 / 35 项通过**。减少的测试只验证已删除
  的代码或日志调用；新增“子节点先于父节点”“空消息回退”和逐条 toast 文案断言。
- `test:coverage`：**235 文件 / 1,665 项通过**，statements **83.61%**、branches **74.9%**、
  functions **82.79%**、lines **84.62%**，原门槛通过。
- Chromium 8 条浏览器流程通过（含生产构建），覆盖暂停对话框创建规则、全局规则暂停、
  完成失败后重试、导入导出和 RSIP 删除。
- 应用与测试类型检查、ESLint（无错误；警告均在未修改文件中）、架构门禁、Knip、i18n、
  错误处理门禁、test-lint、断言检查、mutation-scope、type-coverage、工具自测、源码拼写通过。
- 未执行完整 mutation、真实 PostgreSQL/RLS、Rust/原生安装包或真机验证。

## 停止条件与后续

本轮停在有证据的删除上，没有为降低行数拆分文件或新建抽象。发现但未处理：

1. `getActiveSession`、`getScheduledSessions`、`getRSIPMeta` 在读取出错时返回“没有数据”
   （`null`、`[]`、`{}`），与此前 chains 读取吞错是同一类问题。修改会改变加载语义，
   应参照 `ca802fb` 单独处理并验证失败加载界面。
2. 多节点父子环会让节点从树中消失；需要先确认哪些写入路径可能产生环。
3. `ImportExportService` 是持有两个无状态服务实例并转发两个方法的门面；开发专用的性能
   监控（`performance-monitor/`、`performanceLogger`、`reactPerformanceMonitor`）约千行，
   与 `logger` 形成第二套日志通道。两者都可以单独消融。
4. `archiveRSIPNodesAndRemove` 只剩测试使用，删除前需决定 `archive_nodes` 日志回放的保留期限。

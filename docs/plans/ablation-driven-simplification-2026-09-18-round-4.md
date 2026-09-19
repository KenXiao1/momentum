# Momentum 第四轮消融：原子创建与异步状态所有权

## 基线与预登记

基线 `37c08cda5e9999d4470edc5e3c671fcc2ee572eb`（第三轮消融），工作区干净，
Node 20.19.0。修改前定向基线：RSIP UI → domain 创建链失败，原子 local intents
和 Supabase intents 合计 21 项通过。失败仍为预期 rejection 实际 resolve。

| 实验          | 假设与操作                                                                                                     | 接受条件                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| E1 RSIP 创建  | 删除 UI 分两次写 nodes/meta 的流程，接入已有 journal/RPC；domain 统一串行写入，尝试移除 UI metadata 镜像和队列 | 失败不发布任何切片、重试复用 IDs、成功一次发布 nodes/meta；模式切换不覆盖创建元数据；local 恢复与云端返回数据均被验证 |
| E2 查询变化   | debounce 生命周期由消费它的 effect 管理，移除 optimizer 内无清理的 timer 所有权                                | 清空 query、替换/清空规则、卸载均取消旧任务；排序、高亮、新鲜度不退化；保留已有测量收益的索引与结果缓存               |
| E3 诊断与恢复 | 追踪生产消费者，验证 export/import setter 是否只是隐式初始化协议                                               | 先证明冷启动/错误恢复行为；仅删除有证据的重复状态或不可达接口                                                         |

不修改已有 SQL migration、RLS、journal 格式、测试发现范围或质量阈值。
云端创建使用现有 `create_rsip_nodes_with_meta`；缺 RPC 不可用非原子写入伪装成功。
合成性能数据不代表真实用户规模；未取得真实分布时明确记录证据边界。

## E1：接通表单原子创建，收拢 metadata 写入所有权

原 UI 先 `onSaveNodes`，清空表单，再单独更新 lastAddedAt；domain 在首次建树后
还单独写入轮次 metadata。已有的本地 journal 和 SQL 原子 RPC 没有接到 UI。
本轮接通单条和拆分模板两种表单提交：

- AppShell → `onCreateNodes` → domain `createNodes` → public storage port。
- local adapter 使用既有 journal，完成后返回受影响的持久化 nodes 和 metadata。
- Supabase adapter 使用既有 RPC 的三个命名参数，按固定的节点 ID 集合生成
  intent key，验证并映射服务端返回值，不用提交前快照假定写入结果。
- domain 的同一写入队列同时占用 nodes/meta 两个切片，成功后只执行一次状态提交。
  严格模式检查在队列内读取最新已提交状态。
- metadata updater 也在 domain 队列内求值。UI 删除 latestMetaRef、metaSaveQueueRef、
  同步 effect 和失败回滚分支；执行记录写入复用 domain 的排队逻辑。
- 表单保留一个失败提交的草稿及其 IDs/创建时间。同一挂载期间，未修改草稿重试
  使用原请求；修改草稿会生成新请求。成功后才清空表单。它不是持久化草稿系统。

证据：

1. 原失败测试保留 rejection、失败后两个切片引用不变和不调用分离写入的断言。
   mock 的成功返回值更新为新增 port 的真实确认合同；UUID 后续返回另一值、时钟
   推进一分钟后仍验证重试参数相同，避免原来固定 UUID 掩盖重新生成 ID。
2. 新增实际 UI → domain 排队测试：原子请求未确认时没有任何状态提交；成功后
   nodes/metadata 同时发布，再执行排队的模式变更，lastAddedAt 和轮次不丢失。
3. 第二个排队的严格模式创建读取前一次已提交状态并拒绝，不绕过每日限制。
4. 使用真实 local adapter，在拆分提交的 metadata 写入处注入中断：UI 两个切片和
   草稿不动；journal 保留，重试恢复完整数据，无重复节点，并清理 journal。
5. RPC 测试验证 response lost 重试、服务端权威字段、日期映射、缺 RPC、权限错误、
   未登录和畸形确认。缺 RPC/权限失败不回退到两个独立表写入。
6. 真实 Supabase SDK + MSW 模拟已提交但丢失响应，再次请求返回同一节点，读回
   nodes/meta 与确认一致。两层 AppShell 接线分别验证使用专用 create action。

**接受**接线和所有权收拢。原有 UI 的模式/连续打开/失败更新测试改为经过真实
metadata domain，仍检查持久化结果；两项依赖“先提交节点再写 meta”的旧测试分别
被原子失败与排队回归替代，没有放宽 rejection 或每日限制。

**边界**：本地 localStorage 不是数据库事务；raw key 写入可能中断，现有读取入口
先恢复 journal，domain 不发布半份状态。本轮未声称跨标签页或跨设备隔离。SQL
migration、RLS、journal 格式和旧 bulk-save 缺列兼容路径均未改；云端部署需要已有
`20260716000000_add_atomic_rsip_intents.sql`。未向任何数据库应用迁移。

库恢复、整树替换及违例归档仍走原有链路，未在本轮改写其跨集合事务；不能把表单
创建通过扩大解释为所有 RSIP 持久化均已原子化。

## E2：让 effect 拥有 debounce，保留搜索复用

修改前新增四项真实 hook 回归，**3 失败 / 1 通过**：

| 场景                              | 基线                              | 修改后               |
| --------------------------------- | --------------------------------- | -------------------- |
| debounce 期间清空 query           | 旧查询覆盖按 usage 排序的全量列表 | 保持全量排序和空高亮 |
| debounce 期间清空规则             | 已删除规则再次出现                | 保持空列表           |
| 卸载                              | 留下 pending timer                | 取消任务             |
| 快速查询、等长度替换/重命名、高亮 | 通过                              | 继续通过             |

计时器移到 `useRuleSearchResults` 的 effect，依赖变更和卸载使用 cleanup 取消。
删除 optimizer 的 timer 字段、延迟常量和 callback API；空查询直接使用现有
`searchRules` 的 usage 排序，删除第二套排序映射。索引、revision、结果缓存、搜索
建议与评分算法保留。旧两个 optimizer timer 测试退休，新增四个实际 hook 测试；
两个 dialog 测试去掉 optimizer mock，运行真实搜索实现。相关八文件 **93 项通过**。

### 创建重复扫描探针

没有可用的真实用户规则数量/查询分布，因此只报告合成压力测量。没有访问个人
浏览器数据，也没有引入遥测或新的持久化缓存。

临时 Vitest 探针使用真实 localPreferences、RulePersistence 和已初始化 manager。
输入为 10/100/1,000/10,000 条合法 chain-scoped 规则，名称为 `Focus break`、空格和
五位序号，usageCount 为 i % 10，日期为 2026-01-01。每次在计时前恢复相同序列化
规则库，然后创建不冲突的 `Hydration pause`。比较生产中的预检查加创建，与仅调用
创建；不包含首次初始化成本或 UI 渲染。以 hrtime 计时，5 次热身后采样 20 次，排序
后取第 11 项为 median、第 19 项为 p95。spy 只计真实 loadRules 调用，不替换读取。

| 规则数 | 预检查 + 创建 ms（median / p95） | 仅创建 ms（median / p95） | 全库读取次数 |
| ------ | -------------------------------: | ------------------------: | ------------ |
| 10     |                    0.093 / 0.143 |             0.051 / 0.072 | 3 → 2        |
| 100    |                    0.597 / 1.008 |             0.374 / 0.463 | 3 → 2        |
| 1,000  |                    6.524 / 6.701 |             3.750 / 4.227 | 3 → 2        |
| 10,000 |                  72.903 / 74.277 |           44.607 / 45.546 | 3 → 2        |

**保留生产预检查**：focus-mode 根据 suggestions 选择 use_existing / modify_name /
create_anyway；直接删除会改变重复创建行为。这里只量到无冲突路径的节省，没有
证明带冲突的等价替代。存储最终重复检查也不能因上层先检查就取消。

搜索索引和结果缓存继续沿用第三轮的测量结论，没有重复把删缓存当作优化。
探针与原始摘要保存在本机 `/tmp/momentum-round4-probe.test.ts` 和
`/tmp/momentum-round4-probe.log`，不纳入常驻测试/工具。探针暂在源码中时 test-lint
正确报无断言；移出后完整 test-lint 通过，没有加 ignore 或伪断言。

## E3：删除导入 setter 的初始化协议

生产消费者是 import/export modal 与规则管理页导出。原服务的两个 nullable 字段
由 manager.initialize 设置，但 manager.importRules 本身并不等待 initialize。
冷启动导入 updateExisting 的真实测试，修改前返回 `Rule name already exists`，
**1 失败 / 1 通过**；不是单纯的 mock 调用顺序问题。

导入直接依赖已有 RuleCreator 与 RuleMaintenanceService，删除两个字段、两个
setter、未初始化时绕到 storage 的备用创建路径和 manager 配置语句。现在冷启动
与初始化后使用相同的验证、重复处理和错误合同。冷启动更新、skip、无效条目隔离、
成功创建及导出统计通过；相关创建/恢复/管理 UI 共 **10 文件 / 82 项通过**。

**接受**删除此初始化协议。未删除诊断评分、统计 API 或整个恢复体系：
initializeRuleSystem 由 AppShell lifecycle 调用健康检查并消费 report；RuleCreator
与 focus-mode 调用实际恢复入口。调用可达不等于每个评分/恢复策略都有价值，但不足以
据此整套删除。要继续消融，应分别验证修复后的数据和使用成功率，而非只数 class。

## 结构成本与验证

沿用第三轮口径：生产 TS/TSX 含声明及生成数据库类型，排除 test、**tests**、fixtures、
`.test.`/`.spec.`；LOC 含空行注释、去末尾空白；class/interface 计 AST declaration。
基线读取 HEAD，结果读取工作区。

| 指标              |   Before |    After |  差值 |
| ----------------- | -------: | -------: | ----: |
| 生产 LOC          |   60,835 |   60,852 |   +17 |
| 生产文件          |      650 |      650 |     0 |
| class / interface | 71 / 426 | 71 / 426 | 0 / 0 |
| 测试与辅助 LOC    |   54,629 |   54,996 |  +367 |
| 测试与辅助文件    |      267 |      269 |    +2 |

生产增量：E1 +90、E2 -28、E3 -45。没有追求净删除量；增加的是原子 port、云端调用、
返回值验证和重试身份，减少的是重复所有权及初始化状态。没有新 dependency、质量
工具、全局 registry、定时服务或 SQL migration，也没有修改任何测试/覆盖率门槛。

- 最终 `test:coverage`：**253 文件 / 1,862 项全部通过**，包含最终 250 文件 / 1,837
  项单测和 3 文件 / 25 项集成；原连续多轮失败的创建回归现已通过。
- fresh coverage：statements **81.02%**、branches **71.77%**、functions **80.43%**、
  lines **81.98%**，全部通过原门槛。基线因既有失败没有 fresh coverage，不宣称
  覆盖率提升。
- typecheck、全量 lint、architecture gate、Knip、test-lint、assertion 检查、
  mutation-scope gate、Web build 均通过。
- 未运行完整 mutation、真实 PostgreSQL/RLS、Rust/原生安装包或真机验证。
  MSW 验证 SDK/参数/响应合同，不执行 SQL，不是数据库隔离证明。
- 两项旧 UI 分步写入测试减少，domain-chain 增加 3 项、RPC 增加 4 项、搜索净增
  2 项、冷启动导入增加 2 项、AppShell 接线增加 2 项；单测净增 11，集成净增 1。

## 停止条件与下一步

本轮停止于三个有失败证据的修正：表单创建接入原子持久化、搜索任务跟随 effect
取消、导入不再依赖 setter 初始化。没有进一步机械删 class、缓存或诊断系统。

1. RSIP 下一步应独立评估库恢复/违例归档的原子链路及跨客户端并发；部署验收还需
   在目标测试数据库验证既有 RPC 的 tenant ownership、幂等重试和事务回滚。
2. 大规则库应先取得实际规模与查询分布。若确实有大库，优先合并“重复选择 + 创建”
   的扫描，保留最终写入校验，并以冲突场景的行为等价为验收条件。
3. 健康评分和恢复策略继续按有效修复证据逐项评估。本轮只证明导入 setter 协议
   有时序缺陷，未证明其他诊断全部必要或全部可删。

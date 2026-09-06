# Momentum 功能说明：对照当前代码、GitHub issues 与 Edmond 原文

Momentum 是一款把个人行为承诺转化为可记录、可执行、可复盘流程的自我管理应用。它围绕 Edmond 的两套方法构建：**CTDP 用任务链帮助启动并完成一次行动，RSIP 用国策树组织生活规则，逐步改善长期状态。** 任务群、例外规则、计时和历史记录支撑这两条主线；积分押注、签到、宠物则提供额外反馈。

本文核查日期为 **2026-09-06**，代码基准是当前工作区提交 [`9366759`](https://github.com/KenXiao1/momentum/commit/93667599e670b5c18f8349698df14f0be88fd6ff)。该提交标题包含回退操作，因此不能仅凭先前提交日志认定某项改动仍然存在。

核查采用三个不同层面的证据：

- **功能是否存在：**以当前页面入口、调用链和实际逻辑为准，不以 README 或旧功能文档为准。
- **功能为什么这样设计：**参考 Edmond《如何提高自制力？》的仓库更新版原文，尤其第 5—11、21—24 节。[原文更新版][edmond-local]
- **用户遇到什么问题：**读取 GitHub 开放及已关闭 issues，并核对相关评论。issue 中的建议、作者答复和关闭状态都不直接等于当前实现。

这里的“已实现”表示在当前代码中找到可达入口与处理逻辑，**不表示已对线上部署或所有设备完成实测**。本次工作是功能核查，没有运行应用或进行完整回归测试。知乎原链接本次返回 403，因此理论分析以仓库保存的更新版为依据，不能保证与知乎此刻的版本完全一致。[知乎原文][edmond-web]

## 1. 先理解两个核心概念

### CTDP：让一次行动具有可积累的承诺价值

Edmond 将 CTDP 称为“链式时延协议”，由三个机制组成：

| 原文机制 | 它解决的问题                                                       | Momentum 中的对应功能                                      |
| -------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| 神圣座位 | 为进入专注状态设置明确边界；每次成功增加链长，失败使当前链归零     | 神圣座位／触发动作、任务要求、专注会话、成功链长、失败判定 |
| 下必为例 | 避免用“仅此一次”反复削弱承诺；允许的例外应当成为今后同类情形的规则 | 例外规则的创建、保存和复用，区分暂停与提前完成             |
| 线性时延 | 将“现在就开始”的启动压力变成短时间后的承诺                         | 预约信号、预约倒计时、辅助链和预约失败裁决                 |

**CTDP 的链长累计成功执行的次数，不是连续打卡天数。** 原文允许两次主链任务之间间隔数天；约束的是触发标志后的行为。当前代码也在任务成功时增加 `currentStreak`，在失败时清零，而不是按每天有没有打开应用计算。[原文第 7、10 节][edmond-local]、[主链结算代码][completion]

原文中的一小时专注和十五分钟预约是示例。应用允许用户配置时长、触发动作和任务要求，不必把这两个数字当成固定产品规则。

### RSIP：组织规则的加入顺序，逐步改变生活状态

Edmond 将 RSIP 称为“递归稳态迭代协议”。一个“国策”是一条明确、可执行的生活规则；多个国策通过父子关系组成树。

它的核心是：先找到容易维持的小规则，让这些规则改善生活条件，再引入新的规则。如果某个节点维持不住，就撤回它及其依赖的后续节点，调整路径后重新尝试。根部逐渐留下低成本、稳定的规则，较难的规则则在条件成熟后加入。[原文第 21、23 节][edmond-local]

所以，“早睡早起”这样的目标本身不等于设计好的国策。更新版原文强调，要把它拆成具体的小规则，考察维护成本、相互作用和加入顺序；国策组、强化储备、崩塌后保留经验都是这个框架的扩展。[原文第 22—24 节][edmond-local]

## 2. CTDP：当前可以做什么

### 2.1 创建和维护任务链

用户可以创建、编辑、查看和删除任务链，并设置：

- 名称、任务描述、神圣座位或触发动作。
- 定时任务的专注时长，或无固定时长任务及其最小时长设置。
- 预约信号、预约时长、预约完成条件。
- 任务类型：基础、突击、侦查、指挥、特勤、工程、炊事。

这些“兵种”来自原文对不同工作内容的分类，如学习、搜集资料、制定计划、处理杂事和运动。代码为它们提供类型与展示支持；名称本身不意味着应用会自动识别行为或采取不同的系统限制。[任务类型与字段][chain-types]、[页面入口][app-shell]

### 2.2 预约，再进入专注

用户可以直接启动任务，也可以先预约。预约建立一个带截止时间的会话，以短暂延迟降低启动阻力；辅助链记录这一承诺。

取消预约会进入裁决流程。预约过期时，当前代码会播放声音、尝试发送系统通知，并设置辅助链裁决界面：用户可以判定失败，或记录允许此次情况的例外。辅助链失败清零的是辅助链计数。[预约逻辑][scheduling]、[预约裁决][auxiliary-rules]、[过期处理][cleanup]

这里的预约是**从当下起的一段倒计时承诺**，不能据此称为完整日历排程或周期提醒系统。预约计数及弹窗存在问题线索，见第 6 节。

### 2.3 专注计时、暂停、完成与失败

专注界面提供倒计时、无固定时长任务的正向计时、全屏、暂停与恢复，以及结束任务的操作。

- **暂停：**选择或创建适用的例外规则；支持配置暂停时长和自动恢复，也可手动恢复。
- **定时任务提前完成：**通过提前完成类型的例外规则进入完成流程。
- **无固定时长任务完成：**用户主动结束并提交完成信息；最小时长当前存在约束不完整的问题。
- **成功：**主链长度和累计完成次数增加，可填写本次完成描述与备注。
- **失败／主动中断：**当前主链长度归零，累计失败次数增加。

**归零不等于删除所有历史数据。** 当前实现保留累计统计，并将会话结果写入历史记录；归零的是当前连续成功链。[专注入口][focus]、[例外规则操作][exception-operations]、[结算与历史][session-completion]

### 2.4 例外规则与历史复盘

应用把暂停规则和提前完成规则分开处理，避免把“允许暂停去厕所”直接当成“允许结束整次任务”。预约链还有自己的例外记录。

任务详情展示成功、失败等统计、历史完成记录和例外信息。这些记录让用户知道链条如何增长、何时中断、任务实际做了什么。[详情视图][chain-detail]、[例外规则操作][exception-operations]

需要区分原文原则和软件操作：原文的“允许某种行为”不天然等于“本次任务已经完成”；应用提供的是暂停、提前完成等具体操作类型，用户仍需合理定义适用条件。这一点也曾在 [issue #9](https://github.com/KenXiao1/momentum/issues/9) 中被讨论。

## 3. 任务群：把多个任务组织成一轮行动

任务群用于组合若干任务单元，例如把资料检索、阅读、写作组织成一轮工作。当前功能包括：

- 创建任务群，在群内新建任务。
- 把已有任务**复制或移动**到群内。
- 调整单元顺序，设置单个任务重复次数和任务群重复次数。
- 展示群内进度，完成一轮时更新群完成计数。
- 设置任务群时间限制，并处理过期状态。

复制会产生新的任务 ID，并重置副本统计；移动则改变原任务的父级。**目前这两种操作不能等同于“多个任务群共享同一个外部任务并同步计数”。** [任务群操作][groups]、[任务数据结构][chain-types]、[群完成结算][completion]

原文第 11 节提出了任务单元、任务组、任务群、纵队等更深层级，且明确允许跨日组织。当前代码虽然存在树结构，但主页面入口和群完成处理不能证明任意深度嵌套都已完整支持。因此本文只确认任务群与子任务流程，不把原文全部层级玩法写成已实现功能。[原文第 11 节][edmond-local]、[嵌套讨论 #79](https://github.com/KenXiao1/momentum/issues/79)

## 4. RSIP：当前可以做什么

### 4.1 建立和查看国策树

用户可以创建带标题、精准规则、类型和图标的国策节点，选择父节点、所属国策组，标注被动国策，并选择是否配置计时器。

国策树提供画布展示、缩放与平移，并有调整父子关系的交互逻辑。界面还提供目标拆分工具和作息、运动、饮食等模板，帮助把大目标分成多个节点。[国策树入口][rsip-tree]、[创建与拆分][rsip-create]、[画布与交互][rsip-canvas]

“被动国策”在这里是数据标记，**不会自动创建手机自动化、封禁其他 App 或修改系统设置**。模板也是应用提供的示例，不应当作 Edmond 原文逐条推荐；例如内置作息模板与更新版原文的低成本拆分示例并不相同。[内置模板][rsip-templates]

### 4.2 自由模式与严格模式

- **自由模式：**允许一天添加多条国策。
- **严格模式：**普通新增入口按日期限制添加，并显示每日查看国策树提醒及执行追踪。

严格模式与原文每天最多加入一个国策的做法有关。但当前批量拆分和执行统计存在边界，不能称为“完整强制执行原协议”。[模式与日期判断][rsip-state]、[严格模式页面][rsip-tree]

### 4.3 记录执行、违规与阶段

用户可以标记国策已执行或已违反。执行记录进入统计，界面显示累计执行、连续执行及阶段进度。

当前应用用 E0、E1、E2 表示新建、稳定、内化阶段，代码在执行计数达到 7 和 21 的门槛时推进阶段。**这是软件自己的量化规则，不是对一个人是否已形成习惯的客观测量，也不能把它当成原文要求的固定天数。** 当前计数并未严格按不同日期去重，详见第 6 节。[执行与阶段代码][rsip-node]

### 4.4 违规回退、国策库与轮次历史

没有强化保护时，违规处理会移除目标节点及其后代；被移除的国策归档到国策库。国策库保留规则和累计执行等信息，支持恢复到树中继续尝试。

发生符合条件的崩塌时，系统记录轮次、持续时间、节点规模和崩塌原因，进入下一轮。这对应更新版原文“失败后保留积累、调整路径、重新探索”的思路。**国策库用于规则重建，任务链回收箱用于恢复删除的数据，两者用途不同。** [违规处理][rsip-node]、[国策库][rsip-library]、[轮次记录][rsip-runs]

### 4.5 强化储备与国策组

两项功能已经有入口与逻辑，但需要准确描述其成熟度：

| 功能     | 当前实现                                                           | 与原文或用户期待的距离                                                            |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 国策强化 | E2 节点可手动强化；违规时先扣一层强化，保留节点                    | 尚未看到按等级配置不同执行标准的完整升级模型；例如从 9:00 起床逐级变成 8:30、8:00 |
| 国策组   | 可创建分组、设置容错值、关联节点；违规逻辑区分单节点损失和整组崩塌 | 容错计算存在缺口；分组也未形成原文中可作为其他节点父级的完整独立“大节点”模型      |

原文的升级示例包含规则要求的变化和释放冗余，当前强化主要表现为保护次数。国策组的实现问题也与用户反馈吻合。不能因为已有按钮就把这两项写成对原文的完整落地。[强化与容错代码][rsip-node]、[国策组类型][rsip-types]、[反馈 #115](https://github.com/KenXiao1/momentum/issues/115)、[升级需求 #116](https://github.com/KenXiao1/momentum/issues/116)

### 4.6 洞察与复盘建议

RSIP 提供活跃国策数、近 14 天成功率、被动国策和强化覆盖率、轮次趋势等统计，并给出拆分、分组、优先尝试低成本规则等建议。

这些建议来自本地规则计算和已有记录，不代表应用已经接入能自动分析个人生活的 AI 教练。[洞察面板][rsip-insights]、[建议计算][rsip-recommend]

## 5. 两套系统的联动，以及配套功能

### 5.1 任务与国策双向联动

用户可以将任务单元或任务群与国策关联，设置事件及效果：

| 方向        | 可配置行为                                                       |
| ----------- | ---------------------------------------------------------------- |
| 任务 → 国策 | 任务完成、任务中断或任务群完成一轮时，标记关联国策已执行或已违反 |
| 国策 → 任务 | 标记国策已执行后，触发关联任务的启动或预约流程                   |

例如，可以把完成一次整理任务与某条环境整理国策关联，也可以用执行一条准备国策来触发后续专注任务。应用已有配置、事件订阅与执行处理，属于真实功能；但两个方向的确认行为并不一致，任务群还需要选对事件。[联动处理][rsip-links]、[国策到任务交互][rsip-actions]、[反馈 #118](https://github.com/KenXiao1/momentum/issues/118)

### 5.2 积分、签到与押注

云端模式提供每日签到、积分统计和可选的任务押注：用户拿应用内积分对任务完成作出承诺，再由任务结果触发结算。具体奖励与扣分依赖云端逻辑和配置，本文不固定宣称某个倍率。

本地存储适配器不支持签到和押注。它们是应用增加的激励功能，不是 CTDP 主链或 RSIP 国策树工作的必要条件。[本地能力边界][local-storage]、[押注流程][betting]、[签到流程][checkin]

### 5.3 虚拟宠物

用户可以创建、命名和喂养宠物，查看饥饿、快乐、健康、经验与等级等状态。任务结果和时长参与奖励计算，时间流逝影响状态；宠物还支持位置、显示和收起控制。本地模式也能保存宠物。[宠物领域逻辑][pet]

### 5.4 本地保存与云端保存

- **本地模式：**无需登录，使用设备或浏览器本地存储，可承载任务链、国策树、历史、宠物等核心数据。
- **云端模式：**配置 Supabase 后提供账号登录和云端保存，以支持跨设备访问同一账号的数据。
- **默认模式有平台差异：**Tauri 默认倾向本地并参考保存的选择；Web 在已配置 Supabase 时默认选择云端。

因此，“必须配置 Supabase 才能本地使用”不符合当前实现。模式切换本身也不应被描述成已经完成所有数据的双向迁移和冲突合并。[存储模式实现][storage-context]、[配置疑问 #122](https://github.com/KenXiao1/momentum/issues/122)

### 5.5 JSON 导入导出与回收箱

导出格式目前为 3.0，可承载任务链和统计、完成历史、RSIP 节点及扩展记录、联动关系、宠物和例外规则。导入支持选择保留统计、保留时间戳、导入历史，并为导入任务生成新 ID、处理关联关系。

导入不是简单覆盖整套数据库：任务通常以新 ID 加入，而宠物状态可以覆盖导入；导出结构也不是积分账本或运行中会话的完整数据库备份。另有一个入口限制：没有任务链时，导出按钮会禁用，即使用户可能已有国策或宠物数据。[导出数据结构][export-service]、[导入处理][import-domain]、[导出按钮][export-ui]

删除的任务链可以进入回收箱，支持恢复和永久删除。RSIP 违规移除的节点应查看国策库，而不是任务回收箱。[回收箱逻辑][recycle]

### 5.6 平台、显示与通知

项目包含 Web/PWA 配置、Tauri 桌面及移动平台适配，提供中英文界面、明暗主题、通知开关、文件操作与全屏等功能。代码中有移动平台分支，不等于已核实所有移动安装包均发布且体验相同。[应用入口][app-shell]、[PWA 配置][vite]、[平台适配][platform]

主题当前为手动明／暗切换，首次没有明确偏好时参考系统主题；代码未提供持续监听系统变化的第三种“跟随系统”模式。[主题实现][theme]

## 6. 当前边界：哪些表述需要降级

以下分为“代码可直接确认的边界”和“尚未在本次核查中复现的用户报告”。它们用于限定功能说明，不是本次已修复的清单。

### 6.1 代码可直接确认的边界

| 项目                      | 核查结果及其影响                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 无固定时长任务的最小时长  | 设置和进度提示存在，但结束按钮处理只判断是否为无固定时长任务，随后直接打开完成框，没有检查是否达到最小时长。不能称为已强制执行的下限。[代码][focus]                                                                        |
| 预约辅助链计数            | 创建预约与手动完成预约两个处理函数都增加辅助链计数，存在一轮预约累计两次的路径，与 #72 的报告相符。这里确认的是代码路径，并非本次现场复现。[代码][scheduling]、[issue #72](https://github.com/KenXiao1/momentum/issues/72) |
| RSIP 执行“天数”           | 普通执行操作每次递增，未校验是否同一天已记过，也未按日期间隔维护真正的连续天数。已有并发提交保护不等于每天只记一次。[代码][rsip-node]、[issue #115](https://github.com/KenXiao1/momentum/issues/115)                       |
| 严格模式每日新增上限      | 单条新增有日期判断，但目标拆分提交会一次加入多个有效条目；不能宣称所有入口都严格执行每天一个节点。[代码][rsip-create]                                                                                                      |
| 国策组容错                | 每次按当前存活成员数重新计算阈值，没有固定原始成员基数或累计消耗名额。按现有公式，容错值至少为 1 时，逐个失去成员会持续进入单节点损失分支，无法表达固定的“最多损失一个成员”。[代码][rsip-node]                             |
| “需确认”的任务 → 国策联动 | 处理函数直接执行国策变更，没有检查配置中的确认选项；反向的国策 → 任务交互则有确认判断。不能统一描述为两端都先确认。[任务方向][rsip-links]、[国策方向][rsip-actions]                                                        |
| 完整国策升级              | 现有类型保存强化等级等字段，没有按等级设置不同时间、数量或规则内容的完整结构；强化保护已经存在，参数化升级仍是需求。[类型][rsip-types]、[issue #116](https://github.com/KenXiao1/momentum/issues/116)                      |

### 6.2 仍开放的用户反馈

以下状态来自本次 GitHub 查询。报告发生时的部署、设备和当前本地代码可能不同，**开放不等于当前必现，关闭也不等于修复已验证**。

| Issue                                                                                                                                                 | 报告或最近更新日期     | 对功能说明的影响                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| [#123：bug反馈](https://github.com/KenXiao1/momentum/issues/123)                                                                                      | 2026-07-17             | 报告国策节点无法创建、任务完成描述的中文输入异常；相关功能有实现，但不能承诺线上当前无故障 |
| [#121：网页端预约超时无判断界面](https://github.com/KenXiao1/momentum/issues/121)                                                                     | 2026-05-21             | 通知和裁决逻辑存在，但用户报告只响铃，没有弹出裁决                                         |
| [#118：任务与任务—国策联动反馈](https://github.com/KenXiao1/momentum/issues/118)                                                                      | 2026-05-15             | 涉及最小时长保存、确认缺失、联动丢失；评论还报告桌面导出及任务群事件选择问题               |
| [#115：国策树反馈与建议](https://github.com/KenXiao1/momentum/issues/115)                                                                             | 2026-03-09             | 指出执行重复计数、容错、分组管理和国策库管理不足；其中一些可以在现有代码找到对应原因       |
| [#114：没有启动任务，赌注失败](https://github.com/KenXiao1/momentum/issues/114)                                                                       | 2026-03-09             | 押注功能存在，但启动与结算的衔接有未关闭报告                                               |
| [#119：Android Edge 滚动问题](https://github.com/KenXiao1/momentum/issues/119)、[#117：触屏编辑问题](https://github.com/KenXiao1/momentum/issues/117) | 2026-05-20／2026-04-08 | 移动浏览器支持不能简单等同于已完成所有触控兼容验证                                         |

还有两个值得说明的证据陷阱：

- [#64](https://github.com/KenXiao1/momentum/issues/64)、[#65](https://github.com/KenXiao1/momentum/issues/65) 的早期建议涉及正计时、完成备注、规则分类和国策树展示；当前已能找到多项对应实现，不能把整份旧建议照搬成待开发清单。
- [#113](https://github.com/KenXiao1/momentum/issues/113) 关于模式切换丢失规则的 issue，提交者后来明确撤回。它不能作为“已确认的数据丢失缺陷”，也不能因关闭就算作“已修复”。

## 7. 用一个例子理解完整用途

假设用户希望更容易开始写作，同时改善回家后一直刷手机的状态：

1. **建立写作任务链：**定义开始仪式、具体任务和专注时长，每完成一次增长主链。
2. **用预约降低启动阻力：**先执行预约信号，承诺在设定窗口内开始写作。
3. **用规则处理真实中断：**需要短暂离开时使用合适的暂停例外；如果承诺失败，就如实记录链条中断。
4. **用任务群组织工作：**将检索资料、阅读、写作按需要组合，并设置重复次数。
5. **用国策树改变前置条件：**从容易维持的准备规则开始，逐步建立更有利于写作的生活条件，而不是一开始塞入大量高要求目标。
6. **按需要关联任务与国策：**让完成任务参与执行记录，或用执行国策触发任务；使用时考虑前述联动确认边界。
7. **依据记录调整：**从历史和国策轮次中看出哪些安排容易失败，降低成本、换顺序，再尝试。

这就是 Momentum 的主要用途：把“开始行动—履行承诺—处理例外—记录结果—调整长期规则”放进同一个应用。它对 Edmond 方法提供了相当多的操作支持，同时仍存在协议细节、统计口径和跨平台体验上的实现缺口。

[edmond-web]: https://www.zhihu.com/question/19888447/answer/1930799480401293785
[edmond-local]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/Edmond如何提高自制力原文更新版/如何提高自制力？-edmond的回答.md
[app-shell]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/app/app-shell/AppShellView.tsx
[chain-types]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/types/chain.ts
[completion]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/sessions/completionState.ts
[session-completion]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/sessions/completion.ts
[scheduling]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/sessions/scheduling.ts
[auxiliary-rules]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/useRulesDomain.ts
[cleanup]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/app/hooks/usePeriodicCleanup.ts
[focus]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/focus-mode/FocusModeContainer.tsx#L110
[exception-operations]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/focus-mode/hooks/useExceptionRuleOperations.ts
[chain-detail]: https://github.com/KenXiao1/momentum/tree/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/chain-detail
[groups]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/useGroupDomain.ts
[rsip-tree]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/rsip/RSIPTreeTab.tsx
[rsip-create]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/rsip/hooks/useRSIPViewCreationActions.ts
[rsip-canvas]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/rsip/RSIPCanvasContainer.tsx
[rsip-state]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/rsip/hooks/useRSIPViewState.ts
[rsip-templates]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/rsip/rsipViewHelpers.ts
[rsip-node]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/rsip/nodeOperations.ts
[rsip-types]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/types/rsip.ts
[rsip-library]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/rsip/libraryOperations.ts
[rsip-runs]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/rsip/runOperations.ts
[rsip-insights]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/rsip/RSIPInsightsPanel.tsx
[rsip-recommend]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/services/rsip-insights/rsipRecommender.ts
[rsip-links]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/rsip/taskLinkOperations.ts
[rsip-actions]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/rsip/hooks/useRSIPViewInteractionActions.ts
[local-storage]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/storage/localStorageAdapter.ts
[storage-context]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/storage/StorageContext.tsx
[betting]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/useBettingDomain.ts
[checkin]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/useCheckinDomain.ts
[pet]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/usePetDomain.ts
[export-service]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/services/import-export/ExportService.ts
[export-ui]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/import-export-modal/ExportTab.tsx#L58
[import-domain]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/hooks/domains/useImportExportDomain.ts
[recycle]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/services/RecycleBinService.ts
[vite]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/vite.config.ts
[platform]: https://github.com/KenXiao1/momentum/tree/93667599e670b5c18f8349698df14f0be88fd6ff/src/utils/platform-adapters
[theme]: https://github.com/KenXiao1/momentum/blob/93667599e670b5c18f8349698df14f0be88fd6ff/src/components/ThemeToggle.tsx

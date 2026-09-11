# Momentum testing guide

## Automated tests

Choose a suite for the behavior being changed. Append a test path or `-t` filter
for focused runs; the config files own exact discovery patterns.

| Command                          | Scope                                                       | Configuration                  |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `npm test` / `npm run test:all`  | Same unit suite; excludes integration and performance tests | `vitest.config.ts`             |
| `npm run test:integration`       | Storage/API integration                                     | `vitest.integration.config.ts` |
| `npm run test:performance`       | Timing and performance scenarios                            | `vitest.performance.config.ts` |
| `npm run test:coverage`          | Unit + integration, all production TS/TSX                   | `vitest.coverage.config.ts`    |
| `npm run test:mutation:critical` | Focused mutation checks                                     | `stryker.critical.config.mjs`  |
| `npm run test:mutation`          | Broader mutation scope                                      | `stryker.config.mjs`           |
| `npm run test:rust`              | Rust tests with the desktop feature                         | `src-tauri/Cargo.toml`         |

Unit tests use `src/test/setup.ts` with independent native JSDOM local/session
storage and suppressed console output. Tests live next to source or in
`__tests__/`; integration and performance suites use their respective
`.integration.test.*` / `.performance.test.*` suffixes.

Integration setup in `src/test/setup.integration.ts` runs the real Supabase
storage, API, mapper, and SDK against MSW HTTP handlers in
`src/test/mocks/supabaseMocks.ts`. Unhandled requests fail. Extend the handlers
for new REST/RPC calls; fake timers are opt-in and the setup restores real timers.
These tests do not execute database SQL or validate deployed RLS policies.

Mock external boundaries in behavior tests. A composition test can replace a
local collaborator that has its own behavior coverage. Direct replacement of
the subject under test and tautological assertions are checked by
`quality:test:assertions`; test-runner and Testing Library rules live in
`eslint.tests.config.js`.

## CI and diagnostics

[CI](../../.github/workflows/ci.yml) runs `quality:ci:required`: formatting,
lint/type/import checks, Knip, test validation, unit + integration coverage,
Rust checks, and the web build. The exact roster is in `package.json`;
coverage thresholds live in `vitest.coverage.config.ts`.
`quality:test:coverage-hotspots` verifies report freshness and reports source inclusion,
then ranks uncovered behavior. It consumes the preceding coverage run.

[Scheduled mutation CI](../../.github/workflows/mutation-nightly.yml) runs both
critical and broader mutation checks, with report freshness validation. The
critical scope and score requirement remain in `tools/quality/mutation-scope.mjs`.
Mutation runs are also available on demand; they are not required for every local
edit or every pull request.

`quality:ci:info` collects optional diagnostics; `quality:smell-audit` collects
Knip, duplication, and full SonarJS reports. Their summaries record failures
without blocking the lane. Full SonarJS/duplication findings are advisory;
production ESLint still enforces its configured errors. Cycle detection belongs
to Dependency Cruiser. File length, import counts, comment counts, and cast totals
are not architecture gates.

Security scanning has separate Semgrep, CodeQL, and Gitleaks workflows.
Local verification examples are in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Manual testing

The scenarios below help verify affected product flows; they are not a checklist
for every change.

## 测试前准备

### 环境要求

- Node.js：使用 `.nvmrc`，支持版本见 `package.json`
- 现代浏览器（Chrome/Firefox/Edge）
- 可选：Supabase 账户（测试云同步）

### 启动应用

### P0–P3 Regression Checks (Manual)

- Skip link: press `Tab` right after load, then `Enter` on “Skip to main content” → focus lands in main content (`main`).
- URL reflects state: navigate between Dashboard / RSIP / Detail / Group / Editor, then use browser Back/Forward → view follows URL.
- Deep link examples:
  - `?view=rsip`
  - `?view=detail&chain=<id>`
  - `?view=group&chain=<id>`
  - `?view=editor&edit=<id>`
  - `?view=editor&parent=<id>`

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`

---

## 测试检查清单

### 模块 1：用户认证

| 测试项       | 操作步骤              | 预期结果                 | 通过 |
| ------------ | --------------------- | ------------------------ | ---- |
| 1.1 本地模式 | 选择本地模式后使用    | 无需登录，数据存储在本地 | [ ]  |
| 1.2 注册     | 点击登录 → 注册新账户 | 收到验证邮件             | [ ]  |
| 1.3 登录     | 输入邮箱密码登录      | 成功进入主界面           | [ ]  |
| 1.4 登出     | 点击设置 → 登出       | 返回登录页               | [ ]  |
| 1.5 数据同步 | 登录后查看数据        | 云端数据正确加载         | [ ]  |

---

### 模块 2：任务链管理

| 测试项         | 操作步骤                               | 预期结果                 | 通过 |
| -------------- | -------------------------------------- | ------------------------ | ---- |
| 2.1 创建链条   | 点击"+"→ 填写名称、触发器、时长 → 保存 | 链条出现在列表           | [ ]  |
| 2.2 编辑链条   | 点击链条 → 编辑 → 修改属性 → 保存      | 属性已更新               | [ ]  |
| 2.3 复制链条   | 点击链条 → 复制                        | 新链条出现，名称带"副本" | [ ]  |
| 2.4 删除链条   | 点击链条 → 删除                        | 链条移至回收箱           | [ ]  |
| 2.5 无时长任务 | 创建时长为0的链条                      | 显示正向计时器           | [ ]  |
| 2.6 链条类型   | 创建不同类型链条                       | 类型图标正确显示         | [ ]  |

---

### 模块 3：会话执行

| 测试项       | 操作步骤                       | 预期结果               | 通过 |
| ------------ | ------------------------------ | ---------------------- | ---- |
| 3.1 预约任务 | 点击链条 → 预约 → 设置辅助信号 | 预约成功，显示倒计时   | [ ]  |
| 3.2 开始任务 | 点击"开始"                     | 进入专注模式，计时开始 | [ ]  |
| 3.3 暂停任务 | 执行中点击"暂停"               | 计时暂停，显示暂停状态 | [ ]  |
| 3.4 恢复任务 | 暂停后点击"恢复"               | 计时继续               | [ ]  |
| 3.5 完成任务 | 计时结束或手动完成             | 显示完成，连击+1       | [ ]  |
| 3.6 中断任务 | 点击"中断"                     | 任务失败，连击归零     | [ ]  |
| 3.7 正向计时 | 执行无时长任务                 | 显示已用时间，手动完成 | [ ]  |

---

### 模块 4：任务组

| 测试项           | 操作步骤                    | 预期结果         | 通过 |
| ---------------- | --------------------------- | ---------------- | ---- |
| 4.1 创建任务组   | 点击"新建任务组" → 填写名称 | 任务组创建成功   | [ ]  |
| 4.2 导入单元     | 编辑组 → 导入现有链条       | 链条添加到组     | [ ]  |
| 4.3 设置重复次数 | 编辑单元 → 设置重复次数     | 重复次数已保存   | [ ]  |
| 4.4 顺序执行     | 开始执行任务组              | 按顺序执行各任务 | [ ]  |
| 4.5 自动推进     | 完成当前任务                | 自动开始下一任务 | [ ]  |
| 4.6 时间限制     | 设置组时间限制              | 超时后组执行结束 | [ ]  |

---

### 模块 5：RSIP 规则系统

| 测试项         | 操作步骤                  | 预期结果           | 通过 |
| -------------- | ------------------------- | ------------------ | ---- |
| 5.1 添加规则   | 点击"添加规则" → 输入内容 | 规则出现在树中     | [ ]  |
| 5.2 添加子规则 | 选择父规则 → 添加子规则   | 子规则正确嵌套     | [ ]  |
| 5.3 标记执行   | 点击规则 → 标记已执行     | 执行次数+1         | [ ]  |
| 5.4 标记违规   | 点击规则 → 标记违规       | 规则及子规则被删除 | [ ]  |
| 5.5 阶段进化   | 连续执行7天               | E0 → E1 阶段变化   | [ ]  |
| 5.6 模式切换   | 切换自由/严格模式         | 模式正确切换       | [ ]  |

---

### 模块 6：例外规则

| 测试项               | 操作步骤                       | 预期结果               | 通过 |
| -------------------- | ------------------------------ | ---------------------- | ---- |
| 6.1 创建暂停规则     | 设置 → 例外规则 → 新建暂停规则 | 规则创建成功           | [ ]  |
| 6.2 创建提前完成规则 | 新建提前完成规则               | 规则创建成功           | [ ]  |
| 6.3 应用暂停规则     | 任务执行中 → 应用暂停规则      | 任务暂停，显示剩余时间 | [ ]  |
| 6.4 自动恢复         | 暂停时间结束                   | 任务自动恢复           | [ ]  |
| 6.5 规则统计         | 查看规则使用统计               | 显示使用次数           | [ ]  |

---

### 模块 7：赌注系统

| 测试项           | 操作步骤                  | 预期结果     | 通过 |
| ---------------- | ------------------------- | ------------ | ---- |
| 7.1 开启赌博模式 | 设置 → 开启赌博模式       | 模式已开启   | [ ]  |
| 7.2 下注         | 任务开始前 → 输入下注金额 | 下注成功     | [ ]  |
| 7.3 赢得赌注     | 完成任务                  | 获得2倍回报  | [ ]  |
| 7.4 输掉赌注     | 中断任务                  | 失去下注金额 | [ ]  |
| 7.5 下注历史     | 查看下注历史              | 显示历史记录 | [ ]  |
| 7.6 每日限额     | 超过每日限额下注          | 提示已达限额 | [ ]  |

---

### 模块 8：电子宠物

| 测试项       | 操作步骤            | 预期结果         | 通过 |
| ------------ | ------------------- | ---------------- | ---- |
| 8.1 领养宠物 | 首次使用 → 领养宠物 | 宠物出现在右下角 | [ ]  |
| 8.2 喂养宠物 | 点击宠物 → 喂养     | 饥饿值增加       | [ ]  |
| 8.3 任务奖励 | 完成任务            | 宠物获得经验     | [ ]  |
| 8.4 属性衰减 | 长时间不操作        | 属性逐渐下降     | [ ]  |
| 8.5 移动宠物 | 拖拽宠物小部件      | 位置可自由移动   | [ ]  |
| 8.6 最小化   | 点击最小化按钮      | 宠物收起         | [ ]  |

---

### 模块 9：每日签到

| 测试项       | 操作步骤       | 预期结果     | 通过 |
| ------------ | -------------- | ------------ | ---- |
| 9.1 签到     | 点击签到按钮   | 获得积分奖励 | [ ]  |
| 9.2 重复签到 | 同一天再次签到 | 提示已签到   | [ ]  |
| 9.3 连续签到 | 连续多天签到   | 连击数增加   | [ ]  |
| 9.4 签到历史 | 查看签到历史   | 显示历史记录 | [ ]  |

---

### 模块 10：回收箱

| 测试项          | 操作步骤            | 预期结果       | 通过 |
| --------------- | ------------------- | -------------- | ---- |
| 10.1 查看回收箱 | 设置 → 回收箱       | 显示已删除项目 | [ ]  |
| 10.2 恢复链条   | 选择链条 → 恢复     | 链条回到主列表 | [ ]  |
| 10.3 永久删除   | 选择链条 → 永久删除 | 链条彻底删除   | [ ]  |

---

### 模块 11：导入导出

| 测试项        | 操作步骤               | 预期结果         | 通过 |
| ------------- | ---------------------- | ---------------- | ---- |
| 11.1 导出数据 | 设置 → 导出            | 下载 JSON 文件   | [ ]  |
| 11.2 导入数据 | 设置 → 导入 → 选择文件 | 数据正确导入     | [ ]  |
| 11.3 冲突处理 | 导入有冲突的数据       | 提示冲突解决选项 | [ ]  |

---

### 模块 12：UI/UX 通用测试

| 测试项             | 操作步骤           | 预期结果         | 通过 |
| ------------------ | ------------------ | ---------------- | ---- |
| 12.1 响应式布局    | 调整浏览器窗口大小 | 布局自适应       | [ ]  |
| 12.2 深色/浅色主题 | 切换系统主题       | 界面主题跟随     | [ ]  |
| 12.3 加载状态      | 执行耗时操作       | 显示加载指示器   | [ ]  |
| 12.4 错误提示      | 触发错误操作       | 显示友好错误提示 | [ ]  |
| 12.5 键盘导航      | 使用Tab键导航      | 焦点正确移动     | [ ]  |

---

### 模块 13：Tauri 本地/云端模式切换（v0.3.2）

| 测试项               | 操作步骤                                               | 预期结果                                       | 通过 |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------- | ---- |
| 13.1 首启默认本地    | 首次启动 Tauri（已配置 Supabase）                      | 进入本地模式，出现一次模式提示卡               | [ ]  |
| 13.2 首启连云端      | 在提示卡点击“连接云端同步”                             | 模式切到 Supabase，进入登录流程                | [ ]  |
| 13.3 首启继续本地    | 在提示卡点击“继续本地模式”                             | 持久化为本地，提示卡不再出现                   | [ ]  |
| 13.4 登录页回本地    | 在 Intro/Auth 页面点击“切换到本地模式”                 | 无需登录直接回到本地可用状态                   | [ ]  |
| 13.5 设置页反复切换  | 在设置页反复切换 Local/Cloud                           | 应用稳定，无崩溃；仅切换数据源，不自动合并     | [ ]  |
| 13.6 未配置 Supabase | 在未配置 `VITE_SUPABASE_URL/ANON_KEY` 的包中打开设置页 | 云端入口禁用并显示说明文案，本地模式可正常使用 | [ ]  |
| 13.7 宠物数据策略    | 在两种模式切换后检查宠物状态                           | 宠物数据仍在本机，未发生跨端同步               | [ ]  |

---

## 边界情况测试

| 测试项      | 操作步骤           | 预期结果       | 通过 |
| ----------- | ------------------ | -------------- | ---- |
| E1 空数据   | 清空所有数据后使用 | 显示空状态提示 | [ ]  |
| E2 长文本   | 输入超长名称/描述  | 正确截断或滚动 | [ ]  |
| E3 特殊字符 | 输入特殊字符       | 正确处理不报错 | [ ]  |
| E4 网络断开 | 断网后操作         | 显示离线提示   | [ ]  |
| E5 并发操作 | 快速连续点击       | 不产生重复数据 | [ ]  |

---

## 测试报告模板

```
测试日期：____年__月__日
测试人员：__________
测试环境：浏览器______ 版本______

总测试项：____ 项
通过：____ 项
失败：____ 项
跳过：____ 项

失败项详情：
1. 测试项编号：____
   问题描述：
   复现步骤：
   截图/录屏：

备注：
```

---

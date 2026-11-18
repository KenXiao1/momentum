# 异常规则模块（Exception Rules）

## 目标与范围

异常规则模块用于管理「任务执行时的例外情况处理规则」，提供：

- 规则的创建/编辑/删除
- 重名检测与相似名称提示
- 使用记录
- 启动时修复存量数据

## 入口文件

- 服务：`src/services/ExceptionRuleManager.ts`，单例 `exceptionRuleManager`
- 规则管理页：`src/components/RuleManagerView.tsx`，从首页顶栏打开
- 专注模式：`src/components/focus-mode/hooks/useExceptionRuleOperations.ts`
- 规则选择对话框：`src/components/RuleSelectionDialog.tsx`

## 依赖方向（模块边界）

依赖方向：

UI → `exceptionRuleManager` → `src/domain/rules.ts`（纯函数）+ `RuleStore`（`src/storage/localRuleStore.ts`）

约束：

- UI 不直接读写 localStorage / Supabase / 具体存储实现
- UI 不直接调用 `RuleStore`，只通过 `exceptionRuleManager`
- 规则判断写成 `src/domain/rules.ts` 里的纯函数，不分散到 UI

## 相关实现位置（快速定位）

- 规则判断与数据修复：`src/domain/rules.ts`
- 存储端口：`src/storage/ports.ts` 中的 `RuleStore`；实现：`src/storage/localRuleStore.ts`
- 管理器：`src/services/exception-rule-manager/ExceptionRuleManager.ts`

## 修改清单（新增/调整功能时）

1. 先确认入口：是 UI、领域 Hook，还是 service 的职责
2. 新增字段/结构变更：同步更新 `src/types`、mappers（如有）、以及 import/export 兼容逻辑
3. 引入新存储能力：保持 UI 不直连，优先扩展 `ExceptionRuleManager`/领域 Hook
4. 补测试：纯函数在 `src/domain/__tests__/`，管理器行为用 `src/test/fakes/memoryRuleStore.ts` 测；UI 流程补 `e2e/core-flows.spec.ts`

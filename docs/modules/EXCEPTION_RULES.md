# 异常规则模块（Exception Rules）

## 目标与范围

异常规则模块用于管理「任务执行时的例外情况处理规则」，提供：

- 规则的创建/编辑/删除/归档
- 重名与重复规则检测（含增强校验/建议）
- 使用记录与统计（usage tracking）
- 数据完整性检查与自动修复（dev/恢复链路）

## 入口文件

- 服务（业务层）：`src/services/ExceptionRuleManager.ts`
  - 对外暴露：`ExceptionRuleManager` / 单例 `exceptionRuleManager`
- UI（视图层）：`src/components/RuleManagerView.tsx`（原 `ExceptionRuleManager.tsx`）
- 领域 Hook（建议入口）：`src/hooks/domains/useRulesDomain.ts`

## 依赖方向（模块边界）

推荐依赖方向：

`RuleManagerView` → `useRulesDomain` → `ExceptionRuleManager` → `ExceptionRuleStorage`（以及其它 rule-\* 子服务）

约束：

- UI 不直接读写 localStorage / Supabase / 具体存储实现
- UI 不直接调用 `ExceptionRuleStorage`，只通过领域 Hook 或 `exceptionRuleManager`
- 规则相关的跨切面能力（重复检测/分类/统计/恢复）只在 services 层组合，不分散到 UI

## 相关实现位置（快速定位）

- 存储：`src/services/ExceptionRuleStorage.ts`（localStorage）
- 重复检测：`src/services/RuleDuplicationDetector.ts`、`src/services/EnhancedDuplicationHandler.ts`
- 完整性校验：`src/services/validateRulesIntegrity.ts`；执行校验：`src/services/rule-classification/ruleValidator.ts`
- 统计：`src/services/RuleUsageTracker.ts`
- 恢复：`src/services/ErrorRecoveryManager.ts`

## 修改清单（新增/调整功能时）

1. 先确认入口：是 UI、领域 Hook，还是 service 的职责
2. 新增字段/结构变更：同步更新 `src/types`、mappers（如有）、以及 import/export 兼容逻辑
3. 引入新存储能力：保持 UI 不直连，优先扩展 `ExceptionRuleManager`/领域 Hook
4. 补测试：优先 `src/services/__tests__/*`；UI 变更用 `src/__tests__/ui-fixes.test.tsx` 或组件内测试

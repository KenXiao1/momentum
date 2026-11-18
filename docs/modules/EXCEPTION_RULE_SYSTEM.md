# Exception Rule System 系统设计文档

本文档描述例外规则系统的内部结构、数据流和修改方法。领域行为见
[领域文档](../features/DOMAIN_RULES.md)。

---

## 结构

```text
UI（专注模式、规则选择对话框、规则管理页、导入导出）
        │  exceptionRuleManager
        ▼
src/services/exception-rule-manager/ExceptionRuleManager.ts
        │  纯函数                         │  RuleStore 端口
        ▼                                 ▼
src/domain/rules.ts               src/storage/localRuleStore.ts
（校验、重名、可用性、             （localStorage；测试用
  使用记录、数据修复）               src/test/fakes/memoryRuleStore.ts）
```

| 位置                                                          | 职责                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `src/domain/rules.ts`                                         | 输入校验、重名与相似名称、动作可用性、使用记录、修复 |
| `src/storage/ports.ts` 中的 `RuleStore`                       | 规则与使用记录的读取和整体保存                       |
| `src/storage/localRuleStore.ts`                               | localStorage 实现；读写失败直接抛出                  |
| `src/services/exception-rule-manager/ExceptionRuleManager.ts` | 组合上述两者的唯一入口                               |

规则只保存在本地，云端模式下也不同步。

---

## 设计要点

- **单一入口**：UI 只调用 `exceptionRuleManager`，不直接读写存储。
- **逻辑与存储分离**：判断全部在 `src/domain/rules.ts` 的纯函数里，可以不依赖存储测试；
  管理器只负责读、判断、写。
- **串行执行**：管理器的每个操作排队执行，并发调用不会互相覆盖读改写结果。
- **错误不吞**：规则错误（校验、重名、不存在、类型不匹配）原样抛出；其余失败统一包装为
  `STORAGE_ERROR`。`localRuleStore` 遇到无法解析的数据或浏览器拒绝写入时直接抛出，
  调用方不会把未保存的结果报告为成功。
- **启动修复**：首次操作前调用一次 `repairRuleData`，修复旧版本或外部损坏的数据；失败后
  下次操作会重试。

---

## 数据流

### 创建规则

1. `validateRuleInput` 校验名称（非空，≤100 字符）、类型和描述（≤500 字符）。
2. `findExactDuplicates` 在所有激活规则中查找同名（忽略大小写、空格和标点）。
   - 默认抛出 `DUPLICATE_RULE_NAME`。
   - 传 `{ reuseExisting: true }` 时返回已有规则，优先类型相同的一条，类型不同时附带警告。
     专注模式用这个选项。
3. 没有同名时创建全局规则；`findSimilarRules` 找到相似名称时附带警告。规则管理页收到警告会
   保持表单打开并显示。

链专属规则用 `createChainRule`，名称只需在同一条链内唯一，可以与全局规则同名。

### 使用规则

1. `assertRuleUsableForAction` 要求规则存在、已激活，且类型与动作匹配。
2. 追加一条使用记录，再把规则的 `usageCount` 加一并更新 `lastUsedAt`。

### 导入

`importRules` 一次读取、一次保存。同名规则按选项跳过、原地更新类型和描述，或记为错误；
同一批导入中重复的名称同样按重名处理。

---

## 错误传播

专注模式在动作入口统一调用 `userFeedbackHandler.showErrorMessage` 展示错误并保持流程打开，
由用户重试。规则管理页把错误显示在表单里，失败时撤销乐观更新。

---

## 测试

| 测试                                                           | 覆盖                                      |
| -------------------------------------------------------------- | ----------------------------------------- |
| `src/domain/__tests__/rules.test.ts`、`ruleDataRepair.test.ts` | 纯函数的表驱动测试                        |
| `src/services/exception-rule-manager/__tests__/`               | 管理器对内存 `RuleStore` 的完整行为       |
| `src/storage/__tests__/localRuleStore.test.ts`                 | localStorage 往返、旧数据作用域、写入失败 |
| 规则管理页、规则选择、专注模式的 hook 测试                     | 真实管理器加 jsdom localStorage           |
| `e2e/core-flows.spec.ts`                                       | 对话框建规则、管理页增改删、用规则暂停    |

---

## 添加新的规则类型

1. 在 `src/types/exception-rule.ts` 的 `ExceptionRuleType` 中添加枚举值。
2. 在 `src/domain/rules.ts` 的 `ruleTypeForAction` 和 `assertRuleUsableForAction` 中处理新类型。
3. 在规则选择对话框和规则管理页表单中添加选项。

---

## 相关文档

- [DOMAIN_RULES.md](../features/DOMAIN_RULES.md) - 领域文档
- [ARCHITECTURE.md](../guides/ARCHITECTURE.md) - 架构总览
- [DEBUGGING_GUIDE.md](../guides/DEBUGGING_GUIDE.md) - 调试指南

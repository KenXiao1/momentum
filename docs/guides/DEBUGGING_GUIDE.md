# 例外规则系统调试指南

## 🔍 当前问题状态

### 已识别的问题

1. **规则类型验证失败** - "规则类型不能为空"
2. **规则ID验证失败** - "规则不存在"

### 已添加的调试工具

#### 1. 调试日志

- `FocusMode.handleCreateNewRule` - 显示传入的参数
- `RuleSelectionDialog.handleCreateNewRule` - 显示调用参数
- `ExceptionRuleManager.createRule` - 显示验证参数
- `ExceptionRuleManager.useRule` - 显示规则ID验证过程

#### 2. 全局调试函数

在浏览器控制台中可以使用以下函数：

```javascript
// 测试基本功能
testBasicFunctionality();

// 调试规则创建
debugRuleCreation();

// 紧急创建规则
emergencyCreateRule('测试规则', 'pause_only', '测试描述');

// 紧急使用规则
emergencyUseRule('rule_id', 'pause');

// 快速修复现有数据
quickFixRules();
```

## 🛠️ 调试步骤

### 步骤1: 检查基本功能

```javascript
testBasicFunctionality();
```

这会验证类型枚举是否正确加载。

### 步骤2: 尝试直接创建规则

```javascript
debugRuleCreation();
```

这会绕过UI直接测试规则创建功能。

### 步骤3: 检查现有数据

```javascript
quickFixRules();
```

这会检查并修复现有的规则数据问题。

## 🔧 紧急修复方案

如果标准方法失败，可以使用紧急修复：

### 创建规则

```javascript
// 直接创建暂停规则
emergencyCreateRule('紧急暂停规则', 'pause_only', '紧急创建的规则');

// 直接创建提前完成规则
emergencyCreateRule('紧急完成规则', 'early_completion_only', '紧急创建的规则');
```

### 使用规则

```javascript
// 获取所有规则
exceptionRuleStorage.getRules().then((rules) => {
  console.log('现有规则:', rules);

  // 使用第一个暂停规则
  const pauseRule = rules.find((r) => r.type === 'pause_only');
  if (pauseRule) {
    emergencyUseRule(pauseRule.id, 'pause');
  }
});
```

## 📊 监控和诊断

### 实时监控

打开浏览器控制台，查看以下日志：

- `🔧` 开头的日志 - 调试信息
- `✅` 开头的日志 - 成功操作
- `❌` 开头的日志 - 错误信息
- `⚠️` 开头的日志 - 警告信息

### 错误分析

当出现错误时，检查：

1. 错误类型和消息
2. 传入的参数值和类型
3. 调用堆栈
4. 相关的调试日志

## 🎯 常见问题解决

### 问题1: "规则类型不能为空"

**可能原因:**

- 类型枚举未正确导入
- 参数传递过程中类型丢失
- 序列化/反序列化问题

**解决方案:**

1. 检查 `testBasicFunctionality()` 输出
2. 查看 `handleCreateNewRule` 的调试日志
3. 使用 `emergencyCreateRule` 绕过问题

### 问题2: "规则不存在"

**可能原因:**

- 规则ID不匹配
- 乐观更新同步问题
- 数据存储问题

**解决方案:**

1. 运行 `quickFixRules()` 修复数据
2. 检查规则ID验证日志
3. 使用 `emergencyUseRule` 绕过问题

### 问题3: 界面无响应

**可能原因:**

- 错误处理阻塞了UI
- 异步操作未正确处理

**解决方案:**

1. 刷新页面
2. 检查控制台错误
3. 使用紧急修复函数

## 📝 报告问题

如果问题持续存在，请提供以下信息：

1. **错误信息**: 完整的错误消息和堆栈跟踪
2. **调试日志**: 相关的 `🔧` 调试日志
3. **操作步骤**: 导致错误的具体操作
4. **浏览器信息**: 浏览器类型和版本

## 🚀 性能优化建议

1. **定期清理**: 运行 `quickFixRules()` 清理数据问题
2. **缓存清理**: 刷新页面清理可能的缓存问题
3. **数据备份**: 在重要操作前备份数据

## 📞 技术支持

如果需要进一步帮助：

1. 收集上述调试信息
2. 尝试紧急修复方案
3. 记录详细的操作步骤和错误信息
4. 联系技术支持团队

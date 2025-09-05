# Supabase 押注系统事务修复指南

## 问题描述

当前的 `place_task_bet` 函数存在事务管理问题，可能导致：
- 积分扣除成功但押注记录创建失败
- 数据不一致的情况
- 用户积分丢失

## 修复步骤

### 1. 检查当前问题

首先运行检查脚本查看是否存在数据完整性问题：

```sql
-- 在 Supabase SQL Editor 中运行
\i check_bet_integrity.sql
```

### 2. 应用修复Migration

部署新的migration文件：

```bash
# 通过 Supabase CLI 应用 migration
supabase db push

# 或者直接在 Supabase Dashboard 中运行
# C:\Users\xfc05\Downloads\momentum\momentum-new-feature-branch\supabase\migrations\20250905100000_fix_bet_transaction_atomicity.sql
```

### 3. 清理现有问题（可选）

如果发现了数据完整性问题，可以运行清理函数：

```sql
-- 仅在需要时运行，需要 service_role 权限
SELECT cleanup_bet_integrity_issues();
```

### 4. 验证修复

运行测试脚本验证修复是否成功：

```sql
-- 在 Supabase SQL Editor 中运行
\i test_bet_atomicity.sql
```

### 5. 持续监控

定期检查数据完整性：

```sql
-- 定期运行此查询以监控数据完整性
SELECT * FROM verify_bet_integrity();
```

## 修复内容

### 主要改进

1. **移除错误的嵌套事务**
   - 删除了不正确的 `BEGIN...EXCEPTION...END` 块
   - 利用 PL/pgSQL 函数的天然事务特性

2. **添加行级锁定**
   - 在读取用户积分时使用 `FOR UPDATE` 防止并发竞争

3. **调整操作顺序**
   - 先创建押注记录，再扣除积分
   - 确保失败时不会留下孤立的积分扣除记录

4. **增强错误处理**
   - 添加详细的审计日志
   - 改进异常消息和错误跟踪

5. **数据完整性工具**
   - 添加完整性检查函数
   - 提供清理工具处理历史问题

### 安全特性

- **行级安全（RLS）**：确保用户只能操作自己的数据
- **权限控制**：限制敏感函数的访问权限
- **审计跟踪**：所有操作都有完整的日志记录
- **防重复下注**：确保每个会话只能下注一次

### 性能优化

- **索引优化**：为常用查询添加了适当的索引
- **锁定策略**：使用行级锁定最小化阻塞
- **批量操作**：减少数据库往返次数

## 测试建议

在生产环境部署前，请在开发/测试环境进行以下测试：

1. **正常押注流程测试**
2. **并发押注测试**
3. **余额不足情况测试**
4. **重复押注防护测试**
5. **网络中断恢复测试**

## 回滚计划

如果需要回滚，可以重新部署之前版本的 `place_task_bet` 函数：

```sql
-- 恢复到之前版本的函数
-- (需要从之前的 migration 文件中复制原函数定义)
```

## 联系信息

如有问题，请联系数据库管理员或开发团队。
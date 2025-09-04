# 每日签到系统 API 设计指南

## 数据库表结构概述

### 1. user_points（用户积分表）
- `id`: UUID主键
- `user_id`: 用户ID（外键到auth.users）
- `total_points`: 总积分（非负整数）
- `created_at/updated_at`: 时间戳

### 2. daily_checkins（签到记录表）
- `id`: UUID主键
- `user_id`: 用户ID（外键）
- `checkin_date`: 签到日期（date类型）
- `points_earned`: 获得积分（默认10）
- `consecutive_days`: 连续签到天数
- `created_at`: 签到时间戳
- **唯一约束**: (user_id, checkin_date) 防止重复签到

### 3. point_transactions（积分交易记录表）
- `id`: UUID主键  
- `user_id`: 用户ID（外键）
- `transaction_type`: 交易类型（checkin/reward/consume/adjustment/bonus）
- `points_change`: 积分变化（正数增加，负数减少）
- `description`: 交易描述
- `related_id`: 关联记录ID（可选）
- `created_at`: 交易时间

## 核心函数API

### 1. 执行每日签到
```sql
SELECT perform_daily_checkin(auth.uid());
```
**返回**: 
```json
{
  "success": true,
  "checkin_id": "uuid",
  "transaction_id": "uuid", 
  "points_earned": 10,
  "consecutive_days": 5,
  "checkin_date": "2025-09-04",
  "message": "签到成功！获得 10 积分，连续签到 5 天"
}
```

### 2. 获取用户签到统计
```sql
SELECT get_user_checkin_stats(auth.uid());
```
**返回**:
```json
{
  "total_points": 150,
  "total_checkins": 15,
  "current_streak": 5,
  "longest_streak": 12,
  "last_checkin_date": "2025-09-04",
  "today_checked_in": true
}
```

### 3. 获取签到历史（分页）
```sql
SELECT get_user_checkin_history(auth.uid(), 20, 0);
```
**返回**:
```json
{
  "history": [...],
  "total_count": 50,
  "page_size": 20,
  "page_offset": 0,
  "has_more": true
}
```

## 安全策略

### Row Level Security (RLS)
- 所有表启用RLS
- 用户只能访问自己的数据
- point_transactions表限制为只读（用户不能直接修改交易记录）

### 业务约束
- 每用户每天只能签到一次（数据库唯一约束）
- 积分总数不能为负数
- 连续签到天数逻辑自动计算
- 所有积分变化都记录在交易表中

## 索引优化
- `idx_daily_checkins_user_date`: 用户签到日期查询
- `idx_point_transactions_user_date`: 用户交易记录查询  
- `idx_user_points_user_id`: 用户积分查询

## 前端集成建议

### API调用示例（Supabase Client）
```typescript
// 执行签到
const { data: checkinResult } = await supabase.rpc('perform_daily_checkin', {
  target_user_id: user.id
});

// 获取统计信息
const { data: stats } = await supabase.rpc('get_user_checkin_stats', {
  target_user_id: user.id
});

// 获取签到历史
const { data: history } = await supabase.rpc('get_user_checkin_history', {
  target_user_id: user.id,
  page_size: 20,
  page_offset: 0
});
```

### 错误处理
- 重复签到: `already_checked_in_today`
- 权限错误: RLS策略会自动处理
- 数据库约束违反: 自动回滚事务

## 扩展性考虑

1. **签到奖励规则扩展**: 可在`perform_daily_checkin`函数中增加基于连续天数的奖励逻辑
2. **积分消费系统**: 通过`point_transactions`表记录积分消费
3. **任务系统集成**: 可以将完成任务链也作为积分来源
4. **等级系统**: 基于总积分计算用户等级

## 部署说明

1. 运行迁移文件：`20250904000000_add_daily_checkin_system.sql`
2. 确认RLS策略生效
3. 测试函数权限和返回结果
4. 前端集成测试
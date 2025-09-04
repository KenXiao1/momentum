# DailyCheckin 组件使用指南

## 简介

`DailyCheckin` 是一个React组件，用于实现每日签到功能。它提供了直观的用户界面，显示用户的积分、连续签到天数等统计信息，并允许用户执行每日签到操作。

## 功能特性

- ✅ 显示用户签到统计（总积分、连续天数、总签到次数）
- ✅ 一键签到功能，防重复点击
- ✅ 优雅的加载状态和错误处理
- ✅ 响应式设计，支持移动端
- ✅ 暗黑模式支持
- ✅ 成功/失败反馈机制
- ✅ 已签到状态展示
- ✅ 最佳记录显示

## 基本用法

```tsx
import React from 'react';
import { DailyCheckin } from './components/DailyCheckin';

function App() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">每日签到系统</h1>
      <DailyCheckin />
    </div>
  );
}

export default App;
```

## 自定义样式

```tsx
import React from 'react';
import { DailyCheckin } from './components/DailyCheckin';

function Dashboard() {
  return (
    <div className="dashboard-container">
      <DailyCheckin className="mb-8 shadow-lg" />
      {/* 其他组件 */}
    </div>
  );
}
```

## 组件状态

### 1. 加载状态
组件首次渲染时会显示加载动画，从服务器获取用户签到数据。

### 2. 未签到状态
显示：
- 当前积分统计
- 连续签到天数
- 总签到次数
- 可用的签到按钮
- 历史最佳记录（如果存在）

### 3. 已签到状态
显示：
- 已完成签到的确认图标
- "今天已签到" 消息
- 统计信息更新

### 4. 错误状态
当出现网络错误或其他问题时，会显示错误信息和重试按钮。

## 依赖服务

该组件依赖以下服务：

- `CheckinService`: 处理签到相关的API调用
- `isSupabaseConfigured`: 检查数据库连接状态

## 数据结构

### CheckinStats 接口
```typescript
interface CheckinStats {
  user_id: string;
  total_points: number;
  total_checkins: number;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null;
  has_checked_in_today: boolean;
}
```

### CheckinResult 接口
```typescript
interface CheckinResult {
  success: boolean;
  message: string;
  already_checked_in: boolean;
  checkin_date: string;
  points_earned: number;
  consecutive_days: number;
  total_points?: number;
  checkin_id?: string;
}
```

## 样式约定

组件使用 Tailwind CSS 进行样式设计，支持：
- 响应式布局（移动端适配）
- 暗黑模式切换
- 渐变色彩方案
- 微交互动画效果

## 错误处理

组件内置了完善的错误处理机制：

1. **网络错误**: 显示网络连接问题提示
2. **认证错误**: 提示用户需要登录
3. **服务不可用**: 显示服务状态错误
4. **重复签到**: 自动检测并阻止重复操作

## 性能优化

- 使用 `useCallback` 优化函数引用
- 合理的状态管理避免不必要的重渲染
- 防重复点击机制
- 优雅的加载状态处理

## 移动端适配

- 响应式网格布局
- 触摸友好的按钮设计
- 适配不同屏幕尺寸的统计卡片

## 注意事项

1. 确保 Supabase 已正确配置
2. 确保用户已登录状态
3. 需要对应的数据库函数支持
4. 建议在生产环境中添加适当的错误监控
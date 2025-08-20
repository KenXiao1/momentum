# Momentum - 新手指南

## 项目概述

Momentum 是一个基于现代 Web 技术栈的生产力与专注管理应用，旨在帮助用户通过任务链和专注模式来提高工作效率。该应用采用了创新的"任务链"概念，将复杂的工作流程分解为可管理的单元，并提供完整的时间管理和进度跟踪功能。

### 核心特性
- 🔗 **任务链系统**: 层级化的任务管理，支持单元任务和任务群
- ⏰ **专注模式**: 带有暂停/恢复功能的计时器
- 📊 **进度跟踪**: 完整的任务完成历史和统计
- 🗂️ **回收箱功能**: 安全的软删除和恢复机制
- 🎯 **例外规则系统**: 灵活的任务中断和提前完成规则
- 📱 **响应式设计**: 支持移动端和桌面端
- 🔐 **多存储支持**: 本地存储或 Supabase 云端存储

## 项目架构

### 技术栈

#### 前端框架
- **React 18.3.1**: 现代 React 框架，使用函数组件和 Hooks
- **TypeScript 5.5.3**: 提供类型安全和更好的开发体验
- **Vite 5.4.2**: 快速的构建工具和开发服务器

#### 样式和UI
- **Tailwind CSS 3.4.1**: 实用优先的 CSS 框架
- **Lucide React 0.344.0**: 现代图标库
- **响应式设计**: 支持多种屏幕尺寸和设备

#### 数据库和后端
- **Supabase**: PostgreSQL 数据库服务
- **数据库类型**: 自动生成的 TypeScript 类型定义
- **认证**: Supabase Auth 集成

#### 开发工具
- **ESLint 9.9.1**: 代码质量检查
- **PostCSS & Autoprefixer**: CSS 后处理
- **Jest/Vitest**: 测试框架

### 项目结构

```
momentum-new-feature-branch/
├── src/                          # 源代码目录
│   ├── components/              # React 组件
│   │   ├── Dashboard.tsx        # 主仪表盘
│   │   ├── ChainEditor.tsx      # 任务链编辑器
│   │   ├── FocusMode.tsx        # 专注模式
│   │   ├── ChainDetail.tsx      # 任务详情
│   │   ├── GroupView.tsx        # 任务群视图
│   │   ├── RSIPView.tsx         # RSIP（递归稳态迭代协议）视图
│   │   └── ...                  # 其他UI组件
│   ├── hooks/                   # 自定义 React Hooks
│   │   ├── useContainerWidth.ts # 容器宽度监听
│   │   ├── useDarkMode.ts       # 深色模式
│   │   └── ...                  # 其他Hooks
│   ├── lib/                     # 核心库文件
│   │   ├── database.types.ts    # 数据库类型定义
│   │   └── supabase.ts          # Supabase 客户端配置
│   ├── services/                # 业务逻辑服务
│   │   ├── ExceptionRuleManager.ts    # 例外规则管理
│   │   ├── RecycleBinService.ts       # 回收箱服务
│   │   ├── ChainDeletionHandler.ts    # 链条删除处理
│   │   └── ...                        # 其他业务服务
│   ├── types/                   # TypeScript 类型定义
│   │   └── index.ts             # 所有类型的集中定义
│   ├── utils/                   # 工具函数
│   │   ├── chainTree.ts         # 任务树构建算法
│   │   ├── storage.ts           # 本地存储
│   │   ├── supabaseStorage.ts   # Supabase 存储
│   │   ├── forwardTimer.ts      # 正向计时器
│   │   └── ...                  # 其他工具函数
│   ├── styles/                  # 样式文件
│   │   ├── layout-fixes.css     # 布局修复
│   │   ├── mobile-optimizations.css # 移动端优化
│   │   └── ...                  # 其他样式
│   ├── App.tsx                  # 主应用组件
│   ├── main.tsx                 # 应用入口
│   └── index.css                # 全局样式
├── supabase/                    # 数据库迁移文件
│   └── migrations/              # SQL 迁移脚本
├── dist/                        # 构建输出目录
├── public/                      # 静态资源
├── package.json                 # 项目依赖配置
├── vite.config.ts              # Vite 构建配置
├── tailwind.config.js          # Tailwind CSS 配置
├── tsconfig.json               # TypeScript 配置
└── netlify.toml                # Netlify 部署配置
```

## 核心文件详解

### 1. 主应用文件 (`src/App.tsx`)

**功能**: 应用的根组件，管理全局状态和路由
**关键算法**:
- 状态管理：使用 React useState 管理应用状态
- 数据加载：支持本地存储和 Supabase 的条件加载
- 视图路由：基于状态的视图切换（dashboard, editor, focus, detail, group, rsip）

**与其他模块的关系**:
- 使用 `storage.ts` 和 `supabaseStorage.ts` 进行数据持久化
- 调用 `chainTree.ts` 构建任务层级结构
- 集成 `forwardTimer.ts` 管理正向计时
- 连接所有 React 组件

**核心逻辑**:
```typescript
// 条件存储选择
const storage = isSupabaseConfigured ? supabaseStorage : localStorageUtils;

// 状态管理模式
const [state, setState] = useState<AppState>({
  chains: [],           // 任务链数据
  scheduledSessions: [], // 预约会话
  activeSession: null,   // 当前活跃会话
  currentView: 'dashboard', // 当前视图
  // ... 其他状态
});
```

### 2. 类型定义 (`src/types/index.ts`)

**功能**: 整个应用的 TypeScript 类型系统
**核心类型**:

#### 任务链 (Chain)
```typescript
interface Chain {
  id: string;
  parentId?: string;        // 用于构建层级关系
  type: ChainType;         // 任务类型/兵种
  name: string;
  duration: number;        // 持续时间（分钟）
  currentStreak: number;   // 当前连续完成数
  isDurationless?: boolean; // 无时长任务标志
  // ... 更多字段
}
```

#### 任务类型系统
应用使用"兵种"概念对任务进行分类：
- `unit`: 基础单元
- `group`: 任务群容器
- `assault`: 突击单元（学习、实验、论文）
- `recon`: 侦查单元（信息搜集）
- `command`: 指挥单元（制定计划）
- `special_ops`: 特勤单元（处理杂事）
- `engineering`: 工程单元（运动锻炼）
- `quartermaster`: 炊事单元（备餐做饭）

### 3. 任务树算法 (`src/utils/chainTree.ts`)

**功能**: 将扁平化的任务数据转换为树状结构
**核心算法**: `buildChainTree()`

**算法流程**:
1. **数据验证**: 检查必需字段，发现重复ID和循环引用
2. **数据清理**: 修复循环引用，过滤无效数据
3. **节点映射**: 创建 ID 到节点的映射表
4. **树构建**: 根据 parentId 建立父子关系
5. **排序**: 按 sortOrder 对同级节点排序
6. **验证**: 确保所有输入节点都在树中

**数据完整性保证**:
```typescript
// 修复循环引用
if (chain.parentId === chain.id) {
  console.warn(`修复循环引用: 链条 ${chain.name}`);
  return { ...chain, parentId: undefined };
}

// 孤儿节点处理
if (parent) {
  parent.children.push(node);
} else {
  console.warn(`父节点不存在，作为根节点处理`);
  node.parentId = undefined;
  rootNodes.push(node);
}
```

### 4. 存储系统

#### 本地存储 (`src/utils/storage.ts`)
**功能**: 浏览器本地存储的封装
**特性**:
- JSON 序列化/反序列化
- 错误处理和恢复
- 数据迁移支持

#### Supabase 存储 (`src/utils/supabaseStorage.ts`)
**功能**: 云端数据库操作
**特性**:
- PostgreSQL 数据库集成
- 实时数据同步
- 用户认证集成
- 关系型数据管理

### 5. 数据库结构 (`src/lib/database.types.ts`)

**核心表结构**:

#### chains 表
```sql
chains {
  id: string (PRIMARY KEY)
  name: string
  parent_id: string (FOREIGN KEY)
  type: string
  duration: number
  current_streak: number
  auxiliary_streak: number
  exceptions: json
  time_limit_hours: number
  group_started_at: timestamp
  user_id: string
  -- 更多字段...
}
```

#### completion_history 表
```sql
completion_history {
  id: string (PRIMARY KEY)
  chain_id: string (FOREIGN KEY)
  completed_at: timestamp
  duration: number
  was_successful: boolean
  actual_duration: number
  is_forward_timed: boolean
  description: string
  notes: string
  user_id: string
}
```

#### rsip_nodes 表 (递归稳态迭代协议)
```sql
rsip_nodes {
  id: string (PRIMARY KEY)
  parent_id: string (FOREIGN KEY)
  title: string
  rule: string
  sort_order: number
  use_timer: boolean
  timer_minutes: number
  user_id: string
}
```

## 主要组件详解

### 1. Dashboard (`src/components/Dashboard.tsx`)
**功能**: 主仪表盘，显示所有任务链和操作入口
**特性**:
- 任务链网格显示
- 快速操作按钮
- 统计信息展示
- 回收箱管理

### 2. ChainEditor (`src/components/ChainEditor.tsx`)
**功能**: 任务链创建和编辑界面
**特性**:
- 表单验证
- 任务类型选择
- 层级关系设置
- 预览功能

### 3. FocusMode (`src/components/FocusMode.tsx`)
**功能**: 专注模式计时器
**算法特点**:
- 支持正向和倒计时两种模式
- 暂停/恢复功能
- 例外规则集成
- 任务完成确认

### 4. GroupView (`src/components/GroupView.tsx`)
**功能**: 任务群管理界面
**特性**:
- 层级显示
- 进度跟踪
- 批量操作
- 单元导入

### 5. RSIPView (`src/components/RSIPView.tsx`)
**功能**: 递归稳态迭代协议管理
**概念**: RSIP是一个用于管理行为准则和决策规则的系统
**特性**:
- 树状规则组织
- 可执行规则描述
- 计时集成

## 核心算法和逻辑

### 1. 任务链执行逻辑

**单元任务执行**:
```typescript
const handleStartChain = (chainId: string) => {
  // 1. 验证任务存在性
  // 2. 检查任务群时间限制
  // 3. 创建活跃会话
  // 4. 启动计时器
  // 5. 切换到专注模式
}
```

**任务群执行**:
```typescript
// 获取下一个待执行单元
const nextUnit = getNextUnitInGroup(groupNode);
if (nextUnit) {
  handleStartChain(nextUnit.id);
} else {
  // 任务群完成
  notifyTaskCompleted(chain.name);
}
```

### 2. 时间管理算法

**正向计时器** (`src/utils/forwardTimer.ts`):
```typescript
class ForwardTimerManager {
  startTimer(sessionId: string): void {
    // 记录开始时间，启动计时
  }
  
  getElapsedTime(sessionId: string): number {
    // 计算已用时间（考虑暂停）
  }
  
  stopTimer(sessionId: string): number {
    // 停止计时并返回总用时
  }
}
```

**时间限制检查**:
```typescript
const isGroupExpired = (chain: Chain): boolean => {
  if (!chain.timeLimitHours || !chain.groupStartedAt) return false;
  
  const expiresAt = new Date(chain.groupStartedAt);
  expiresAt.setHours(expiresAt.getHours() + chain.timeLimitHours);
  
  return Date.now() > expiresAt.getTime();
}
```

### 3. 例外规则系统

**规则类型**:
- `PAUSE_ONLY`: 仅允许暂停
- `EARLY_COMPLETION_ONLY`: 仅允许提前完成

**规则作用域**:
- `chain`: 链条级规则
- `global`: 全局规则

**使用记录**:
```typescript
interface RuleUsageRecord {
  ruleId: string;
  chainId: string;
  usedAt: Date;
  actionType: 'pause' | 'early_completion';
  taskElapsedTime: number;
}
```

### 4. 软删除和回收箱

**软删除机制**:
```typescript
const softDeleteChain = async (chainId: string) => {
  const chain = chains.find(c => c.id === chainId);
  if (chain) {
    chain.deletedAt = new Date();
    await storage.saveChains(chains);
  }
}
```

**数据完整性保证**:
```typescript
const safelySaveChains = async (activeChains: Chain[]) => {
  // 1. 获取所有现有链条（包括已删除的）
  const allExisting = await storage.getChains();
  const deleted = allExisting.filter(c => c.deletedAt != null);
  
  // 2. 合并活跃和已删除的链条
  const allUpdated = [...activeChains, ...deleted];
  
  // 3. 保存合并后的数据
  await storage.saveChains(allUpdated);
}
```

## 数据流和状态管理

### 1. 应用状态结构
```typescript
interface AppState {
  chains: Chain[];                    // 任务链数据
  scheduledSessions: ScheduledSession[]; // 预约会话
  activeSession: ActiveSession | null;   // 当前活跃会话
  currentView: ViewState;             // 当前视图
  completionHistory: CompletionHistory[]; // 完成历史
  rsipNodes: RSIPNode[];             // RSIP节点
  taskTimeStats: TaskTimeStats[];    // 用时统计
}
```

### 2. 数据流向
```
用户操作 → 事件处理函数 → 状态更新 → 存储保存 → UI重新渲染
```

### 3. 错误处理策略
- **乐观更新**: 先更新UI，后保存数据
- **失败回滚**: 保存失败时恢复原状态
- **数据验证**: 多层验证确保数据完整性

## 性能优化

### 1. 组件优化
- 使用 React.memo 防止不必要的重渲染
- 合理使用 useCallback 和 useMemo
- 虚拟化长列表（VirtualizedRuleList）

### 2. 数据处理优化
- 数据缓存机制
- 批量操作支持
- 增量更新策略

### 3. 网络优化
- Supabase 连接池
- 数据压缩
- 离线支持

## 测试策略

### 1. 单元测试
```
src/__tests__/           # 组件测试
src/services/__tests__/  # 服务测试
src/utils/__tests__/     # 工具函数测试
```

### 2. 集成测试
- API 集成测试
- 数据流测试
- 端到端场景测试

### 3. 测试覆盖范围
- 核心业务逻辑
- 数据处理算法
- 错误处理分支
- UI交互逻辑

## 部署和配置

### 1. 环境配置
- **开发环境**: `npm run dev` - Vite 开发服务器
- **构建**: `npm run build` - 生产构建
- **预览**: `npm run preview` - 构建预览

### 2. 环境变量
```
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
```

### 3. Netlify 部署
配置文件: `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 开发最佳实践

### 1. 代码组织
- 按功能模块组织文件
- 保持组件单一职责
- 使用 TypeScript 严格模式

### 2. 命名约定
- 组件使用 PascalCase
- 函数使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 文件名与导出内容一致

### 3. 错误处理
- 所有异步操作都有错误处理
- 用户友好的错误消息
- 详细的开发者日志

### 4. 数据安全
- 输入验证和清理
- XSS 防护
- 敏感数据不记录日志

## 常见问题和解决方案

### 1. 数据不一致
**问题**: 界面显示与存储数据不符
**解决**: 使用 `safelySaveChains` 确保数据完整性

### 2. 循环引用
**问题**: 任务的父节点指向自己
**解决**: `buildChainTree` 自动检测和修复

### 3. 性能问题
**问题**: 大量任务时界面卡顿
**解决**: 虚拟化列表，分页加载

### 4. 数据迁移
**问题**: 版本升级时数据格式变化
**解决**: 渐进式迁移脚本

## 扩展指南

### 1. 添加新任务类型
1. 在 `types/index.ts` 中扩展 `ChainType`
2. 在 `chainTree.ts` 中添加类型配置
3. 更新相关UI组件

### 2. 新增存储后端
1. 实现 `Storage` 接口
2. 在 `App.tsx` 中添加条件逻辑
3. 配置相应的环境变量

### 3. 添加新视图
1. 创建新的 React 组件
2. 在 `types/index.ts` 中扩展 `ViewState`
3. 在 `App.tsx` 中添加路由逻辑

## 总结

Momentum 是一个设计精良的现代 Web 应用，采用了先进的技术栈和架构模式。其核心特点包括：

1. **模块化设计**: 清晰的文件结构和职责分离
2. **类型安全**: 完整的 TypeScript 类型系统
3. **数据完整性**: 多层验证和错误处理
4. **扩展性**: 插件化的存储和组件系统
5. **用户体验**: 响应式设计和流畅的交互

对于新开发者，建议从以下顺序开始理解：
1. 先理解 `types/index.ts` 中的数据结构
2. 然后查看 `App.tsx` 了解整体架构
3. 深入 `chainTree.ts` 理解核心算法
4. 最后研究各个组件的具体实现

这个项目展示了如何构建一个功能完整、架构清晰的现代 Web 应用，对学习 React、TypeScript 和现代前端开发模式非常有价值。
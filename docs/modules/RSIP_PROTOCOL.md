# RSIP 协议概述

RSIP（Recursive Steady-state Iterative Protocol，递归稳态迭代协议）是 Momentum 中用于管理长期目标和习惯形成的核心系统。

---

## 概念介绍

### 什么是 RSIP？

RSIP 是一种将复杂目标分解为可执行定式的方法论。核心思想是：

1. **递归分解**: 大目标分解为小目标，小目标分解为可执行的定式
2. **稳态迭代**: 通过重复执行定式，逐步建立稳定的行为模式
3. **协议驱动**: 每个定式都是一个明确的"协议"，规定了执行条件和步骤

### 核心概念

| 概念 | 英文      | 说明                               |
| ---- | --------- | ---------------------------------- |
| 国策 | Policy    | 最高层目标，如"提高工作效率"       |
| 方针 | Guideline | 中层策略，如"建立晨间routine"      |
| 定式 | Routine   | 可执行的具体行为，如"每天6:30起床" |

---

## 数据模型

### RSIPNode 类型

```typescript
// src/types/index.ts

interface RSIPNode {
  id: string;
  title: string;
  description?: string;
  type: 'policy' | 'guideline' | 'routine';
  parentId?: string; // 父节点ID，null表示根节点
  chainId?: string; // 关联的任务链ID
  createdAt: Date;
  status: 'active' | 'paused' | 'completed' | 'failed';
  order: number; // 同级节点排序
}

interface RSIPTreeNode extends RSIPNode {
  children: RSIPTreeNode[]; // 子节点
}

interface RSIPMeta {
  lastModified: Date;
  version: number;
}
```

### 节点类型说明

| 类型      | 层级 | 允许子节点 | 关联链条 |
| --------- | ---- | :--------: | :------: |
| policy    | 1    |     ✓      |    ✗     |
| guideline | 2    |     ✓      |    ✗     |
| routine   | 3    |     ✗      |    ✓     |

---

## 系统架构

### 关键文件

| 文件                                                          | 职责                                               |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `src/types/index.ts`                                          | RSIPNode, RSIPTreeNode, RSIPMeta 类型定义          |
| `src/domain/rsip.ts`                                          | 阶段晋升、强化、违规吸收与级联、失败代价（纯函数） |
| `src/hooks/domains/useRsipDomain.ts`                          | RSIP 领域 Hook（持久化与状态提交）                 |
| `src/utils/rsipTree.ts`                                       | 树形结构工具函数                                   |
| `src/components/rsip/RSIPCanvas.tsx`                          | 画布渲染组件                                       |
| `src/components/rsip/RSIPTree.tsx`                            | 树形视图组件                                       |
| `src/components/rsip/RSIPFilters.tsx`                         | 过滤器组件                                         |
| `src/infra/storage/supabase/rsip.ts`                          | Supabase 存储实现                                  |
| `src/services/rsip-insights/RSIPInsightsService.ts`           | 分析与推荐引擎                                     |
| `src/services/rsip-integration/RSIPTaskIntegrationService.ts` | 任务联动服务                                       |
| `src/components/rsip/RSIPTaskLinkPanel.tsx`                   | 任务联动面板                                       |
| `src/components/rsip/RSIPInsightsPanel.tsx`                   | 分析与推荐面板                                     |
| `src/components/rsip/RSIPPolicyLibrary.tsx`                   | 国策库面板                                         |
| `src/components/rsip/RSIPRunHistory.tsx`                      | 轮次历史面板                                       |

### 组件结构

```
RSIPCanvas (Container)
├── RSIPFilters         # 类型过滤
├── RSIPTree            # 树形渲染
│   ├── RSIPNodeCard    # 节点卡片
│   └── Connectors      # 连接线
└── ConfirmationDialog  # 确认对话框
```

---

## 核心操作

### 树形结构工具

```typescript
// src/utils/rsipTree.ts

// 构建树形结构
function buildRSIPTree(nodes: RSIPNode[]): RSIPTreeNode[];

// 统计后代节点数
function countDescendants(node: RSIPTreeNode): number;

// 删除节点及其后代
function deleteNodeAndDescendants(
  nodes: RSIPNode[],
  nodeId: string,
): RSIPNode[];

// 查找节点
function findNodeInTree(tree: RSIPTreeNode[], id: string): RSIPTreeNode | null;
```

### Domain Hook 接口

```typescript
// src/hooks/domains/useRsipDomain.ts

interface UseRsipDomainReturn {
  // 数据
  nodes: RSIPNode[];
  tree: RSIPTreeNode[];
  meta: RSIPMeta | null;

  // 操作
  createNode: (node: Omit<RSIPNode, 'id' | 'createdAt'>) => Promise<void>;
  updateNode: (id: string, updates: Partial<RSIPNode>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  moveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
  reorderNodes: (
    parentId: string | null,
    orderedIds: string[],
  ) => Promise<void>;

  // 状态
  isLoading: boolean;
  error: Error | null;
}
```

---

## 画布交互

### 节点操作

| 操作     | 触发方式   | 效果                  |
| -------- | ---------- | --------------------- |
| 选中节点 | 点击       | 高亮节点及其祖先/后代 |
| 固定节点 | 双击       | 保持高亮直到再次双击  |
| 移动节点 | 拖拽图标   | 进入重新关联模式      |
| 取消关联 | 点击"解除" | 节点变为根节点        |
| 删除节点 | 点击删除   | 确认后删除节点及后代  |

### 定时器功能

routine 类型的节点支持定式计时器：

```typescript
// 计时器状态
const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});
// nodeId -> endsAt timestamp

// 启动计时
function handleStartTimer(nodeId: string, minutes: number) {
  const endsAt = Date.now() + minutes * 60 * 1000;
  setActiveTimers((prev) => ({ ...prev, [nodeId]: endsAt }));
}

// 计时完成时发送通知
if (now >= endsAt) {
  new Notification('计时完成', { body: 'RSIP 定式计时已结束' });
}
```

---

## 布局算法

### 树形布局

```typescript
// RSIPCanvas 中的布局算法

const LEVEL_WIDTH = 320; // 每层水平间距
const NODE_HEIGHT = 220; // 节点垂直间距

function layout(node: RSIPTreeNode, depth: number): number {
  // 叶子节点：直接分配当前 Y 坐标
  if (node.children.length === 0) {
    positions[node.id] = { left: depth * LEVEL_WIDTH, top: currentY };
    currentY += NODE_HEIGHT;
    return positions[node.id].top;
  }

  // 非叶子节点：先布局子节点，然后居中
  const childYs = node.children.map((child) => layout(child, depth + 1));
  const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
  positions[node.id] = { left: depth * LEVEL_WIDTH, top: y };
  return y;
}
```

### 连接线计算

```typescript
// 贝塞尔曲线连接父子节点
const d = `M ${p1.x} ${p1.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${p2.x} ${p2.y}`;

// 控制点计算
const base = Math.max(40, Math.abs(dx) * 0.5);
const cx1 = p1.x + base;
const cy1 = p1.y;
const cx2 = p2.x - base;
const cy2 = p2.y;
```

---

## 过滤功能

### 类型过滤

```typescript
// RSIPFilters 组件
const filters = [
  { type: null, label: '全部' },
  { type: 'policy', label: '国策' },
  { type: 'guideline', label: '方针' },
  { type: 'routine', label: '定式' },
];

// 过滤逻辑
const filteredTree = useMemo(() => {
  if (!filterType) return tree;

  // 找到匹配类型的节点
  const matchedNodes = nodes.filter((n) => n.type === filterType);

  // 向上找到所有祖先，保持树结构
  const visibleNodes = new Set<string>();
  matchedNodes.forEach((node) => {
    let current = node;
    while (current) {
      visibleNodes.add(current.id);
      current = nodesById.get(current.parentId);
    }
  });

  return buildRSIPTree(nodes.filter((n) => visibleNodes.has(n.id)));
}, [tree, filterType, nodes]);
```

---

## 存储实现

### Supabase 表结构

```sql
CREATE TABLE rsip_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('policy', 'guideline', 'routine')),
  parent_id UUID REFERENCES rsip_nodes(id),
  chain_id UUID REFERENCES chains(id),
  status TEXT NOT NULL DEFAULT 'active',
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rsip_nodes_user ON rsip_nodes(user_id);
CREATE INDEX idx_rsip_nodes_parent ON rsip_nodes(parent_id);
```

### 存储接口

```typescript
// MomentumStorage 接口中的 RSIP 方法

interface MomentumStorage {
  // RSIP
  getRsipNodes(): Promise<RSIPNode[]>;
  getRsipMeta(): Promise<RSIPMeta | null>;
  saveRsipNodes(nodes: RSIPNode[]): Promise<void>;
  saveRsipMeta(meta: RSIPMeta): Promise<void>;
  createRsipNode(node: Omit<RSIPNode, 'id' | 'createdAt'>): Promise<RSIPNode>;
  updateRsipNode(id: string, updates: Partial<RSIPNode>): Promise<void>;
  deleteRsipNode(id: string): Promise<void>;
}
```

---

## 与任务链集成

### routine 关联链条

routine 类型的节点可以关联一个任务链，实现：

1. 在 RSIP 画布中启动关联的任务链
2. 完成任务链后自动更新 routine 状态
3. 统计 routine 的执行次数和成功率

```typescript
// 关联链条
const routine: RSIPNode = {
  id: 'routine-1',
  title: '晨间冥想',
  type: 'routine',
  chainId: 'chain-meditation-123', // 关联的链条
  // ...
};

// 启动关联链条
function startRoutineChain(routine: RSIPNode) {
  if (routine.chainId) {
    navigate(`/focus/${routine.chainId}`);
  }
}
```

---

## 最佳实践

### 构建 RSIP 树的建议

1. **从上到下**: 先定义 policy，再分解为 guideline，最后细化为 routine
2. **保持平衡**: 每个 policy 下不超过 5 个 guideline
3. **可执行性**: routine 必须是具体可执行的行为
4. **关联链条**: 为重要的 routine 创建对应的任务链

### 示例结构

```
提高工作效率 (policy)
├── 建立晨间routine (guideline)
│   ├── 6:30起床 (routine) → 链条: 早起仪式
│   ├── 15分钟冥想 (routine) → 链条: 晨间冥想
│   └── 规划今日任务 (routine) → 链条: 每日规划
└── 减少干扰 (guideline)
    ├── 工作时间手机静音 (routine)
    └── 关闭社交媒体通知 (routine)
```

---

## 相关文档

- [DOMAIN_RSIP.md](../features/DOMAIN_RSIP.md) - 领域详情
- [RSIP_TASK_INTEGRATION.md](../features/RSIP_TASK_INTEGRATION.md) - RSIP-任务流程联动
- [RSIP_INSIGHTS.md](../features/RSIP_INSIGHTS.md) - 分析与推荐引擎
- [RSIP_POLICY_LIBRARY.md](../features/RSIP_POLICY_LIBRARY.md) - 国策库
- [RSIP_RUN_HISTORY.md](../features/RSIP_RUN_HISTORY.md) - 轮次历史
- [ARCHITECTURE.md](../guides/ARCHITECTURE.md) - 架构总览
- [CHAIN_EDITOR_GUIDE.md](../guides/CHAIN_EDITOR_GUIDE.md) - 链条编辑器

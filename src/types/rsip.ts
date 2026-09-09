// RSIP（递归稳态迭代协议）类型定义

// 定式执行状态
export type RSIPExecutionStatus =
  | 'pending'
  | 'executed'
  | 'violated'
  | 'skipped';

// 稳态阶段：E0（新建）→ E1（稳定，7天）→ E2（内化，21天）
export type RSIPStabilityPhase = 'E0' | 'E1' | 'E2';

// RSIP 模式：自由模式（allowMultiplePerDay=true）或严格模式（allowMultiplePerDay=false）
export type RSIPMode = 'free' | 'strict';

export interface RSIPNode {
  id: string;
  parentId?: string; // 父节点ID
  title: string; // 国策/定式名称
  rule: string; // 精准、可执行的规则描述
  sortOrder: number; // 排序（同一父节点下）
  createdAt: Date; // 创建时间
  // 可选的计时配置（参考神圣座位预约时长逻辑）
  useTimer?: boolean;
  timerMinutes?: number; // 倒计时分钟数
  // 新增：用于UI展示的emoji
  emoji?: string;
  type?: string; // 国策类型

  // === 核心增强字段 ===
  groupId?: string; // 所属国策组ID
  reinforcementLevel?: number; // 强化等级（优先消耗）
  maxReinforcementLevel?: number; // 历史最高强化等级
  cumulativeExecutionDays?: number; // 跨轮次累计执行天数
  isPassive?: boolean; // 被动国策（维护成本近似为0）
  splitFromGoal?: string; // 拆分来源目标

  // === 严格模式字段（仅在 allowMultiplePerDay=false 时使用）===

  // 稳态阶段
  stabilityPhase?: RSIPStabilityPhase; // 默认 'E0'
  phaseStartedAt?: Date; // 当前阶段开始时间

  // 执行追踪
  lastExecutedAt?: Date; // 最近执行时间
  lastViolatedAt?: Date; // 最近违反时间
  consecutiveExecutions?: number; // 连续执行天数
  consecutiveViolations?: number; // 连续违反次数
  totalExecutions?: number; // 总执行次数
  totalViolations?: number; // 总违反次数
}

export interface RSIPTreeNode extends RSIPNode {
  children: RSIPTreeNode[];
  depth: number;
}

export interface RSIPMeta {
  lastAddedAt?: Date; // 最近一次添加国策的日期（用于"一天最多添加一个"限制）
  allowMultiplePerDay?: boolean; // 是否允许一天添加多条（true=自由模式，false=严格模式）

  // === 严格模式字段 ===
  lastTreeOpenedAt?: Date; // 最近打开国策树的时间
  dailyTreeOpenRequired?: boolean; // 是否要求每日打开国策树
  treeOpenStreak?: number; // 连续打开国策树的天数
  phaseDistribution?: { E0: number; E1: number; E2: number }; // 各阶段定式数量统计

  // === 轮次字段 ===
  currentRunNumber?: number; // 当前轮次编号
  currentRunStartedAt?: Date; // 当前轮次开始时间
}

// 定式执行记录（用于追踪每日执行/违反历史）
export interface RSIPExecutionRecord {
  id: string;
  userId?: string; // 用户ID（Supabase）
  nodeId: string; // 关联的定式ID
  executedAt: Date; // 执行时间
  status: RSIPExecutionStatus; // 执行状态
  notes?: string; // 备注
  reasonCode?: string; // 违反/执行原因分类
  repairHint?: string; // 修复建议
  sourceChainId?: string; // 触发来源任务ID（协同链路）
  sourceEvent?: string; // 触发来源事件
}

export interface RSIPNodeGroup {
  id: string;
  title: string;
  faultTolerance: number;
  faultToleranceUsed?: number;
  createdAt: Date;
  emoji?: string;
}

export interface RSIPLibraryEntry {
  id: string;
  title: string;
  rule: string;
  type?: string;
  emoji?: string;
  cumulativeExecutionDays: number;
  internalizationProgress: number; // 0-100
  lastActiveAt: Date;
  timesUsed: number;
  useTimer?: boolean;
  timerMinutes?: number;
  isPassive?: boolean;
}

export interface RSIPRunRecord {
  runNumber: number;
  startedAt: Date;
  endedAt?: Date;
  maxNodeCount: number;
  durationDays: number;
  collapseReason?: string;
  collapseNodeTitle?: string;
}

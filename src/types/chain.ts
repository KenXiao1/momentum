export interface ChainRecord {
  id: string;
  parentId?: string; // 父任务ID，用于构建层级关系
  type: ChainType; // 任务类型/兵种
  sortOrder: number; // 在同一父任务下的排序
  name: string;
  trigger: string;
  duration: number; // in minutes
  description: string;
  currentStreak: number;
  auxiliaryStreak: number; // 辅助链连续成功记录
  totalCompletions: number;
  totalFailures: number;
  auxiliaryFailures: number; // 辅助链失败次数
  exceptions: string[];
  auxiliaryExceptions: string[]; // 辅助链例外规则
  // 辅助链设置
  auxiliarySignal: string; // 预约信号，如"打响指"、"设置闹钟"
  auxiliaryDuration: number; // 预约时长（分钟）
  auxiliaryCompletionTrigger: string; // 预约完成条件，通常与主链trigger相同
  // 任务群时间限定设置
  timeLimitHours?: number; // 时间限制（小时），仅在 type=group 时有效
  timeLimitExceptions: string[]; // 时间限制例外规则
  groupStartedAt?: Date; // 任务群开始时间
  groupExpiresAt?: Date; // 任务群过期时间
  // 无时长任务（手动结束）
  isDurationless?: boolean; // 为 true 时不倒计时，由用户手动结束
  minimumDuration?: number; // 无时长任务的最小时长（分钟），达到后可提前完成
  // 任务群重复功能
  isTaskGroup?: boolean; // 是否为任务群（独立于链系统）
  taskRepeatCount?: number; // 单个任务重复次数
  groupRepeatCount?: number; // 整个任务群重复次数
  // 回收箱功能
  deletedAt?: Date | null; // 软删除时间戳，null表示未删除
  createdAt: Date;
  lastCompletedAt?: Date;
}

type GroupOnlyChainFields =
  | 'timeLimitHours'
  | 'groupStartedAt'
  | 'groupExpiresAt'
  | 'isTaskGroup'
  | 'groupRepeatCount';

export type UnitChainType = Exclude<ChainType, 'group'>;

export type UnitChain = Omit<ChainRecord, GroupOnlyChainFields> & {
  type: UnitChainType;
  timeLimitHours?: never;
  groupStartedAt?: never;
  groupExpiresAt?: never;
  isTaskGroup?: never;
  groupRepeatCount?: never;
};

export type GroupChain = Omit<ChainRecord, 'type'> & {
  type: 'group';
};

export type Chain = UnitChain | GroupChain;

export type DistributiveOmit<T, K extends PropertyKey> = T extends any
  ? Omit<T, K>
  : never;

type ChainSystemFields =
  | 'id'
  | 'currentStreak'
  | 'auxiliaryStreak'
  | 'totalCompletions'
  | 'totalFailures'
  | 'auxiliaryFailures'
  | 'createdAt'
  | 'lastCompletedAt';

export type ChainDraft = DistributiveOmit<Chain, ChainSystemFields>;

export type ChainType =
  | 'unit' // 基础单元
  | 'group' // 任务群容器
  | 'assault' // 突击单元（学习、实验、论文）
  | 'recon' // 侦查单元（信息搜集）
  | 'command' // 指挥单元（制定计划）
  | 'special_ops' // 特勤单元（处理杂事）
  | 'engineering' // 工程单元（运动锻炼）
  | 'quartermaster'; // 炊事单元（备餐做饭）

// 已删除的链条接口
export type DeletedChain = Chain & {
  deletedAt: Date; // 删除时间戳，对于已删除的链条这个字段是必需的
};

// 任务树节点，用于前端渲染层级结构
export type ChainTreeNode = Chain & {
  children: ChainTreeNode[];
};

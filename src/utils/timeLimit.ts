import { Chain } from '../types';

/**
 * 检查任务群是否已过期
 */
export const isGroupExpired = (group: Chain): boolean => {
  if (group.type !== 'group' || !group.timeLimitHours || !group.groupStartedAt) {
    return false;
  }

  const now = new Date();
  const expiresAt = group.groupExpiresAt || new Date(group.groupStartedAt.getTime() + group.timeLimitHours * 60 * 60 * 1000);
  
  return now > expiresAt;
};

/**
 * 获取任务群剩余时间（毫秒）
 */
export const getGroupRemainingTime = (group: Chain): number => {
  if (group.type !== 'group' || !group.timeLimitHours || !group.groupStartedAt) {
    return 0;
  }

  const now = new Date();
  const expiresAt = group.groupExpiresAt || new Date(group.groupStartedAt.getTime() + group.timeLimitHours * 60 * 60 * 1000);
  
  return Math.max(0, expiresAt.getTime() - now.getTime());
};

/**
 * 格式化剩余时间显示
 */
export const formatRemainingTime = (remainingMs: number): string => {
  if (remainingMs <= 0) {
    return '已过期';
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
};

/**
 * 启动任务群计时器
 */
export const startGroupTimer = (group: Chain): Chain => {
  if (group.type !== 'group' || !group.timeLimitHours) {
    return group;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + group.timeLimitHours * 60 * 60 * 1000);

  return {
    ...group,
    groupStartedAt: now,
    groupExpiresAt: expiresAt,
  };
};

/**
 * 检查是否满足例外规则
 */
export const checkTimeLimitException = (group: Chain, reason: string): boolean => {
  if (group.type !== 'group' || !group.timeLimitExceptions) {
    return false;
  }

  return group.timeLimitExceptions.includes(reason);
};

/**
 * 添加时间限制例外规则
 */
export const addTimeLimitException = (group: Chain, exception: string): Chain => {
  if (group.type !== 'group') {
    return group;
  }

  const currentExceptions = group.timeLimitExceptions || [];
  if (!currentExceptions.includes(exception)) {
    return {
      ...group,
      timeLimitExceptions: [...currentExceptions, exception],
    };
  }

  return group;
};

/**
 * 清空任务群进度（超时失败）
 */
export const resetGroupProgress = (group: Chain): Chain => {
  if (group.type !== 'group') {
    return group;
  }

  return {
    ...group,
    currentStreak: 0,
    totalFailures: group.totalFailures + 1,
    groupStartedAt: undefined,
    groupExpiresAt: undefined,
  };
};

/**
 * 获取任务群状态信息
 */
export const getGroupTimeStatus = (group: Chain): {
  isExpired: boolean;
  remainingTime: number;
  formattedTime: string;
  progress: number; // 0-1 之间的进度
} => {
  if (group.type !== 'group' || !group.timeLimitHours || !group.groupStartedAt) {
    return {
      isExpired: false,
      remainingTime: 0,
      formattedTime: '无时间限制',
      progress: 0,
    };
  }

  const isExpired = isGroupExpired(group);
  const remainingTime = getGroupRemainingTime(group);
  const formattedTime = formatRemainingTime(remainingTime);
  
  // 计算时间进度（已用时间 / 总时间）
  const totalTime = group.timeLimitHours * 60 * 60 * 1000;
  const usedTime = totalTime - remainingTime;
  const progress = Math.min(1, Math.max(0, usedTime / totalTime));

  return {
    isExpired,
    remainingTime,
    formattedTime,
    progress,
  };
};

export const formatTime = (minutes: number): string => {
  // 当传入整数分钟时直接显示分钟数
  if (minutes % 1 === 0) {
    return `${minutes}m`;
  }
  
  // 处理带小数的分钟数
  const mins = Math.floor(minutes);
  const secs = Math.floor((minutes - mins) * 60);
  return `${mins}m${secs.toString().padStart(2, '0')}s`;
};

export const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  // 小于1分钟统一显示为0分
  if (minutes === 0) {
    return `0分`;
  }
  
  const secs = seconds % 60;
  if (secs === 0) {
    return `${minutes}分`;
  }
  
  return `${minutes}分${secs}秒`;
};

export const getTimeRemaining = (expiresAt: Date): number => {
  return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
};

export const isSessionExpired = (expiresAt: Date): boolean => {
  return Date.now() > expiresAt.getTime();
};

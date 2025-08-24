import { Chain, DeletedChain, ScheduledSession, ActiveSession, CompletionHistory, RSIPNode, RSIPMeta, TaskTimeStats } from '../types';

const STORAGE_KEYS = {
  CHAINS: 'momentum_chains',
  SCHEDULED_SESSIONS: 'momentum_scheduled_sessions',
  ACTIVE_SESSION: 'momentum_active_session',
  COMPLETION_HISTORY: 'momentum_completion_history',
  RSIP_NODES: 'momentum_rsip_nodes',
  RSIP_META: 'momentum_rsip_meta',
  TASK_TIME_STATS: 'momentum_task_time_stats',
};

export const storage = {
  getChains: (): Chain[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CHAINS);
    if (!data) return [];
    return JSON.parse(data).map((chain: any) => ({
      ...chain,
      auxiliaryStreak: chain.auxiliaryStreak || 0,
      auxiliaryFailures: chain.auxiliaryFailures || 0,
      auxiliaryExceptions: chain.auxiliaryExceptions || [],
      deletedAt: chain.deletedAt ? new Date(chain.deletedAt) : null,
      createdAt: new Date(chain.createdAt),
      lastCompletedAt: chain.lastCompletedAt ? new Date(chain.lastCompletedAt) : undefined,
    }));
  },

  saveChains: (chains: Chain[]): void => {
    localStorage.setItem(STORAGE_KEYS.CHAINS, JSON.stringify(chains));
  },

  getScheduledSessions: (): ScheduledSession[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEDULED_SESSIONS);
    if (!data) return [];
    return JSON.parse(data).map((session: any) => ({
      ...session,
      auxiliarySignal: session.auxiliarySignal || '预约信号',
      scheduledAt: new Date(session.scheduledAt),
      expiresAt: new Date(session.expiresAt),
    }));
  },

  saveScheduledSessions: (sessions: ScheduledSession[]): void => {
    localStorage.setItem(STORAGE_KEYS.SCHEDULED_SESSIONS, JSON.stringify(sessions));
  },

  getActiveSession: (): ActiveSession | null => {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (!data) return null;
    const session = JSON.parse(data);
    return {
      ...session,
      startedAt: new Date(session.startedAt),
      pausedAt: session.pausedAt ? new Date(session.pausedAt) : undefined,
    };
  },

  saveActiveSession: (session: ActiveSession | null): void => {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  },

  getCompletionHistory: (): CompletionHistory[] => {
    const data = localStorage.getItem(STORAGE_KEYS.COMPLETION_HISTORY);
    if (!data) return [];
    return JSON.parse(data).map((history: any) => ({
      ...history,
      completedAt: new Date(history.completedAt),
    }));
  },

  saveCompletionHistory: (history: CompletionHistory[]): void => {
    localStorage.setItem(STORAGE_KEYS.COMPLETION_HISTORY, JSON.stringify(history));
  },

  // RSIP nodes
  getRSIPNodes: (): RSIPNode[] => {
    const data = localStorage.getItem(STORAGE_KEYS.RSIP_NODES);
    if (!data) return [];
    return JSON.parse(data).map((node: any) => ({
      ...node,
      createdAt: new Date(node.createdAt),
    }));
  },

  saveRSIPNodes: (nodes: RSIPNode[]): void => {
    localStorage.setItem(STORAGE_KEYS.RSIP_NODES, JSON.stringify(nodes));
  },

  getRSIPMeta: (): RSIPMeta => {
    const data = localStorage.getItem(STORAGE_KEYS.RSIP_META);
    if (!data) return {};
    const parsed = JSON.parse(data);
    return {
      lastAddedAt: parsed.lastAddedAt ? new Date(parsed.lastAddedAt) : undefined,
      allowMultiplePerDay: !!parsed.allowMultiplePerDay,
    } as RSIPMeta;
  },

  saveRSIPMeta: (meta: RSIPMeta): void => {
    localStorage.setItem(
      STORAGE_KEYS.RSIP_META,
      JSON.stringify({
        ...meta,
        lastAddedAt: meta.lastAddedAt ? meta.lastAddedAt.toISOString() : undefined,
        allowMultiplePerDay: !!meta.allowMultiplePerDay,
      })
    );
  },

  // 回收箱相关方法
  getActiveChains: (): Chain[] => {
    return storage.getChains().filter(chain => chain.deletedAt == null);
  },

  getDeletedChains: (): DeletedChain[] => {
    return storage.getChains()
      .filter(chain => chain.deletedAt != null)
      .map(chain => ({ ...chain, deletedAt: chain.deletedAt! }))
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  },

  softDeleteChain: (chainId: string): void => {
    const chains = storage.getChains();
    const updatedChains = chains.map(chain => {
      if (chain.id === chainId || isChildOf(chain, chainId, chains)) {
        return { ...chain, deletedAt: new Date() };
      }
      return chain;
    });
    storage.saveChains(updatedChains);
  },

  restoreChain: (chainId: string): void => {
    const chains = storage.getChains();
    const updatedChains = chains.map(chain => {
      if (chain.id === chainId || isChildOf(chain, chainId, chains)) {
        return { ...chain, deletedAt: null };
      }
      return chain;
    });
    storage.saveChains(updatedChains);
  },

  permanentlyDeleteChain: (chainId: string): void => {
    const chains = storage.getChains();
    const updatedChains = chains.filter(chain => 
      chain.id !== chainId && !isChildOf(chain, chainId, chains)
    );
    storage.saveChains(updatedChains);
  },

  cleanupExpiredDeletedChains: (olderThanDays: number = 30): number => {
    const chains = storage.getChains();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const chainsToDelete = chains.filter(chain => 
      chain.deletedAt && chain.deletedAt < cutoffDate
    );
    
    const remainingChains = chains.filter(chain => 
      !chain.deletedAt || chain.deletedAt >= cutoffDate
    );
    
    storage.saveChains(remainingChains);
    return chainsToDelete.length;
  },

  // 任务用时统计相关方法
  getTaskTimeStats: (): TaskTimeStats[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TASK_TIME_STATS);
    if (!data) return [];
    return JSON.parse(data);
  },

  saveTaskTimeStats: (stats: TaskTimeStats[]): void => {
    localStorage.setItem(STORAGE_KEYS.TASK_TIME_STATS, JSON.stringify(stats));
  },

  getLastCompletionTime: (chainId: string): number | null => {
    const stats = storage.getTaskTimeStats();
    const chainStats = stats.find(s => s.chainId === chainId);
    return chainStats?.lastCompletionTime || null;
  },

  updateTaskTimeStats: (chainId: string, actualDuration: number): void => {
    const stats = storage.getTaskTimeStats();
    const existingIndex = stats.findIndex(s => s.chainId === chainId);
    
    if (existingIndex >= 0) {
      // 更新现有统计
      const existing = stats[existingIndex];
      const newTotalTime = existing.totalTime + actualDuration;
      const newTotalCompletions = existing.totalCompletions + 1;
      
      stats[existingIndex] = {
        ...existing,
        lastCompletionTime: actualDuration,
        averageCompletionTime: Math.round(newTotalTime / newTotalCompletions),
        totalCompletions: newTotalCompletions,
        totalTime: newTotalTime
      };
    } else {
      // 创建新统计
      stats.push({
        chainId,
        lastCompletionTime: actualDuration,
        averageCompletionTime: actualDuration,
        totalCompletions: 1,
        totalTime: actualDuration
      });
    }
    
    storage.saveTaskTimeStats(stats);
  },

  getTaskAverageTime: (chainId: string): number | null => {
    const stats = storage.getTaskTimeStats();
    const chainStats = stats.find(s => s.chainId === chainId);
    return chainStats?.averageCompletionTime || null;
  },

  // 向后兼容性：为现有历史记录添加用时数据
  migrateCompletionHistoryForTiming: (): void => {
    const history = storage.getCompletionHistory();
    const chains = storage.getChains();
    let hasChanges = false;

    const updatedHistory = history.map(record => {
      // 如果记录还没有用时相关字段，添加它们
      if (record.actualDuration === undefined || record.isForwardTimed === undefined) {
        const chain = chains.find(c => c.id === record.chainId);
        hasChanges = true;
        
        return {
          ...record,
          actualDuration: record.duration, // 使用原计划时长作为实际用时
          isForwardTimed: chain?.isDurationless || false // 根据链条设置判断是否为正向计时
        };
      }
      return record;
    });

    if (hasChanges) {
      storage.saveCompletionHistory(updatedHistory);
    }
  },

  /**
   * Clear all caches (localStorage doesn't have caches, but provides interface compatibility)
   */
  clearCache: (): void => {
    console.log('[LOCAL_STORAGE] Clear cache called (no-op for localStorage)');
    // localStorage doesn't maintain internal caches like Supabase, 
    // but we provide this method for interface compatibility
  },
};

// 辅助函数：检查链条是否是指定链条的子链条
function isChildOf(chain: Chain, parentId: string, allChains: Chain[]): boolean {
  if (!chain.parentId) return false;
  if (chain.parentId === parentId) return true;
  
  const parent = allChains.find(c => c.id === chain.parentId);
  if (!parent) return false;
  
  return isChildOf(parent, parentId, allChains);
}
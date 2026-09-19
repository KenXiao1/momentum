import { createRSIPNodesWithMeta } from './rsipAtomicIntents';
import {
  cleanupExpiredDeletedChains,
  getActiveChains,
  getChains,
  getDeletedChains,
  permanentlyDeleteChain,
  restoreChain,
  saveChains,
  softDeleteChain,
  upsertChain,
} from './chains';
import {
  appendCompletionHistory,
  getCompletionHistory,
  saveCompletionHistory,
} from './history';
import { getPetState, savePetState } from './pet';
import {
  appendRSIPExecutionRecord,
  appendRSIPRunRecord,
  getRSIPExecutionRecords,
  getRSIPGroups,
  getRSIPMeta,
  getRSIPNodes,
  getRSIPPolicyLibrary,
  getRSIPRunHistory,
  getRSIPTaskLinks,
  removeRSIPNodes,
  saveRSIPGroups,
  saveRSIPMeta,
  saveRSIPNodes,
  saveRSIPPolicyLibrary,
  saveRSIPRunHistory,
  saveRSIPTaskLinks,
  upsertRSIPLibraryEntry,
  upsertRSIPNode,
} from './rsip';
import {
  getActiveSession,
  getScheduledSessions,
  removeScheduledSession,
  saveActiveSession,
  saveScheduledSessions,
  setScheduledSession,
} from './sessions';
import {
  getLastCompletionTime,
  getTaskAverageTime,
  getTaskTimeStats,
  migrateCompletionHistoryForTiming,
  saveTaskTimeStats,
  updateTaskTimeStats,
} from './taskTimeStats';

/**
 * LocalStorage-backed storage utility.
 *
 * NOTE: Application data should generally go through MomentumStorage; this module exists
 * for legacy/offline paths and small utilities.
 */
export const storage = {
  getChains,
  saveChains,
  upsertChain,

  getScheduledSessions,
  saveScheduledSessions,
  setScheduledSession,
  removeScheduledSession,

  getActiveSession,
  saveActiveSession,

  getCompletionHistory,
  saveCompletionHistory,
  appendCompletionHistory,

  // RSIP nodes
  createRSIPNodesWithMeta,
  getRSIPNodes,
  saveRSIPNodes,
  upsertRSIPNode,
  removeRSIPNodes,

  getRSIPMeta,
  saveRSIPMeta,
  getRSIPGroups,
  saveRSIPGroups,
  getRSIPPolicyLibrary,
  saveRSIPPolicyLibrary,
  upsertRSIPLibraryEntry,
  getRSIPRunHistory,
  saveRSIPRunHistory,
  appendRSIPRunRecord,
  getRSIPTaskLinks,
  saveRSIPTaskLinks,
  getRSIPExecutionRecords,
  appendRSIPExecutionRecord,

  // 回收箱相关方法
  getActiveChains,
  getDeletedChains,
  softDeleteChain,
  restoreChain,
  permanentlyDeleteChain,
  cleanupExpiredDeletedChains,

  // 任务用时统计相关方法
  getTaskTimeStats,
  saveTaskTimeStats,
  getLastCompletionTime,
  updateTaskTimeStats,
  getTaskAverageTime,
  migrateCompletionHistoryForTiming,

  /**
   * Clear all caches (localStorage doesn't have caches, but provides interface compatibility)
   */
  clearCache: (): void => {
    // localStorage doesn't maintain internal caches like Supabase,
    // but we provide this method for interface compatibility
  },

  // Pet state
  getPetState,
  savePetState,
};

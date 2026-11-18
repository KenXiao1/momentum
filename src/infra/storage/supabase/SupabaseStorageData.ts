import type {
  ChainStore,
  HistoryStore,
  MaintenanceStore,
  SessionStore,
  TaskTimeStatsStore,
} from '../../../storage/ports';
import { migrateCompletionHistoryForTiming } from '../../../utils/completionHistoryTimingMigration';
import * as chainsApi from './chains';
import * as historyApi from './history';
import * as sessionsApi from './sessions';
import { SupabaseStorageCore } from './SupabaseStorageCore';
import * as taskTimeApi from './taskTimeStats';

export abstract class SupabaseStorageData
  extends SupabaseStorageCore
  implements
    ChainStore,
    SessionStore,
    HistoryStore,
    TaskTimeStatsStore,
    MaintenanceStore
{
  getChains() {
    return this.deduplicatedRequest('getChains', () =>
      chainsApi.getChains(this.ctx),
    );
  }
  saveChains: ChainStore['saveChains'] = (chains) =>
    chainsApi.saveChains(this.ctx, chains);
  upsertChain: ChainStore['upsertChain'] = (chain) =>
    chainsApi.upsertChain(this.ctx, chain);
  upsertChains: ChainStore['upsertChains'] = (chains) =>
    chainsApi.upsertChains(this.ctx, chains);
  getActiveChains() {
    return this.deduplicatedRequest('getActiveChains', () =>
      chainsApi.getActiveChains(this.ctx),
    );
  }
  getDeletedChains() {
    return this.deduplicatedRequest('getDeletedChains', () =>
      chainsApi.getDeletedChains(this.ctx),
    );
  }
  softDeleteChain: ChainStore['softDeleteChain'] = (chainId) =>
    chainsApi.softDeleteChain(this.ctx, chainId);
  restoreChain: ChainStore['restoreChain'] = (chainId) =>
    chainsApi.restoreChain(this.ctx, chainId);
  permanentlyDeleteChain: ChainStore['permanentlyDeleteChain'] = (chainId) =>
    chainsApi.permanentlyDeleteChain(this.ctx, chainId);
  cleanupExpiredDeletedChains: ChainStore['cleanupExpiredDeletedChains'] = (
    olderThanDays,
  ) => chainsApi.cleanupExpiredDeletedChains(this.ctx, olderThanDays);

  getScheduledSessions() {
    return this.deduplicatedRequest('getScheduledSessions', () =>
      sessionsApi.getScheduledSessions(this.ctx),
    );
  }
  saveScheduledSessions: SessionStore['saveScheduledSessions'] = (sessions) =>
    sessionsApi.saveScheduledSessions(this.ctx, sessions);
  setScheduledSession: SessionStore['setScheduledSession'] = (session) =>
    sessionsApi.setScheduledSession(this.ctx, session);
  removeScheduledSession: SessionStore['removeScheduledSession'] = (chainId) =>
    sessionsApi.removeScheduledSession(this.ctx, chainId);
  getActiveSession() {
    return this.deduplicatedRequest('getActiveSession', () =>
      sessionsApi.getActiveSession(this.ctx),
    );
  }
  saveActiveSession: SessionStore['saveActiveSession'] = (session) =>
    sessionsApi.saveActiveSession(this.ctx, session);

  getCompletionHistory() {
    return this.deduplicatedRequest('getCompletionHistory', () =>
      historyApi.getCompletionHistory(this.ctx),
    );
  }
  saveCompletionHistory: HistoryStore['saveCompletionHistory'] = (history) =>
    historyApi.saveCompletionHistory(this.ctx, history);
  appendCompletionHistory: HistoryStore['appendCompletionHistory'] = (record) =>
    historyApi.appendCompletionHistory(this.ctx, record);

  getTaskTimeStats: TaskTimeStatsStore['getTaskTimeStats'] = () =>
    taskTimeApi.getTaskTimeStats();
  saveTaskTimeStats: TaskTimeStatsStore['saveTaskTimeStats'] = (stats) =>
    taskTimeApi.saveTaskTimeStats(stats);
  getLastCompletionTime: TaskTimeStatsStore['getLastCompletionTime'] = (
    chainId,
  ) => taskTimeApi.getLastCompletionTime(chainId);
  updateTaskTimeStats: TaskTimeStatsStore['updateTaskTimeStats'] = (
    chainId,
    actualDuration,
  ) => taskTimeApi.updateTaskTimeStats(chainId, actualDuration);
  getTaskAverageTime: TaskTimeStatsStore['getTaskAverageTime'] = (chainId) =>
    taskTimeApi.getTaskAverageTime(chainId);

  async migrateCompletionHistoryForTiming(): Promise<void> {
    try {
      const [history, chains] = await Promise.all([
        this.getCompletionHistory(),
        this.getChains(),
      ]);
      const { updatedHistory, hasChanges } = migrateCompletionHistoryForTiming(
        history,
        chains,
      );
      if (hasChanges) await this.saveCompletionHistory(updatedHistory);
    } catch {
      return;
    }
  }
}

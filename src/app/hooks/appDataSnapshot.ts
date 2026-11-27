import type { MomentumStorage } from '../../storage/MomentumStorage';
import { toError } from '../../utils/errorMessage';
import { logger } from '../../utils/logger';

/**
 * Loads every persisted collection the app edits.
 *
 * Any failed read rejects the whole snapshot. Substituting `[]` for a failed
 * read would show an empty account and let the next save write that empty
 * state back over real data. Only task time stats, a local duration-hint
 * cache that is never written back from app state, may fall back.
 */
export async function loadAppDataSnapshot(storage: MomentumStorage) {
  const [
    chains,
    scheduledSessions,
    activeSession,
    completionHistory,
    rsipNodes,
    rsipMeta,
    rsipGroups,
    rsipPolicyLibrary,
    rsipRunHistory,
    rsipTaskLinks,
    rsipExecutionRecords,
    chainTags,
    taskTimeStats,
  ] = await Promise.all([
    storage.getActiveChains(),
    storage.getScheduledSessions(),
    storage.getActiveSession(),
    storage.getCompletionHistory(),
    storage.getRSIPNodes(),
    storage.getRSIPMeta(),
    storage.getRSIPGroups(),
    storage.getRSIPPolicyLibrary(),
    storage.getRSIPRunHistory(),
    storage.getRSIPTaskLinks(),
    storage.getRSIPExecutionRecords(),
    storage.getChainTagSet(),
    storage.getTaskTimeStats().catch((error: unknown) => {
      logger.warn(
        'APP_SHELL',
        'Failed to load task time stats',
        undefined,
        toError(error),
      );
      return [];
    }),
  ]);

  return {
    chains,
    scheduledSessions,
    activeSession,
    completionHistory,
    rsipNodes,
    rsipMeta,
    rsipGroups,
    rsipPolicyLibrary,
    rsipRunHistory,
    rsipTaskLinks,
    chainTags,
    rsipExecutionRecords,
    taskTimeStats,
  };
}

import type { AppState } from '../../types';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorHandling';
import { rsipTaskIntegrationService } from '../../services/rsip-integration/RSIPTaskIntegrationService';
import { ensureDate } from './rsip/helpers';
import { canCreateRSIPNodes } from './rsip/dailyRules';
import { createGroupOperations } from './rsip/groupOperations';
import { createLibraryOperations } from './rsip/libraryOperations';
import { createNodeOperations } from './rsip/nodeOperations';
import { createRunOperations } from './rsip/runOperations';
import { createTaskLinkOperations } from './rsip/taskLinkOperations';
import type { SaveFns, UseRsipDomainParams } from './rsip/types';

const sliceWriteQueuesBySetter = new WeakMap<
  UseRsipDomainParams['setState'],
  Map<keyof AppState, Promise<void>>
>();

function logPersistenceError(
  message: string,
  context: Record<string, unknown>,
  error: unknown,
) {
  logger.error('RSIP', message, context, toError(error));
}

async function ignoreLoggedPostCommitFailure(
  operation: Promise<unknown>,
): Promise<void> {
  try {
    await operation;
  } catch {
    return;
  }
}

export function useRsipDomain({
  setState,
  storage,
  getState,
  onNavigateToRSIP,
  confirmTaskLink,
}: UseRsipDomainParams) {
  const readState = (): AppState | null => getState?.() ?? null;
  let sliceWriteQueues = sliceWriteQueuesBySetter.get(setState);
  if (!sliceWriteQueues) {
    sliceWriteQueues = new Map();
    sliceWriteQueuesBySetter.set(setState, sliceWriteQueues);
  }

  const persistThenCommitSlice = async <K extends keyof AppState>(
    key: K,
    value: AppState[K],
    persist: () => Promise<void>,
  ) => {
    const previousWrite = sliceWriteQueues.get(key) ?? Promise.resolve();
    const currentWrite = previousWrite
      .catch(() => undefined)
      .then(async () => {
        await persist();
        setState((current) => ({ ...current, [key]: value }));
      });
    sliceWriteQueues.set(key, currentWrite);

    try {
      await currentWrite;
    } finally {
      if (sliceWriteQueues.get(key) === currentWrite) {
        sliceWriteQueues.delete(key);
      }
    }
  };

  const persistThenAppendExecutionRecord = async (
    record: Parameters<SaveFns['appendExecutionRecord']>[0],
  ) => {
    const key = 'rsipExecutionRecords';
    const previousWrite = sliceWriteQueues.get(key) ?? Promise.resolve();
    const currentWrite = previousWrite
      .catch(() => undefined)
      .then(async () => {
        await storage.appendRSIPExecutionRecord(record);
        setState((current) => {
          return {
            ...current,
            rsipExecutionRecords: [...current.rsipExecutionRecords, record],
          };
        });
      });
    sliceWriteQueues.set(key, currentWrite);

    try {
      await currentWrite;
    } finally {
      if (sliceWriteQueues.get(key) === currentWrite) {
        sliceWriteQueues.delete(key);
      }
    }
  };

  const openRSIP = () => {
    onNavigateToRSIP?.();
  };

  const appendExecutionRecord: SaveFns['appendExecutionRecord'] = async (
    record,
  ) => {
    try {
      await persistThenAppendExecutionRecord(record);
    } catch (error) {
      logPersistenceError(
        'Failed to append RSIP execution record',
        { nodeId: record.nodeId, status: record.status },
        error,
      );
      throw error;
    }
  };

  const saveMeta: SaveFns['saveMeta'] = async (meta) => {
    try {
      await persistThenCommitSlice('rsipMeta', meta, () =>
        storage.saveRSIPMeta(meta),
      );
    } catch (error) {
      logPersistenceError('Failed to save RSIP meta', { meta }, error);
      throw error;
    }
  };

  const saveGroups: SaveFns['saveGroups'] = async (groups) => {
    try {
      await persistThenCommitSlice('rsipGroups', groups, () =>
        storage.saveRSIPGroups(groups),
      );
    } catch (error) {
      logPersistenceError(
        'Failed to save RSIP groups',
        { count: groups.length },
        error,
      );
      throw error;
    }
  };

  const savePolicyLibrary: SaveFns['savePolicyLibrary'] = async (entries) => {
    try {
      await persistThenCommitSlice('rsipPolicyLibrary', entries, () =>
        storage.saveRSIPPolicyLibrary(entries),
      );
    } catch (error) {
      logPersistenceError(
        'Failed to save RSIP policy library',
        { count: entries.length },
        error,
      );
      throw error;
    }
  };

  const saveRunHistory: SaveFns['saveRunHistory'] = async (records) => {
    try {
      await persistThenCommitSlice('rsipRunHistory', records, () =>
        storage.saveRSIPRunHistory(records),
      );
    } catch (error) {
      logPersistenceError(
        'Failed to save RSIP run history',
        { count: records.length },
        error,
      );
      throw error;
    }
  };

  const saveTaskLinks: SaveFns['saveTaskLinks'] = async (links) => {
    const normalized = rsipTaskIntegrationService.resolveLatestLinks(
      links.map((link) => ({
        ...link,
        updatedAt: ensureDate(link.updatedAt, new Date()),
      })),
    );

    try {
      await persistThenCommitSlice('rsipTaskLinks', normalized, () =>
        storage.saveRSIPTaskLinks(normalized),
      );
    } catch (error) {
      logPersistenceError(
        'Failed to save RSIP task links',
        { count: normalized.length },
        error,
      );
      throw error;
    }
  };

  const appendRunRecord: SaveFns['appendRunRecord'] = async (
    record,
    nextHistory,
  ) => {
    try {
      await persistThenCommitSlice('rsipRunHistory', nextHistory, () =>
        storage.appendRSIPRunRecord(record),
      );
    } catch (error) {
      logPersistenceError(
        'Failed to append RSIP run history',
        { runNumber: record.runNumber },
        error,
      );
      throw error;
    }
  };

  const upsertLibraryEntry: SaveFns['upsertLibraryEntry'] = async (
    entry,
    nextEntries,
  ) => {
    try {
      await persistThenCommitSlice('rsipPolicyLibrary', nextEntries, () =>
        storage.upsertRSIPLibraryEntry(entry),
      );
    } catch (error) {
      logPersistenceError(
        'Failed to upsert RSIP library entry',
        { entryId: entry.id },
        error,
      );
      throw error;
    }
  };

  const upsertNode: SaveFns['upsertNode'] = async (node, nextNodes) => {
    try {
      await persistThenCommitSlice('rsipNodes', nextNodes, () =>
        storage.upsertRSIPNode(node),
      );
    } catch (error) {
      logPersistenceError(
        'Failed to upsert RSIP node',
        { nodeId: node.id },
        error,
      );
      throw error;
    }
  };

  const removeNodes: SaveFns['removeNodes'] = async (nodeIds, nextNodes) => {
    try {
      await persistThenCommitSlice('rsipNodes', nextNodes, () =>
        storage.removeRSIPNodes(nodeIds),
      );
    } catch (error) {
      logPersistenceError('Failed to remove RSIP nodes', { nodeIds }, error);
      throw error;
    }
  };

  const saveNodes: SaveFns['saveNodes'] = async (nodes) => {
    const writeContext: { previousState: AppState | null } = {
      previousState: null,
    };

    try {
      await persistThenCommitSlice('rsipNodes', nodes, () => {
        writeContext.previousState = readState();
        const previous = writeContext.previousState;
        if (previous) {
          const ids = new Set(previous.rsipNodes.map((node) => node.id));
          const addedCount = nodes.filter((node) => !ids.has(node.id)).length;
          if (
            !canCreateRSIPNodes(
              previous.rsipMeta,
              previous.rsipNodes,
              addedCount,
            )
          ) {
            throw new Error('Strict mode allows only one new policy per day.');
          }
        }
        return storage.saveRSIPNodes(nodes);
      });
    } catch (error) {
      logPersistenceError(
        'Failed to save RSIP nodes',
        { nodeCount: nodes.length },
        error,
      );
      throw error;
    }

    const previousCount = writeContext.previousState?.rsipNodes.length ?? 0;
    const meta = writeContext.previousState?.rsipMeta;
    if (previousCount === 0 && nodes.length > 0 && meta) {
      await ignoreLoggedPostCommitFailure(runOperations.startNewRun(meta));
    }
  };

  const saveFns: SaveFns = {
    appendExecutionRecord,
    appendRunRecord,
    removeNodes,
    saveGroups,
    saveMeta,
    saveNodes,
    savePolicyLibrary,
    saveRunHistory,
    saveTaskLinks,
    upsertLibraryEntry,
    upsertNode,
  };

  const runOperations = createRunOperations({
    readState,
    saveFns,
  });

  const groupOperations = createGroupOperations({
    readState,
    saveFns,
  });

  const libraryOperations = createLibraryOperations({
    readState,
    saveFns,
  });

  const nodeOperations = createNodeOperations({
    readState,
    saveFns,
    archiveToLibrary: libraryOperations.archiveToLibrary,
    recordCollapse: runOperations.recordCollapse,
  });

  const taskLinkOperations = createTaskLinkOperations({
    readState,
    saveFns,
    markExecuted: nodeOperations.markExecuted,
    markViolated: nodeOperations.markViolated,
    confirmTaskLink,
  });

  return {
    openRSIP,
    saveNodes,
    saveMeta,
    saveGroups,
    savePolicyLibrary,
    saveRunHistory,
    saveTaskLinks,
    upsertTaskLinks: taskLinkOperations.upsertTaskLinks,
    createGroup: groupOperations.createGroup,
    isGroupAlive: groupOperations.isGroupAlive,
    archiveToLibrary: libraryOperations.archiveToLibrary,
    restoreFromLibrary: libraryOperations.restoreFromLibrary,
    recordCollapse: runOperations.recordCollapse,
    startNewRun: runOperations.startNewRun,
    getMode: runOperations.getMode,
    isStrictMode: runOperations.isStrictMode,
    markExecuted: nodeOperations.markExecuted,
    markViolated: nodeOperations.markViolated,
    reinforceNode: nodeOperations.reinforceNode,
    recordTreeOpened: runOperations.recordTreeOpened,
    hasOpenedToday: runOperations.hasOpenedToday,
    calculateConstraintPower: nodeOperations.calculateConstraintPower,
    calculatePhaseDistribution: nodeOperations.calculatePhaseDistribution,
    handleTaskEventIntegration: taskLinkOperations.handleTaskEventIntegration,
    getRsipTaskActions: taskLinkOperations.getRsipTaskActions,
  };
}

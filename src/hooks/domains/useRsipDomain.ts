import type { AppState, RSIPNode } from '../../types';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorHandling';
import { rsipTaskIntegrationService } from '../../services/rsip-integration/RSIPTaskIntegrationService';
import { ensureDate } from './rsip/helpers';
import { canCreateRSIPNodes } from '../../domain/rsip';
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

/** Logs a failed RSIP write with its context for diagnostics, then rethrows. */
async function logFailure(
  message: string,
  context: Record<string, unknown>,
  write: () => Promise<void>,
): Promise<void> {
  try {
    await write();
  } catch (error) {
    // error-handling: the one place RSIP writes are logged with their context
    logPersistenceError(message, context, error);
    throw error;
  }
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

  const enqueueWrite = async (
    keys: (keyof AppState)[],
    write: () => Promise<void>,
  ) => {
    const previousWrites = keys.map((key) => sliceWriteQueues.get(key));
    const currentWrite = Promise.all(
      previousWrites.map((previous) => previous?.catch(() => undefined)),
    ).then(write);
    for (const key of keys) sliceWriteQueues.set(key, currentWrite);
    try {
      await currentWrite;
    } finally {
      for (const key of keys) {
        if (sliceWriteQueues.get(key) === currentWrite)
          sliceWriteQueues.delete(key);
      }
    }
  };

  const persistThenCommitSlice = <K extends keyof AppState>(
    key: K,
    value: AppState[K],
    persist: () => Promise<void>,
  ) =>
    enqueueWrite([key], async () => {
      await persist();
      setState((current) => ({ ...current, [key]: value }));
    });

  const openRSIP = () => {
    onNavigateToRSIP?.();
  };

  const appendExecutionRecord: SaveFns['appendExecutionRecord'] = async (
    record,
  ) => {
    await logFailure(
      'Failed to append RSIP execution record',
      { nodeId: record.nodeId, status: record.status },
      () =>
        enqueueWrite(['rsipExecutionRecords'], async () => {
          await storage.appendRSIPExecutionRecord(record);
          setState((current) => ({
            ...current,
            rsipExecutionRecords: [...current.rsipExecutionRecords, record],
          }));
        }),
    );
  };

  const saveMeta: SaveFns['saveMeta'] = async (meta) => {
    await logFailure('Failed to save RSIP meta', { meta }, () =>
      enqueueWrite(['rsipMeta'], async () => {
        const nextMeta =
          typeof meta === 'function'
            ? meta(readState()?.rsipMeta ?? (await storage.getRSIPMeta()))
            : meta;
        await storage.saveRSIPMeta(nextMeta);
        setState((current) => ({ ...current, rsipMeta: nextMeta }));
      }),
    );
  };

  const saveGroups: SaveFns['saveGroups'] = async (groups) => {
    await logFailure(
      'Failed to save RSIP groups',
      { count: groups.length },
      () =>
        persistThenCommitSlice('rsipGroups', groups, () =>
          storage.saveRSIPGroups(groups),
        ),
    );
  };

  const savePolicyLibrary: SaveFns['savePolicyLibrary'] = async (entries) => {
    await logFailure(
      'Failed to save RSIP policy library',
      { count: entries.length },
      () =>
        persistThenCommitSlice('rsipPolicyLibrary', entries, () =>
          storage.saveRSIPPolicyLibrary(entries),
        ),
    );
  };

  const saveRunHistory: SaveFns['saveRunHistory'] = async (records) => {
    await logFailure(
      'Failed to save RSIP run history',
      { count: records.length },
      () =>
        persistThenCommitSlice('rsipRunHistory', records, () =>
          storage.saveRSIPRunHistory(records),
        ),
    );
  };

  const saveTaskLinks: SaveFns['saveTaskLinks'] = async (links) => {
    const normalized = rsipTaskIntegrationService.resolveLatestLinks(
      links.map((link) => ({
        ...link,
        updatedAt: ensureDate(link.updatedAt, new Date()),
      })),
    );

    await logFailure(
      'Failed to save RSIP task links',
      { count: normalized.length },
      () =>
        persistThenCommitSlice('rsipTaskLinks', normalized, () =>
          storage.saveRSIPTaskLinks(normalized),
        ),
    );
  };

  const appendRunRecord: SaveFns['appendRunRecord'] = async (
    record,
    nextHistory,
  ) => {
    await logFailure(
      'Failed to append RSIP run history',
      { runNumber: record.runNumber },
      () =>
        persistThenCommitSlice('rsipRunHistory', nextHistory, () =>
          storage.appendRSIPRunRecord(record),
        ),
    );
  };

  const upsertLibraryEntry: SaveFns['upsertLibraryEntry'] = async (
    entry,
    nextEntries,
  ) => {
    await logFailure(
      'Failed to upsert RSIP library entry',
      { entryId: entry.id },
      () =>
        persistThenCommitSlice('rsipPolicyLibrary', nextEntries, () =>
          storage.upsertRSIPLibraryEntry(entry),
        ),
    );
  };

  const upsertNode: SaveFns['upsertNode'] = async (node, nextNodes) => {
    await logFailure('Failed to upsert RSIP node', { nodeId: node.id }, () =>
      persistThenCommitSlice('rsipNodes', nextNodes, () =>
        storage.upsertRSIPNode(node),
      ),
    );
  };

  const removeNodes: SaveFns['removeNodes'] = async (nodeIds, nextNodes) => {
    await logFailure('Failed to remove RSIP nodes', { nodeIds }, () =>
      persistThenCommitSlice('rsipNodes', nextNodes, () =>
        storage.removeRSIPNodes(nodeIds),
      ),
    );
  };

  const createNodes = async (newNodes: RSIPNode[]): Promise<void> => {
    if (newNodes.length === 0) return;
    await logFailure(
      'Failed to create RSIP nodes',
      { nodeCount: newNodes.length },
      () =>
        enqueueWrite(['rsipNodes', 'rsipMeta'], async () => {
          const state = readState();
          const currentNodes =
            state?.rsipNodes ?? (await storage.getRSIPNodes());
          const meta = state?.rsipMeta ?? (await storage.getRSIPMeta());
          const ids = new Set(currentNodes.map((node) => node.id));
          const addedCount = newNodes.filter(
            (node) => !ids.has(node.id),
          ).length;
          if (!canCreateRSIPNodes(meta, currentNodes, addedCount)) {
            throw new Error('Strict mode allows only one new policy per day.');
          }
          const createdAt = newNodes[0].createdAt;
          const persisted = await storage.createRSIPNodesWithMeta(newNodes, {
            ...meta,
            lastAddedAt: createdAt,
            currentRunNumber: meta.currentRunNumber ?? 1,
            currentRunStartedAt: meta.currentRunStartedAt ?? createdAt,
          });
          const requestedIds = new Set(newNodes.map((node) => node.id));
          setState((current) => ({
            ...current,
            rsipNodes: [
              ...current.rsipNodes.filter((node) => !requestedIds.has(node.id)),
              ...persisted.nodes,
            ].sort((left, right) => left.sortOrder - right.sortOrder),
            rsipMeta: persisted.meta,
          }));
        }),
    );
  };

  const saveNodes: SaveFns['saveNodes'] = async (nodes) => {
    const writeContext: { previousState: AppState | null } = {
      previousState: null,
    };

    await logFailure(
      'Failed to save RSIP nodes',
      { nodeCount: nodes.length },
      () =>
        persistThenCommitSlice('rsipNodes', nodes, () => {
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
              throw new Error(
                'Strict mode allows only one new policy per day.',
              );
            }
          }
          return storage.saveRSIPNodes(nodes);
        }),
    );

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
    createNodes,
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

import type { RSIPLibraryEntry, RSIPMeta, RSIPNode } from '../../types';
import { STORAGE_KEYS } from './keys';
import {
  getRSIPMeta,
  getRSIPNodes,
  getRSIPPolicyLibrary,
  serializeRSIPMeta,
} from './rsip';
import {
  commitRSIPAtomicJournal,
  type IndexedRSIPSnapshot,
} from './rsipAtomicJournal';

function assertUniqueNodeIds(nodes: RSIPNode[]): void {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) {
      throw new Error(`Duplicate RSIP node id in atomic intent: ${node.id}`);
    }
    ids.add(node.id);
  }
}

function mergeNewNodes(current: RSIPNode[], newNodes: RSIPNode[]): RSIPNode[] {
  const currentIds = new Set(current.map((node) => node.id));
  return [
    ...current,
    ...newNodes.filter((node) => !currentIds.has(node.id)),
  ].sort((left, right) => left.sortOrder - right.sortOrder);
}

function serializeRecord(value: unknown): Record<string, unknown> {
  const serialized = JSON.parse(JSON.stringify(value)) as unknown;
  if (
    typeof serialized !== 'object' ||
    serialized === null ||
    Array.isArray(serialized)
  ) {
    throw new Error('RSIP atomic intent value must serialize to an object');
  }
  return serialized as Record<string, unknown>;
}

function indexedSnapshots<T extends { id: string }>(
  values: T[],
  affectedIds: Set<string>,
): IndexedRSIPSnapshot[] {
  return values.flatMap((value, index) =>
    affectedIds.has(value.id) ? [{ index, value: serializeRecord(value) }] : [],
  );
}

function mergeCreationMeta(current: RSIPMeta, intended: RSIPMeta): RSIPMeta {
  const currentLastAddedAt = current.lastAddedAt;
  const intendedLastAddedAt = intended.lastAddedAt;
  const lastAddedAt =
    currentLastAddedAt && intendedLastAddedAt
      ? latestDate(currentLastAddedAt, intendedLastAddedAt)
      : (currentLastAddedAt ?? intendedLastAddedAt);

  return {
    ...intended,
    ...current,
    lastAddedAt,
    currentRunNumber: current.currentRunNumber ?? intended.currentRunNumber,
    currentRunStartedAt:
      current.currentRunStartedAt ?? intended.currentRunStartedAt,
  };
}

function latestDate(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : right;
}

function collectPersistedSubtreeIds(
  nodes: RSIPNode[],
  requestedRootIds: Set<string>,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) {
      continue;
    }
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParent.set(node.parentId, children);
  }

  const liveIds = new Set(
    nodes
      .filter((node) => requestedRootIds.has(node.id))
      .map((node) => node.id),
  );
  const pending = [...liveIds];
  while (pending.length > 0) {
    const parentId = pending.pop();
    if (!parentId) {
      continue;
    }
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (liveIds.has(childId)) {
        continue;
      }
      liveIds.add(childId);
      pending.push(childId);
    }
  }
  return liveIds;
}

function mergeArchivedEntries(
  current: RSIPLibraryEntry[],
  intended: RSIPLibraryEntry[],
  liveNodeIds: Set<string>,
): RSIPLibraryEntry[] {
  const intendedById = new Map(
    intended
      .filter((entry) => liveNodeIds.has(entry.id))
      .map((entry) => [entry.id, entry]),
  );
  for (const nodeId of liveNodeIds) {
    if (!intendedById.has(nodeId)) {
      throw new Error(
        `Missing RSIP library entry for archived node: ${nodeId}`,
      );
    }
  }

  const currentIds = new Set(current.map((entry) => entry.id));
  return [
    ...current.map((entry) => {
      const next = intendedById.get(entry.id);
      if (!next) {
        return entry;
      }
      return {
        ...next,
        cumulativeExecutionDays: Math.max(
          entry.cumulativeExecutionDays,
          next.cumulativeExecutionDays,
        ),
        internalizationProgress: Math.max(
          entry.internalizationProgress,
          next.internalizationProgress,
        ),
        lastActiveAt: latestDate(entry.lastActiveAt, next.lastActiveAt),
        timesUsed: entry.timesUsed,
      };
    }),
    ...intended.filter(
      (entry) => liveNodeIds.has(entry.id) && !currentIds.has(entry.id),
    ),
  ];
}

export function createRSIPNodesWithMeta(
  newNodes: RSIPNode[],
  nextMeta: RSIPMeta,
): { nodes: RSIPNode[]; meta: RSIPMeta } {
  assertUniqueNodeIds(newNodes);
  const currentNodes = getRSIPNodes();
  const currentIds = new Set(currentNodes.map((node) => node.id));
  const nodesToAdd = mergeNewNodes(currentNodes, newNodes).filter(
    (node) => !currentIds.has(node.id),
  );
  const mergedMeta = mergeCreationMeta(getRSIPMeta(), nextMeta);
  const previousMetaRaw = localStorage.getItem(STORAGE_KEYS.RSIP_META);
  commitRSIPAtomicJournal({
    kind: 'create_nodes_with_meta',
    nodesToAdd: nodesToAdd.map(serializeRecord),
    nextMeta: serializeRecord(JSON.parse(serializeRSIPMeta(mergedMeta))),
    previousMeta: previousMetaRaw
      ? serializeRecord(JSON.parse(previousMetaRaw))
      : null,
  });
  const requestedIds = new Set(newNodes.map((node) => node.id));
  return {
    nodes: getRSIPNodes().filter((node) => requestedIds.has(node.id)),
    meta: getRSIPMeta(),
  };
}

export function archiveRSIPNodesAndRemove(
  nodeIds: string[],
  nextLibrary: RSIPLibraryEntry[],
): void {
  const requestedIds = new Set(nodeIds);
  if (requestedIds.size === 0) {
    return;
  }

  const currentNodes = getRSIPNodes();
  const liveNodeIds = collectPersistedSubtreeIds(currentNodes, requestedIds);
  if (liveNodeIds.size === 0) {
    return;
  }

  const currentLibrary = getRSIPPolicyLibrary();
  const mergedLibrary = mergeArchivedEntries(
    currentLibrary,
    nextLibrary,
    liveNodeIds,
  );
  commitRSIPAtomicJournal({
    kind: 'archive_nodes',
    removedNodes: indexedSnapshots(currentNodes, liveNodeIds),
    nextEntries: mergedLibrary
      .filter((entry) => liveNodeIds.has(entry.id))
      .map(serializeRecord),
    previousEntries: indexedSnapshots(currentLibrary, liveNodeIds),
  });
}

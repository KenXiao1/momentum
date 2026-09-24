import { recoverOperationJournal } from './operationJournal';
import type {
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../../types';
import {
  decodeRSIPExecutionRecord,
  decodeRSIPLibraryEntry,
  decodeRSIPMeta,
  decodeRSIPNode,
  decodeRSIPNodeGroup,
  decodeRSIPRunRecord,
  decodeRSIPTaskLink,
  toIsoString,
  type SerializedRSIPExecutionRecord,
  type SerializedRSIPLibraryEntry,
  type SerializedRSIPMeta,
  type SerializedRSIPNode,
  type SerializedRSIPNodeGroup,
  type SerializedRSIPRunRecord,
  type SerializedRSIPTaskLink,
} from '../../serialization';
import { recoverRSIPAtomicJournal } from './rsipAtomicJournal';
import { STORAGE_KEYS } from './keys';

export function getRSIPNodes(): RSIPNode[] {
  recoverOperationJournal();
  recoverRSIPAtomicJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_NODES);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPNode[]).map(decodeRSIPNode);
}

export function saveRSIPNodes(nodes: RSIPNode[]): void {
  recoverOperationJournal();
  localStorage.setItem(STORAGE_KEYS.RSIP_NODES, JSON.stringify(nodes));
}

export function upsertRSIPNode(node: RSIPNode): void {
  recoverOperationJournal();
  const current = getRSIPNodes();
  const next = current.filter((existingNode) => existingNode.id !== node.id);
  next.push(node);
  saveRSIPNodes(next.sort((left, right) => left.sortOrder - right.sortOrder));
}

export function removeRSIPNodes(nodeIds: string[]): void {
  recoverOperationJournal();
  if (nodeIds.length === 0) {
    return;
  }

  const nodeIdSet = new Set(nodeIds);
  saveRSIPNodes(getRSIPNodes().filter((node) => !nodeIdSet.has(node.id)));
}

export function getRSIPMeta(): RSIPMeta {
  recoverOperationJournal();
  recoverRSIPAtomicJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_META);
  if (!data) return {};

  return decodeRSIPMeta(JSON.parse(data) as SerializedRSIPMeta);
}

export function serializeRSIPMeta(meta: RSIPMeta): string {
  recoverOperationJournal();
  return JSON.stringify({
    ...meta,
    lastAddedAt: meta.lastAddedAt ? toIsoString(meta.lastAddedAt) : undefined,
    lastTreeOpenedAt: meta.lastTreeOpenedAt
      ? toIsoString(meta.lastTreeOpenedAt)
      : undefined,
    currentRunStartedAt: meta.currentRunStartedAt
      ? toIsoString(meta.currentRunStartedAt)
      : undefined,
    allowMultiplePerDay: !!meta.allowMultiplePerDay,
  });
}

export function saveRSIPMeta(meta: RSIPMeta): void {
  recoverOperationJournal();
  localStorage.setItem(STORAGE_KEYS.RSIP_META, serializeRSIPMeta(meta));
}

export function getRSIPGroups(): RSIPNodeGroup[] {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_GROUPS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPNodeGroup[]).map(
    decodeRSIPNodeGroup,
  );
}

export function saveRSIPGroups(groups: RSIPNodeGroup[]): void {
  recoverOperationJournal();
  localStorage.setItem(STORAGE_KEYS.RSIP_GROUPS, JSON.stringify(groups));
}

export function getRSIPPolicyLibrary(): RSIPLibraryEntry[] {
  recoverOperationJournal();
  recoverRSIPAtomicJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_POLICY_LIBRARY);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPLibraryEntry[]).map(
    decodeRSIPLibraryEntry,
  );
}

export function saveRSIPPolicyLibrary(entries: RSIPLibraryEntry[]): void {
  recoverOperationJournal();
  localStorage.setItem(
    STORAGE_KEYS.RSIP_POLICY_LIBRARY,
    JSON.stringify(entries),
  );
}

export function upsertRSIPLibraryEntry(entry: RSIPLibraryEntry): void {
  recoverOperationJournal();
  const current = getRSIPPolicyLibrary();
  const next = current.filter((existingEntry) => existingEntry.id !== entry.id);
  next.push(entry);
  saveRSIPPolicyLibrary(next);
}

export function getRSIPRunHistory(): RSIPRunRecord[] {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_RUN_HISTORY);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPRunRecord[]).map(
    decodeRSIPRunRecord,
  );
}

export function saveRSIPRunHistory(records: RSIPRunRecord[]): void {
  recoverOperationJournal();
  localStorage.setItem(STORAGE_KEYS.RSIP_RUN_HISTORY, JSON.stringify(records));
}

export function appendRSIPRunRecord(record: RSIPRunRecord): void {
  recoverOperationJournal();
  saveRSIPRunHistory([record, ...getRSIPRunHistory()]);
}

export function getRSIPTaskLinks(): RSIPTaskLink[] {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_TASK_LINKS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPTaskLink[]).map(decodeRSIPTaskLink);
}

export function saveRSIPTaskLinks(links: RSIPTaskLink[]): void {
  recoverOperationJournal();
  localStorage.setItem(STORAGE_KEYS.RSIP_TASK_LINKS, JSON.stringify(links));
}

export function getRSIPExecutionRecords(): RSIPExecutionRecord[] {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_EXECUTION_RECORDS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPExecutionRecord[]).map(
    decodeRSIPExecutionRecord,
  );
}

export function appendRSIPExecutionRecord(record: RSIPExecutionRecord): void {
  recoverOperationJournal();
  const current = getRSIPExecutionRecords();
  current.push(record);
  localStorage.setItem(
    STORAGE_KEYS.RSIP_EXECUTION_RECORDS,
    JSON.stringify(current),
  );
}

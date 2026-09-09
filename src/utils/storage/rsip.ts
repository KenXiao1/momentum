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
  recoverRSIPAtomicJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_NODES);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPNode[]).map(decodeRSIPNode);
}

export function saveRSIPNodes(nodes: RSIPNode[]): void {
  localStorage.setItem(STORAGE_KEYS.RSIP_NODES, JSON.stringify(nodes));
}

export function upsertRSIPNode(node: RSIPNode): void {
  const current = getRSIPNodes();
  const next = current.filter((existingNode) => existingNode.id !== node.id);
  next.push(node);
  saveRSIPNodes(next.sort((left, right) => left.sortOrder - right.sortOrder));
}

export function removeRSIPNodes(nodeIds: string[]): void {
  if (nodeIds.length === 0) {
    return;
  }

  const nodeIdSet = new Set(nodeIds);
  saveRSIPNodes(getRSIPNodes().filter((node) => !nodeIdSet.has(node.id)));
}

export function getRSIPMeta(): RSIPMeta {
  recoverRSIPAtomicJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_META);
  if (!data) return {};

  return decodeRSIPMeta(JSON.parse(data) as SerializedRSIPMeta);
}

export function serializeRSIPMeta(meta: RSIPMeta): string {
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
  localStorage.setItem(STORAGE_KEYS.RSIP_META, serializeRSIPMeta(meta));
}

export function getRSIPGroups(): RSIPNodeGroup[] {
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_GROUPS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPNodeGroup[]).map(
    decodeRSIPNodeGroup,
  );
}

export function saveRSIPGroups(groups: RSIPNodeGroup[]): void {
  localStorage.setItem(STORAGE_KEYS.RSIP_GROUPS, JSON.stringify(groups));
}

export function getRSIPPolicyLibrary(): RSIPLibraryEntry[] {
  recoverRSIPAtomicJournal();
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_POLICY_LIBRARY);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPLibraryEntry[]).map(
    decodeRSIPLibraryEntry,
  );
}

export function saveRSIPPolicyLibrary(entries: RSIPLibraryEntry[]): void {
  localStorage.setItem(
    STORAGE_KEYS.RSIP_POLICY_LIBRARY,
    JSON.stringify(entries),
  );
}

export function upsertRSIPLibraryEntry(entry: RSIPLibraryEntry): void {
  const current = getRSIPPolicyLibrary();
  const next = current.filter((existingEntry) => existingEntry.id !== entry.id);
  next.push(entry);
  saveRSIPPolicyLibrary(next);
}

export function getRSIPRunHistory(): RSIPRunRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_RUN_HISTORY);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPRunRecord[]).map(
    decodeRSIPRunRecord,
  );
}

export function saveRSIPRunHistory(records: RSIPRunRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.RSIP_RUN_HISTORY, JSON.stringify(records));
}

export function appendRSIPRunRecord(record: RSIPRunRecord): void {
  saveRSIPRunHistory([record, ...getRSIPRunHistory()]);
}

export function getRSIPTaskLinks(): RSIPTaskLink[] {
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_TASK_LINKS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPTaskLink[]).map(decodeRSIPTaskLink);
}

export function saveRSIPTaskLinks(links: RSIPTaskLink[]): void {
  localStorage.setItem(STORAGE_KEYS.RSIP_TASK_LINKS, JSON.stringify(links));
}

export function getRSIPExecutionRecords(): RSIPExecutionRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.RSIP_EXECUTION_RECORDS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedRSIPExecutionRecord[]).map(
    decodeRSIPExecutionRecord,
  );
}

export function appendRSIPExecutionRecord(record: RSIPExecutionRecord): void {
  const current = getRSIPExecutionRecords();
  current.push(record);
  localStorage.setItem(
    STORAGE_KEYS.RSIP_EXECUTION_RECORDS,
    JSON.stringify(current),
  );
}

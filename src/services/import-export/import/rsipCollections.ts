import type {
  RSIPLibraryEntry,
  RSIPNodeGroup,
  RSIPRunRecord,
} from '../../../types';
import {
  getTrimmedNonEmptyString,
  isRecord,
  parseTruthyDateOrNow,
  parseTruthyDateOrUndefined,
  toNumber,
  toOptionalBoolean,
  toOptionalNumber,
  toOptionalString,
} from '../../../serialization/primitives';
import { generateId } from './id';
import { buildIdMap, buildMappedId } from './rsipCore';

export function parseImportRsipGroups(
  rsipGroups: unknown,
  existingGroups: RSIPNodeGroup[] | undefined,
): { groups: RSIPNodeGroup[]; groupIdMap: Map<string, string> } {
  if (!Array.isArray(rsipGroups)) {
    return { groups: [], groupIdMap: new Map() };
  }
  const existingIds = new Set((existingGroups ?? []).map((group) => group.id));
  const groupIdMap = buildIdMap(rsipGroups, existingIds, 'rsip-group');
  const groups = rsipGroups
    .filter((raw): raw is Record<string, unknown> => isRecord(raw))
    .map((raw) => ({
      id: buildMappedId(
        getTrimmedNonEmptyString(raw.id),
        groupIdMap,
        'rsip-group',
      ),
      title: String(raw.title ?? ''),
      faultTolerance: Math.max(0, toNumber(raw.faultTolerance, 0)),
      faultToleranceUsed: toOptionalNumber(raw.faultToleranceUsed),
      createdAt: parseTruthyDateOrNow(raw.createdAt),
      emoji: toOptionalString(raw.emoji),
    }));
  return { groups, groupIdMap };
}

export function parseImportRsipLibrary(
  rsipPolicyLibrary: unknown,
): RSIPLibraryEntry[] {
  if (!Array.isArray(rsipPolicyLibrary)) return [];
  return rsipPolicyLibrary
    .filter((raw): raw is Record<string, unknown> => isRecord(raw))
    .map((raw) => ({
      id: generateId('rsip-lib'),
      title: String(raw.title ?? ''),
      rule: String(raw.rule ?? ''),
      type: toOptionalString(raw.type),
      emoji: toOptionalString(raw.emoji),
      cumulativeExecutionDays: Math.max(
        0,
        toNumber(raw.cumulativeExecutionDays, 0),
      ),
      internalizationProgress: Math.max(
        0,
        toNumber(raw.internalizationProgress, 0),
      ),
      lastActiveAt: parseTruthyDateOrNow(raw.lastActiveAt),
      timesUsed: Math.max(0, toNumber(raw.timesUsed, 0)),
      useTimer: toOptionalBoolean(raw.useTimer),
      timerMinutes: toOptionalNumber(raw.timerMinutes),
      isPassive: toOptionalBoolean(raw.isPassive),
    }));
}

export function parseImportRsipRunHistory(
  rsipRunHistory: unknown,
): RSIPRunRecord[] {
  if (!Array.isArray(rsipRunHistory)) return [];
  return rsipRunHistory
    .filter((raw): raw is Record<string, unknown> => isRecord(raw))
    .map((raw, index) => ({
      runNumber: Math.max(1, toNumber(raw.runNumber, index + 1)),
      startedAt: parseTruthyDateOrNow(raw.startedAt),
      endedAt: parseTruthyDateOrUndefined(raw.endedAt),
      maxNodeCount: Math.max(0, toNumber(raw.maxNodeCount, 0)),
      durationDays: Math.max(0, toNumber(raw.durationDays, 0)),
      collapseReason: toOptionalString(raw.collapseReason),
      collapseNodeTitle: toOptionalString(raw.collapseNodeTitle),
    }));
}

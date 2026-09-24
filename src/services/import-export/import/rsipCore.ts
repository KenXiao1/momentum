import type { RSIPMeta, RSIPNode, RSIPStabilityPhase } from '../../../types';
import {
  getTrimmedNonEmptyString,
  isRecord,
  parseDateOrUndefined,
  parseTruthyDateOrNow,
  parseTruthyDateOrUndefined,
  toNumber,
  toOptionalBoolean,
  toOptionalNumber,
  toOptionalString,
} from '../../../serialization/primitives';
import type { ImportTranslator } from './types';
import { generateId } from './id';

const RSIP_STABILITY_PHASES: RSIPStabilityPhase[] = ['E0', 'E1', 'E2'];

export function parseEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  if (typeof value !== 'string') return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function buildMappedId(
  sourceId: string | undefined,
  idMap: Map<string, string>,
  fallbackPrefix: string,
): string {
  if (sourceId) {
    const mapped = idMap.get(sourceId);
    if (mapped) return mapped;
  }
  return generateId(fallbackPrefix);
}

export function buildIdMap(
  rawItems: unknown[],
  existingIds: Set<string>,
  prefix: string,
): Map<string, string> {
  const idMap = new Map<string, string>();
  for (const raw of rawItems) {
    if (!isRecord(raw)) continue;
    const sourceId =
      getTrimmedNonEmptyString(raw.id) ?? generateId(`${prefix}-source`);
    let nextId = generateId(prefix);
    while (existingIds.has(nextId)) nextId = generateId(prefix);
    idMap.set(sourceId, nextId);
    existingIds.add(nextId);
  }
  return idMap;
}

export function getStringFromCandidates(
  raw: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = getTrimmedNonEmptyString(raw[key]);
    if (value) return value;
  }
  return undefined;
}

function parsePhaseDistribution(
  phaseDistribution: unknown,
): RSIPMeta['phaseDistribution'] | undefined {
  if (!isRecord(phaseDistribution)) return undefined;
  return {
    E0: toNumber(phaseDistribution.E0, 0),
    E1: toNumber(phaseDistribution.E1, 0),
    E2: toNumber(phaseDistribution.E2, 0),
  };
}

function mapImportedRsipNode(
  raw: Record<string, unknown>,
  idMap: Map<string, string>,
  groupIdMap: Map<string, string> | undefined,
  t: ImportTranslator,
): RSIPNode {
  const sourceId = getTrimmedNonEmptyString(raw.id);
  const sourceParentId = getStringFromCandidates(raw, [
    'parentId',
    'parent_id',
  ]);
  const sourceGroupId = getStringFromCandidates(raw, ['groupId', 'group_id']);
  let groupId: string | undefined;
  if (sourceGroupId) {
    groupId = groupIdMap ? groupIdMap.get(sourceGroupId) : sourceGroupId;
  }

  return {
    id: buildMappedId(sourceId, idMap, 'rsip'),
    parentId: sourceParentId
      ? (idMap.get(sourceParentId) ?? sourceParentId)
      : undefined,
    title: String(
      raw.title ?? t('importExport.import.rsipCore.untitledPolicy'),
    ),
    rule: String(raw.rule ?? ''),
    sortOrder: toNumber(raw.sortOrder, Math.floor(Date.now() / 1000)),
    createdAt: parseTruthyDateOrNow(raw.createdAt),
    useTimer: toOptionalBoolean(raw.useTimer),
    timerMinutes: toOptionalNumber(raw.timerMinutes),
    emoji: toOptionalString(raw.emoji),
    type: toOptionalString(raw.type),
    groupId,
    reinforcementLevel: toOptionalNumber(raw.reinforcementLevel),
    maxReinforcementLevel: toOptionalNumber(raw.maxReinforcementLevel),
    cumulativeExecutionDays: toOptionalNumber(raw.cumulativeExecutionDays),
    isPassive: toOptionalBoolean(raw.isPassive),
    splitFromGoal: toOptionalString(raw.splitFromGoal),
    stabilityPhase: parseEnumValue(raw.stabilityPhase, RSIP_STABILITY_PHASES),
    phaseStartedAt: parseTruthyDateOrUndefined(raw.phaseStartedAt),
    lastExecutedAt: parseTruthyDateOrUndefined(raw.lastExecutedAt),
    lastViolatedAt: parseTruthyDateOrUndefined(raw.lastViolatedAt),
    consecutiveExecutions: toOptionalNumber(raw.consecutiveExecutions),
    consecutiveViolations: toOptionalNumber(raw.consecutiveViolations),
    totalExecutions: toOptionalNumber(raw.totalExecutions),
    totalViolations: toOptionalNumber(raw.totalViolations),
  };
}

export function parseImportRsipNodes(
  rsipNodes: unknown,
  existingRsipNodes: RSIPNode[] | undefined,
  t: ImportTranslator,
  groupIdMap?: Map<string, string>,
): { nodes: RSIPNode[]; rsipIdMap: Map<string, string> } {
  if (!Array.isArray(rsipNodes)) return { nodes: [], rsipIdMap: new Map() };
  const existingIds = new Set((existingRsipNodes ?? []).map((node) => node.id));
  const rsipIdMap = buildIdMap(rsipNodes, existingIds, 'rsip');
  const nodes = rsipNodes
    .filter((raw): raw is Record<string, unknown> => isRecord(raw))
    .map((raw) => mapImportedRsipNode(raw, rsipIdMap, groupIdMap, t));
  return { nodes, rsipIdMap };
}

export function parseImportRsipMeta(rsipMeta: unknown): RSIPMeta | undefined {
  if (!isRecord(rsipMeta)) return undefined;
  return {
    lastAddedAt: parseDateOrUndefined(rsipMeta.lastAddedAt),
    allowMultiplePerDay: toOptionalBoolean(rsipMeta.allowMultiplePerDay),
    lastTreeOpenedAt: parseDateOrUndefined(rsipMeta.lastTreeOpenedAt),
    dailyTreeOpenRequired: toOptionalBoolean(rsipMeta.dailyTreeOpenRequired),
    treeOpenStreak: toOptionalNumber(rsipMeta.treeOpenStreak),
    phaseDistribution: parsePhaseDistribution(rsipMeta.phaseDistribution),
    currentRunNumber: toOptionalNumber(rsipMeta.currentRunNumber),
    currentRunStartedAt: parseDateOrUndefined(rsipMeta.currentRunStartedAt),
  };
}

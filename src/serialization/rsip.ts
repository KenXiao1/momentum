import type {
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPStabilityPhase,
  RSIPTaskLink,
} from '../types';
import {
  parseDateOrUndefined,
  parseTruthyDateOrNow,
  toBooleanWithDefault,
  toNumber,
  toOptionalBoolean,
  toOptionalNumber,
  toOptionalString,
} from './primitives';

const RSIP_STABILITY_PHASES: readonly RSIPStabilityPhase[] = ['E0', 'E1', 'E2'];

function parseStabilityPhase(value: unknown): RSIPStabilityPhase | undefined {
  return typeof value === 'string' &&
    RSIP_STABILITY_PHASES.includes(value as RSIPStabilityPhase)
    ? (value as RSIPStabilityPhase)
    : undefined;
}

export interface SerializedRSIPNode {
  id: string;
  parentId?: string;
  title: string;
  rule: string;
  sortOrder: number;
  createdAt?: string | null;
  useTimer?: unknown;
  timerMinutes?: unknown;
  emoji?: unknown;
  type?: unknown;
  groupId?: unknown;
  reinforcementLevel?: unknown;
  maxReinforcementLevel?: unknown;
  cumulativeExecutionDays?: unknown;
  isPassive?: unknown;
  splitFromGoal?: unknown;
  stabilityPhase?: unknown;
  phaseStartedAt?: unknown;
  lastExecutedAt?: unknown;
  lastViolatedAt?: unknown;
  consecutiveExecutions?: unknown;
  consecutiveViolations?: unknown;
  totalExecutions?: unknown;
  totalViolations?: unknown;
}

export interface SerializedRSIPMeta {
  lastAddedAt?: unknown;
  allowMultiplePerDay?: unknown;
  lastTreeOpenedAt?: unknown;
  dailyTreeOpenRequired?: unknown;
  treeOpenStreak?: unknown;
  phaseDistribution?: unknown;
  currentRunNumber?: unknown;
  currentRunStartedAt?: unknown;
}

export interface SerializedRSIPNodeGroup {
  id: string;
  title: string;
  faultTolerance: number;
  faultToleranceUsed?: unknown;
  createdAt?: unknown;
  emoji?: unknown;
}

export interface SerializedRSIPLibraryEntry {
  id: string;
  title: string;
  rule: string;
  type?: unknown;
  emoji?: unknown;
  cumulativeExecutionDays: number;
  internalizationProgress: number;
  lastActiveAt?: unknown;
  timesUsed: number;
  useTimer?: unknown;
  timerMinutes?: unknown;
  isPassive?: unknown;
}

export interface SerializedRSIPRunRecord {
  runNumber: number;
  startedAt?: unknown;
  endedAt?: unknown;
  maxNodeCount: number;
  durationDays: number;
  collapseReason?: unknown;
  collapseNodeTitle?: unknown;
}

export interface SerializedRSIPTaskLink {
  id: string;
  userId?: string;
  rsipNodeId: string;
  chainId: string;
  chainKind: RSIPTaskLink['chainKind'];
  triggerEvent: RSIPTaskLink['triggerEvent'];
  effect: RSIPTaskLink['effect'];
  automation: RSIPTaskLink['automation'];
  isActive: boolean;
  updatedAt?: unknown;
}

export interface SerializedRSIPExecutionRecord {
  id: string;
  userId?: string;
  nodeId: string;
  executedAt?: unknown;
  status: RSIPExecutionRecord['status'];
  notes?: unknown;
  reasonCode?: unknown;
  repairHint?: unknown;
  sourceChainId?: unknown;
  sourceEvent?: unknown;
}

export function decodeRSIPNode(raw: SerializedRSIPNode): RSIPNode {
  return {
    id: raw.id,
    parentId: raw.parentId,
    title: raw.title,
    rule: raw.rule,
    sortOrder: toNumber(raw.sortOrder, 0),
    createdAt: parseTruthyDateOrNow(raw.createdAt),
    useTimer: toOptionalBoolean(raw.useTimer),
    timerMinutes: toOptionalNumber(raw.timerMinutes),
    emoji: toOptionalString(raw.emoji),
    type: toOptionalString(raw.type),
    groupId: toOptionalString(raw.groupId),
    reinforcementLevel: toOptionalNumber(raw.reinforcementLevel),
    maxReinforcementLevel: toOptionalNumber(raw.maxReinforcementLevel),
    cumulativeExecutionDays: toOptionalNumber(raw.cumulativeExecutionDays),
    isPassive: toOptionalBoolean(raw.isPassive),
    splitFromGoal: toOptionalString(raw.splitFromGoal),
    stabilityPhase: parseStabilityPhase(raw.stabilityPhase),
    phaseStartedAt: parseDateOrUndefined(raw.phaseStartedAt),
    lastExecutedAt: parseDateOrUndefined(raw.lastExecutedAt),
    lastViolatedAt: parseDateOrUndefined(raw.lastViolatedAt),
    consecutiveExecutions: toOptionalNumber(raw.consecutiveExecutions),
    consecutiveViolations: toOptionalNumber(raw.consecutiveViolations),
    totalExecutions: toOptionalNumber(raw.totalExecutions),
    totalViolations: toOptionalNumber(raw.totalViolations),
  };
}

export function decodeRSIPMeta(raw: SerializedRSIPMeta): RSIPMeta {
  return {
    lastAddedAt: parseDateOrUndefined(raw.lastAddedAt),
    allowMultiplePerDay: toBooleanWithDefault(raw.allowMultiplePerDay, false),
    lastTreeOpenedAt: parseDateOrUndefined(raw.lastTreeOpenedAt),
    dailyTreeOpenRequired: toBooleanWithDefault(
      raw.dailyTreeOpenRequired,
      false,
    ),
    treeOpenStreak: toNumber(raw.treeOpenStreak, 0),
    phaseDistribution:
      raw.phaseDistribution &&
      typeof raw.phaseDistribution === 'object' &&
      !Array.isArray(raw.phaseDistribution)
        ? {
            E0: toNumber((raw.phaseDistribution as { E0?: unknown }).E0, 0),
            E1: toNumber((raw.phaseDistribution as { E1?: unknown }).E1, 0),
            E2: toNumber((raw.phaseDistribution as { E2?: unknown }).E2, 0),
          }
        : undefined,
    currentRunNumber: toOptionalNumber(raw.currentRunNumber),
    currentRunStartedAt: parseDateOrUndefined(raw.currentRunStartedAt),
  };
}

export function decodeRSIPNodeGroup(
  raw: SerializedRSIPNodeGroup,
): RSIPNodeGroup {
  return {
    id: raw.id,
    title: raw.title,
    faultTolerance: toNumber(raw.faultTolerance, 0),
    faultToleranceUsed: toOptionalNumber(raw.faultToleranceUsed),
    createdAt: parseTruthyDateOrNow(raw.createdAt),
    emoji: toOptionalString(raw.emoji),
  };
}

export function decodeRSIPLibraryEntry(
  raw: SerializedRSIPLibraryEntry,
): RSIPLibraryEntry {
  return {
    id: raw.id,
    title: raw.title,
    rule: raw.rule,
    type: toOptionalString(raw.type),
    emoji: toOptionalString(raw.emoji),
    cumulativeExecutionDays: toNumber(raw.cumulativeExecutionDays, 0),
    internalizationProgress: toNumber(raw.internalizationProgress, 0),
    lastActiveAt: parseTruthyDateOrNow(raw.lastActiveAt),
    timesUsed: toNumber(raw.timesUsed, 0),
    useTimer: toOptionalBoolean(raw.useTimer),
    timerMinutes: toOptionalNumber(raw.timerMinutes),
    isPassive: toOptionalBoolean(raw.isPassive),
  };
}

export function decodeRSIPRunRecord(
  raw: SerializedRSIPRunRecord,
): RSIPRunRecord {
  return {
    runNumber: toNumber(raw.runNumber, 0),
    startedAt: parseTruthyDateOrNow(raw.startedAt),
    endedAt: parseDateOrUndefined(raw.endedAt),
    maxNodeCount: toNumber(raw.maxNodeCount, 0),
    durationDays: toNumber(raw.durationDays, 0),
    collapseReason: toOptionalString(raw.collapseReason),
    collapseNodeTitle: toOptionalString(raw.collapseNodeTitle),
  };
}

export function decodeRSIPTaskLink(raw: SerializedRSIPTaskLink): RSIPTaskLink {
  return {
    id: raw.id,
    userId: raw.userId,
    rsipNodeId: raw.rsipNodeId,
    chainId: raw.chainId,
    chainKind: raw.chainKind,
    triggerEvent: raw.triggerEvent,
    effect: raw.effect,
    automation: raw.automation,
    isActive: toBooleanWithDefault(raw.isActive, true),
    updatedAt: parseTruthyDateOrNow(raw.updatedAt),
  };
}

export function decodeRSIPExecutionRecord(
  raw: SerializedRSIPExecutionRecord,
): RSIPExecutionRecord {
  return {
    id: raw.id,
    userId: raw.userId,
    nodeId: raw.nodeId,
    executedAt: parseTruthyDateOrNow(raw.executedAt),
    status: raw.status,
    notes: toOptionalString(raw.notes),
    reasonCode: toOptionalString(raw.reasonCode),
    repairHint: toOptionalString(raw.repairHint),
    sourceChainId: toOptionalString(raw.sourceChainId),
    sourceEvent: toOptionalString(raw.sourceEvent),
  };
}

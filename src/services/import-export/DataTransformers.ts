import type {
  Chain,
  CompletionHistory,
  DistributiveOmit,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../../types';
import type { PetState } from '../../types/pet';

type ChainDateFields =
  | 'createdAt'
  | 'lastCompletedAt'
  | 'groupStartedAt'
  | 'groupExpiresAt'
  | 'deletedAt';
type ExportedChain = DistributiveOmit<Chain, ChainDateFields> & {
  createdAt: string;
  lastCompletedAt?: string;
  groupStartedAt?: string;
  groupExpiresAt?: string;
  deletedAt?: string | null;
};

type ExportedCompletionHistory = Omit<CompletionHistory, 'completedAt'> & {
  completedAt: string;
};

type RSIPNodeDateFields =
  'createdAt' | 'phaseStartedAt' | 'lastExecutedAt' | 'lastViolatedAt';
type ExportedRSIPNode = Omit<RSIPNode, RSIPNodeDateFields> & {
  createdAt: string;
  phaseStartedAt?: string;
  lastExecutedAt?: string;
  lastViolatedAt?: string;
};

type RSIPMetaDateFields =
  'lastAddedAt' | 'lastTreeOpenedAt' | 'currentRunStartedAt';
type ExportedRSIPMeta = Omit<RSIPMeta, RSIPMetaDateFields> & {
  lastAddedAt?: string;
  lastTreeOpenedAt?: string;
  currentRunStartedAt?: string;
};

type ExportedPetState = Omit<
  PetState,
  'createdAt' | 'lastFedAt' | 'lastInteractedAt' | 'lastDecayCalculatedAt'
> & {
  createdAt: string;
  lastFedAt: string;
  lastInteractedAt: string;
  lastDecayCalculatedAt: string;
};

type ExportedRSIPGroup = Omit<RSIPNodeGroup, 'createdAt'> & {
  createdAt: string;
};
type ExportedRSIPLibraryEntry = Omit<RSIPLibraryEntry, 'lastActiveAt'> & {
  lastActiveAt: string;
};
type ExportedRSIPRunRecord = Omit<RSIPRunRecord, 'startedAt' | 'endedAt'> & {
  startedAt: string;
  endedAt?: string;
};
type ExportedRSIPExecutionRecord = Omit<
  RSIPExecutionRecord,
  'executedAt' | 'userId'
> & {
  executedAt: string;
};
type ExportedRSIPTaskLink = Omit<RSIPTaskLink, 'updatedAt' | 'userId'> & {
  updatedAt: string;
};

export interface MomentumExportDataV3 {
  version: '3.0';
  exportedAt: string;
  chains: ExportedChain[];
  completionHistory: ExportedCompletionHistory[];
  rsipNodes?: ExportedRSIPNode[];
  rsipMeta?: ExportedRSIPMeta;
  rsipGroups?: ExportedRSIPGroup[];
  rsipPolicyLibrary?: ExportedRSIPLibraryEntry[];
  rsipRunHistory?: ExportedRSIPRunRecord[];
  rsipExecutionRecords?: ExportedRSIPExecutionRecord[];
  rsipTaskLinks?: ExportedRSIPTaskLink[];
  petState?: ExportedPetState;
  userPreferences?: unknown;
  exceptionRules?: unknown;
}

function serializeDeletedAt(
  deletedAt: Date | null | undefined,
): string | null | undefined {
  if (deletedAt === null) return null;
  return deletedAt ? deletedAt.toISOString() : undefined;
}

function toIsoOrUndefined(value: Date | undefined): string | undefined {
  return value?.toISOString();
}

export function toExportedChain(chain: Chain): ExportedChain {
  const {
    createdAt,
    lastCompletedAt,
    groupStartedAt,
    groupExpiresAt,
    deletedAt,
    ...rest
  } = chain;

  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    lastCompletedAt: lastCompletedAt?.toISOString(),
    groupStartedAt: groupStartedAt?.toISOString(),
    groupExpiresAt: groupExpiresAt?.toISOString(),
    deletedAt: serializeDeletedAt(deletedAt),
  };
}

export function toExportedCompletionHistory(
  entry: CompletionHistory,
): ExportedCompletionHistory {
  const { completedAt, ...rest } = entry;

  return {
    ...rest,
    completedAt: completedAt.toISOString(),
  };
}

export function toExportedRSIPNode(node: RSIPNode): ExportedRSIPNode {
  const { createdAt, phaseStartedAt, lastExecutedAt, lastViolatedAt, ...rest } =
    node;

  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    phaseStartedAt: toIsoOrUndefined(phaseStartedAt),
    lastExecutedAt: toIsoOrUndefined(lastExecutedAt),
    lastViolatedAt: toIsoOrUndefined(lastViolatedAt),
  };
}

export function toExportedRSIPMeta(meta: RSIPMeta): ExportedRSIPMeta {
  const { lastAddedAt, lastTreeOpenedAt, currentRunStartedAt, ...rest } = meta;

  return {
    ...rest,
    lastAddedAt: lastAddedAt?.toISOString(),
    lastTreeOpenedAt: toIsoOrUndefined(lastTreeOpenedAt),
    currentRunStartedAt: toIsoOrUndefined(currentRunStartedAt),
  };
}

export function toExportedPetState(pet: PetState): ExportedPetState {
  return {
    ...pet,
    createdAt: pet.createdAt.toISOString(),
    lastFedAt: pet.lastFedAt.toISOString(),
    lastInteractedAt: pet.lastInteractedAt.toISOString(),
    lastDecayCalculatedAt: pet.lastDecayCalculatedAt.toISOString(),
  };
}

export function toExportedRSIPGroup(group: RSIPNodeGroup): ExportedRSIPGroup {
  return {
    ...group,
    createdAt: group.createdAt.toISOString(),
  };
}

export function toExportedRSIPLibraryEntry(
  entry: RSIPLibraryEntry,
): ExportedRSIPLibraryEntry {
  return {
    ...entry,
    lastActiveAt: entry.lastActiveAt.toISOString(),
  };
}

export function toExportedRSIPRunRecord(
  record: RSIPRunRecord,
): ExportedRSIPRunRecord {
  return {
    ...record,
    startedAt: record.startedAt.toISOString(),
    endedAt: record.endedAt?.toISOString(),
  };
}

export function toExportedRSIPExecutionRecord(
  record: RSIPExecutionRecord,
): ExportedRSIPExecutionRecord {
  const { executedAt, ...rest } = record;
  Reflect.deleteProperty(rest, 'userId');
  return {
    ...rest,
    executedAt: executedAt.toISOString(),
  };
}

export function toExportedRSIPTaskLink(
  link: RSIPTaskLink,
): ExportedRSIPTaskLink {
  const { updatedAt, ...rest } = link;
  Reflect.deleteProperty(rest, 'userId');
  return {
    ...rest,
    updatedAt: updatedAt.toISOString(),
  };
}

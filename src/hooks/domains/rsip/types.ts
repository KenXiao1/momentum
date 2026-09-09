import type { Dispatch, SetStateAction } from 'react';
import type {
  AppState,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../../../types';
import type { MomentumStorage } from '../../../storage/MomentumStorage';

export const INTERNALIZATION_TARGET_DAYS = 60;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface MarkExecutionOptions {
  reinforce?: boolean;
  reasonCode?: string;
  repairHint?: string;
  sourceChainId?: string;
  sourceEvent?: string;
}

export interface MarkViolationOptions {
  reasonCode?: string;
  repairHint?: string;
  sourceChainId?: string;
  sourceEvent?: string;
  collapseReason?: string;
}

export interface UseRsipDomainParams {
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  getState?: () => AppState;
  onNavigateToRSIP?: () => void;
  confirmTaskLink?: (link: RSIPTaskLink, node: RSIPNode) => Promise<boolean>;
}

export interface SaveFns {
  saveNodes: (nodes: RSIPNode[]) => Promise<void>;
  saveMeta: (meta: RSIPMeta) => Promise<void>;
  saveGroups: (groups: RSIPNodeGroup[]) => Promise<void>;
  savePolicyLibrary: (entries: RSIPLibraryEntry[]) => Promise<void>;
  saveRunHistory: (records: RSIPRunRecord[]) => Promise<void>;
  saveTaskLinks: (links: RSIPTaskLink[]) => Promise<void>;
  appendExecutionRecord: (record: RSIPExecutionRecord) => Promise<void>;
  upsertNode: (node: RSIPNode, nextNodes: RSIPNode[]) => Promise<void>;
  removeNodes: (nodeIds: string[], nextNodes: RSIPNode[]) => Promise<void>;
  upsertLibraryEntry: (
    entry: RSIPLibraryEntry,
    nextEntries: RSIPLibraryEntry[],
  ) => Promise<void>;
  appendRunRecord: (
    record: RSIPRunRecord,
    nextHistory: RSIPRunRecord[],
  ) => Promise<void>;
}

export type ReadState = () => AppState | null;

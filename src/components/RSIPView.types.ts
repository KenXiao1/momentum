import type {
  Chain,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../types';

interface RSIPExecutionActionOptions {
  reinforce?: boolean;
  reasonCode?: string;
  repairHint?: string;
  sourceChainId?: string;
  sourceEvent?: string;
}

interface RSIPViolationActionOptions {
  reasonCode?: string;
  repairHint?: string;
  sourceChainId?: string;
  sourceEvent?: string;
  collapseReason?: string;
}

export interface RSIPViewProps {
  nodes: RSIPNode[];
  meta: RSIPMeta;
  groups?: RSIPNodeGroup[];
  policyLibrary?: RSIPLibraryEntry[];
  runHistory?: RSIPRunRecord[];
  executionRecords?: RSIPExecutionRecord[];
  taskLinks?: RSIPTaskLink[];
  chains?: Chain[];
  onBack: () => void;
  onSaveNodes: (nodes: RSIPNode[]) => void | Promise<void>;
  onCreateNodes: (nodes: RSIPNode[]) => Promise<void>;
  onSaveMeta: (
    meta: RSIPMeta | ((current: RSIPMeta) => RSIPMeta),
  ) => void | Promise<void>;
  onSaveGroups?: (groups: RSIPNodeGroup[]) => void | Promise<void>;
  onSaveTaskLinks?: (links: RSIPTaskLink[]) => void | Promise<void>;
  onMarkExecuted?: (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: RSIPExecutionActionOptions,
  ) => Promise<RSIPNode[]>;
  onMarkViolated?: (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: RSIPViolationActionOptions,
  ) => Promise<RSIPNode[]>;
  onReinforceNode?: (
    nodeId: string,
    nodes: RSIPNode[],
    levelDelta?: number,
  ) => Promise<RSIPNode[]>;
  onRestoreFromLibrary?: (
    entryId: string,
    parentId?: string,
  ) => Promise<RSIPNode | null>;
  onCreateGroup?: (
    title: string,
    faultTolerance: number,
    emoji?: string,
  ) => Promise<RSIPNodeGroup>;
  onUpsertTaskLinks?: (links: RSIPTaskLink[]) => Promise<RSIPTaskLink[]>;
  onGetTaskActions?: (rsipNodeId: string) => RSIPTaskLink[];
  onStartChain?: (chainId: string) => Promise<void>;
  onScheduleChain?: (chainId: string) => void;
}

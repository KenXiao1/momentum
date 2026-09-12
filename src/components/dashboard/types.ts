import type {
  Chain,
  CompletionHistory,
  ExceptionRule,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
  ScheduledSession,
} from '../../types';
import type { PetState } from '../../types/pet';

interface DashboardImportOptions {
  history?: CompletionHistory[];
  rsipNodes?: RSIPNode[];
  rsipMeta?: RSIPMeta;
  rsipGroups?: RSIPNodeGroup[];
  rsipPolicyLibrary?: RSIPLibraryEntry[];
  rsipRunHistory?: RSIPRunRecord[];
  rsipExecutionRecords?: RSIPExecutionRecord[];
  rsipTaskLinks?: RSIPTaskLink[];
  petState?: PetState;
  exceptionRules?: ExceptionRule[];
}

export interface DashboardProps {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  isLoading?: boolean;
  onCreateChain: () => void;
  onCreateTaskGroup?: () => void;
  onOpenRSIP?: () => void;
  onStartChain: (chainId: string) => void;
  onScheduleChain: (chainId: string) => void;
  onViewChainDetail: (chainId: string) => void;
  onCancelScheduledSession?: (chainId: string) => void;
  onCompleteBooking?: (chainId: string) => void;
  onDeleteChain: (chainId: string) => void;
  onImportChains: (
    chains: Chain[],
    options?: DashboardImportOptions,
  ) => Promise<void>;
  onRestoreChains?: (chainIds: string[]) => void | Promise<void>;
  onPermanentDeleteChains?: (chainIds: string[]) => void | Promise<void>;
  history?: CompletionHistory[];
  rsipNodes?: RSIPNode[];
  rsipMeta?: RSIPMeta;
  rsipGroups?: RSIPNodeGroup[];
  rsipPolicyLibrary?: RSIPLibraryEntry[];
  rsipRunHistory?: RSIPRunRecord[];
  rsipExecutionRecords?: RSIPExecutionRecord[];
  rsipTaskLinks?: RSIPTaskLink[];
  petState?: PetState | null;
  userPreferences?: unknown;
}

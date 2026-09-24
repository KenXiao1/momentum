import type {
  ActiveSession,
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
} from '../types';
import type { PetState } from '../types/pet';

export interface ImportData {
  /** Account that authorized the import before asynchronous preparation. */
  expectedUserId?: string;
  chains: Chain[];
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

export interface SessionCompletionInput {
  operationId: string;
  session: ActiveSession;
  sessionId: string | null;
  expectedChains: Chain[];
  chains: Chain[];
  record: CompletionHistory;
}

export interface SessionCompletionResult {
  chains: Chain[];
  record: CompletionHistory;
}

export interface StorageOperationStore {
  commitSessionCompletion(
    input: SessionCompletionInput,
  ): Promise<SessionCompletionResult>;
  importData(data: ImportData): Promise<void>;
}

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
} from '../../types';
import type { PetState } from '../../types/pet';

export type ImportStatus =
  | 'idle'
  | 'checking-auth'
  | 'creating-session'
  | 'importing'
  | 'success'
  | 'error';

export type ImportCallback = (
  chains: Chain[],
  options?: {
    expectedUserId?: string;
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
  },
) => Promise<void>;

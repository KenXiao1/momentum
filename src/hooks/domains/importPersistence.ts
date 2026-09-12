import type { Dispatch, SetStateAction } from 'react';
import type {
  AppState,
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
import type { MomentumStorage } from '../../storage/MomentumStorage';

export interface ImportChainsOptions {
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

function appendIfNonEmpty<T>(existing: T[], incoming?: T[]): T[] {
  return incoming?.length ? [...existing, ...incoming] : existing;
}

async function appendCollection<T>(
  incoming: T[] | undefined,
  load: () => Promise<T[]>,
  save: (items: T[]) => Promise<void>,
): Promise<void> {
  if (!incoming?.length) return;
  const existing = await load();
  await save([...existing, ...incoming]);
}

export async function persistImportedData(params: {
  storage: MomentumStorage;
  canUseAuth: boolean;
  options?: ImportChainsOptions;
}): Promise<void> {
  const { storage, canUseAuth, options } = params;
  if (options?.history?.length) {
    const history = canUseAuth
      ? options.history
      : [...(await storage.getCompletionHistory()), ...options.history];
    await storage.saveCompletionHistory(history);
  }
  await appendCollection(
    options?.rsipNodes,
    () => storage.getRSIPNodes(),
    (items) => storage.saveRSIPNodes(items),
  );
  if (options?.rsipMeta) {
    await storage.saveRSIPMeta({
      ...(await storage.getRSIPMeta()),
      ...options.rsipMeta,
    });
  }
  await appendCollection(
    options?.rsipGroups,
    () => storage.getRSIPGroups(),
    (items) => storage.saveRSIPGroups(items),
  );
  await appendCollection(
    options?.rsipPolicyLibrary,
    () => storage.getRSIPPolicyLibrary(),
    (items) => storage.saveRSIPPolicyLibrary(items),
  );
  await appendCollection(
    options?.rsipRunHistory,
    () => storage.getRSIPRunHistory(),
    (items) => storage.saveRSIPRunHistory(items),
  );
  for (const record of options?.rsipExecutionRecords ?? []) {
    await storage.appendRSIPExecutionRecord(record);
  }
  await appendCollection(
    options?.rsipTaskLinks,
    () => storage.getRSIPTaskLinks(),
    (items) => storage.saveRSIPTaskLinks(items),
  );
  if (options?.petState) await storage.savePetState(options.petState);
}

export function mergeImportedState(
  previous: AppState,
  chains: Chain[],
  options?: ImportChainsOptions,
): AppState {
  return {
    ...previous,
    chains,
    completionHistory: appendIfNonEmpty(
      previous.completionHistory,
      options?.history,
    ),
    rsipNodes: appendIfNonEmpty(previous.rsipNodes, options?.rsipNodes),
    rsipMeta: options?.rsipMeta
      ? { ...previous.rsipMeta, ...options.rsipMeta }
      : previous.rsipMeta,
    rsipGroups: appendIfNonEmpty(previous.rsipGroups, options?.rsipGroups),
    rsipPolicyLibrary: appendIfNonEmpty(
      previous.rsipPolicyLibrary,
      options?.rsipPolicyLibrary,
    ),
    rsipRunHistory: appendIfNonEmpty(
      previous.rsipRunHistory,
      options?.rsipRunHistory,
    ),
    rsipExecutionRecords: appendIfNonEmpty(
      previous.rsipExecutionRecords,
      options?.rsipExecutionRecords,
    ),
    rsipTaskLinks: appendIfNonEmpty(
      previous.rsipTaskLinks,
      options?.rsipTaskLinks,
    ),
  };
}

export async function reloadStateAfterImportFailure(
  storage: MomentumStorage,
  setState: Dispatch<SetStateAction<AppState>>,
): Promise<void> {
  const [
    chains,
    rsipNodes,
    rsipMeta,
    rsipGroups,
    rsipPolicyLibrary,
    rsipRunHistory,
    rsipTaskLinks,
    rsipExecutionRecords,
  ] = await Promise.all([
    storage.getChains(),
    storage.getRSIPNodes(),
    storage.getRSIPMeta(),
    storage.getRSIPGroups(),
    storage.getRSIPPolicyLibrary(),
    storage.getRSIPRunHistory(),
    storage.getRSIPTaskLinks(),
    storage.getRSIPExecutionRecords(),
  ]);
  setState((previous) => ({
    ...previous,
    chains,
    rsipNodes,
    rsipMeta,
    rsipGroups,
    rsipPolicyLibrary,
    rsipRunHistory,
    rsipTaskLinks,
    rsipExecutionRecords,
  }));
}

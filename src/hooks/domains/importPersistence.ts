import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import type { ImportData } from '../../storage/operations';

export type ImportChainsOptions = Omit<ImportData, 'chains'>;

export async function reloadImportedState(
  storage: MomentumStorage,
  setState: Dispatch<SetStateAction<AppState>>,
): Promise<void> {
  const [
    chains,
    completionHistory,
    rsipNodes,
    rsipMeta,
    rsipGroups,
    rsipPolicyLibrary,
    rsipRunHistory,
    rsipTaskLinks,
    rsipExecutionRecords,
  ] = await Promise.all([
    storage.getChains(),
    storage.getCompletionHistory(),
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
    completionHistory,
    rsipNodes,
    rsipMeta,
    rsipGroups,
    rsipPolicyLibrary,
    rsipRunHistory,
    rsipTaskLinks,
    rsipExecutionRecords,
  }));
}

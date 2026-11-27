import type {
  Chain,
  CompletionHistory,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../../types';
import type { PetState } from '../../types/pet';

import {
  type MomentumExportDataV3,
  toExportedChain,
  toExportedCompletionHistory,
  toExportedPetState,
  toExportedRSIPExecutionRecord,
  toExportedRSIPGroup,
  toExportedRSIPLibraryEntry,
  toExportedRSIPMeta,
  toExportedRSIPNode,
  toExportedRSIPRunRecord,
  toExportedRSIPTaskLink,
} from './DataTransformers';
import type { ChainTagSet } from '../../types';

export class ExportService {
  createExportData(params: {
    chains: Chain[];
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
    exceptionRules?: unknown;
    chainTags?: ChainTagSet;
  }): MomentumExportDataV3 {
    const {
      chains,
      history,
      rsipNodes,
      rsipMeta,
      rsipGroups,
      rsipPolicyLibrary,
      rsipRunHistory,
      rsipExecutionRecords,
      rsipTaskLinks,
      petState,
      userPreferences,
      exceptionRules,
      chainTags,
    } = params;

    return {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      chains: chains.map(toExportedChain),
      completionHistory: (history || []).map(toExportedCompletionHistory),
      rsipNodes: rsipNodes ? rsipNodes.map(toExportedRSIPNode) : undefined,
      rsipMeta: rsipMeta ? toExportedRSIPMeta(rsipMeta) : undefined,
      rsipGroups: rsipGroups ? rsipGroups.map(toExportedRSIPGroup) : undefined,
      rsipPolicyLibrary: rsipPolicyLibrary
        ? rsipPolicyLibrary.map(toExportedRSIPLibraryEntry)
        : undefined,
      rsipRunHistory: rsipRunHistory
        ? rsipRunHistory.map(toExportedRSIPRunRecord)
        : undefined,
      rsipExecutionRecords: rsipExecutionRecords
        ? rsipExecutionRecords.map(toExportedRSIPExecutionRecord)
        : undefined,
      rsipTaskLinks: rsipTaskLinks
        ? rsipTaskLinks.map(toExportedRSIPTaskLink)
        : undefined,
      petState: petState ? toExportedPetState(petState) : undefined,
      userPreferences,
      exceptionRules,
      chainTags,
    };
  }
}

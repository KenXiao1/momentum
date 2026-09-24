import { type Translator } from '../../i18n';
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
  buildChainEntriesAndIdMap,
  buildImportChains,
  getRawChainsFromPayload,
} from './import/chains';
import type { ExceptionRuleImportData } from './import/exceptionRules';
import { parseExceptionRulesToImport } from './import/exceptionRules';
import { parseImportHistory } from './import/history';
import { parseImportPetState } from './import/pet';
import { parseImportPayload } from './import/payload';
import {
  parseImportRsipExecutionRecords,
  parseImportRsipGroups,
  parseImportRsipLibrary,
  parseImportRsipMeta,
  parseImportRsipNodes,
  parseImportRsipRunHistory,
  parseImportRsipTaskLinks,
} from './import/rsip';

export interface ImportExportImportOptions {
  preserveStatistics: boolean;
  preserveTimestamps: boolean;
  importCompletionHistory: boolean;
}

interface ParsedImportData {
  chains: Chain[];
  history: CompletionHistory[];
  rsipNodes: RSIPNode[];
  rsipMeta?: RSIPMeta;
  rsipGroups?: RSIPNodeGroup[];
  rsipPolicyLibrary?: RSIPLibraryEntry[];
  rsipRunHistory?: RSIPRunRecord[];
  rsipExecutionRecords?: RSIPExecutionRecord[];
  rsipTaskLinks?: RSIPTaskLink[];
  petState?: PetState;
  userPreferences?: unknown;
  invalidReferences: {
    rsipExecutionRecordsSkipped: number;
    rsipTaskLinksSkipped: number;
  };
  exceptionRulesToImport: ExceptionRuleImportData[];
}

function asOptionalArray<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined;
}

export class ImportService {
  parseImportData(params: {
    json: string;
    options: ImportExportImportOptions;
    existingRsipNodes?: RSIPNode[];
    existingRsipGroups?: RSIPNodeGroup[];
    t: Translator;
  }): ParsedImportData {
    const { json, options, existingRsipNodes, existingRsipGroups, t } = params;

    const parsed = parseImportPayload(json, t);
    const rawChains = getRawChainsFromPayload(parsed, t);
    const { chainEntries, idMap } = buildChainEntriesAndIdMap(rawChains, t);

    const importChains = buildImportChains({
      chainEntries,
      idMap,
      preserveStatistics: Boolean(options.preserveStatistics),
      preserveTimestamps: Boolean(options.preserveTimestamps),
      t,
    });

    const importHistory = parseImportHistory(
      parsed.completionHistory,
      Boolean(options.importCompletionHistory),
      idMap,
    );
    const { groups: importedRsipGroups, groupIdMap } = parseImportRsipGroups(
      parsed.rsipGroups,
      existingRsipGroups,
    );
    const { nodes: importedRsipNodes, rsipIdMap } = parseImportRsipNodes(
      parsed.rsipNodes,
      existingRsipNodes,
      t,
      groupIdMap,
    );
    const rsipMeta = parseImportRsipMeta(parsed.rsipMeta);
    const rsipPolicyLibrary = parseImportRsipLibrary(parsed.rsipPolicyLibrary);
    const rsipRunHistory = parseImportRsipRunHistory(parsed.rsipRunHistory);
    const rsipExecutionRecords = parseImportRsipExecutionRecords(
      parsed.rsipExecutionRecords,
      rsipIdMap,
    );
    const rsipTaskLinks = parseImportRsipTaskLinks(
      parsed.rsipTaskLinks,
      rsipIdMap,
      idMap,
    );
    const petState = parseImportPetState(parsed.petState);
    const exceptionRulesToImport = parseExceptionRulesToImport(
      parsed.exceptionRules,
    );

    return {
      chains: importChains,
      history: importHistory,
      rsipNodes: importedRsipNodes,
      rsipMeta,
      rsipGroups: asOptionalArray(importedRsipGroups),
      rsipPolicyLibrary: asOptionalArray(rsipPolicyLibrary),
      rsipRunHistory: asOptionalArray(rsipRunHistory),
      rsipExecutionRecords: asOptionalArray(rsipExecutionRecords.records),
      rsipTaskLinks: asOptionalArray(rsipTaskLinks.links),
      petState,
      userPreferences: parsed.userPreferences,
      invalidReferences: {
        rsipExecutionRecordsSkipped: rsipExecutionRecords.skipped,
        rsipTaskLinksSkipped: rsipTaskLinks.skipped,
      },
      exceptionRulesToImport,
    };
  }
}

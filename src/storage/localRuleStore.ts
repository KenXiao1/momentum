import type { ExceptionRule, RuleUsageRecord } from '../types';
import { LOCAL_STORAGE_KEYS } from '../utils/local-preferences/keys';
import type { RuleStore } from './ports';

type StoredRule = Omit<ExceptionRule, 'createdAt' | 'lastUsedAt'> & {
  createdAt: string;
  lastUsedAt?: string | null;
};
type StoredUsageRecord = Omit<RuleUsageRecord, 'usedAt'> & { usedAt: string };

function readJsonArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

function hydrateRule(stored: StoredRule): ExceptionRule {
  const chainId =
    typeof stored.chainId === 'string' && stored.chainId.trim().length > 0
      ? stored.chainId
      : undefined;
  let scope: ExceptionRule['scope'] = chainId ? 'chain' : 'global';
  if (stored.scope === 'chain' || stored.scope === 'global') {
    scope = stored.scope;
  }
  return {
    ...stored,
    scope,
    chainId: scope === 'chain' ? chainId : undefined,
    createdAt: new Date(stored.createdAt),
    lastUsedAt: stored.lastUsedAt ? new Date(stored.lastUsedAt) : undefined,
  };
}

/**
 * Rules and usage records in browser localStorage. Invalid JSON and failed
 * writes throw, so callers never report a save that did not happen.
 */
export const localRuleStore: RuleStore = {
  async getRules() {
    return readJsonArray<StoredRule>(LOCAL_STORAGE_KEYS.EXCEPTION_RULES).map(
      hydrateRule,
    );
  },
  async saveRules(rules) {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES,
      JSON.stringify(rules),
    );
  },
  async getUsageRecords() {
    return readJsonArray<StoredUsageRecord>(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES_USAGE,
    ).map((record) => ({ ...record, usedAt: new Date(record.usedAt) }));
  },
  async saveUsageRecords(records) {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES_USAGE,
      JSON.stringify(records),
    );
  },
};

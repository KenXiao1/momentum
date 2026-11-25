import {
  decodeExceptionRule,
  decodeRuleUsageRecord,
  type SerializedExceptionRule,
  type SerializedRuleUsageRecord,
} from '../serialization';
import { LOCAL_STORAGE_KEYS } from '../utils/local-preferences/keys';
import type { RuleStore } from './ports';

function readJsonArray<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

/**
 * Rules and usage records in browser localStorage. Invalid JSON and failed
 * writes throw, so callers never report a save that did not happen.
 */
export const localRuleStore: RuleStore = {
  async getRules() {
    return readJsonArray<SerializedExceptionRule>(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES,
    ).map(decodeExceptionRule);
  },
  async saveRules(rules) {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES,
      JSON.stringify(rules),
    );
  },
  async getUsageRecords() {
    return readJsonArray<SerializedRuleUsageRecord>(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES_USAGE,
    ).map(decodeRuleUsageRecord);
  },
  async saveUsageRecords(records) {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES_USAGE,
      JSON.stringify(records),
    );
  },
};

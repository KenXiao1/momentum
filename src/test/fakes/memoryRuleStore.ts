import type { ExceptionRule, RuleUsageRecord } from '../../types';
import type { RuleStore } from '../../storage/ports';

/** In-memory RuleStore; copies on read and write so tests see only saved state. */
export function createMemoryRuleStore(
  initial: { rules?: ExceptionRule[]; usageRecords?: RuleUsageRecord[] } = {},
) {
  let rules = structuredClone(initial.rules ?? []);
  let usageRecords = structuredClone(initial.usageRecords ?? []);
  const store: RuleStore & {
    failNextWrite(error?: Error): void;
    readonly rules: ExceptionRule[];
    readonly usageRecords: RuleUsageRecord[];
  } = {
    async getRules() {
      return structuredClone(rules);
    },
    async saveRules(next) {
      takeFailure();
      rules = structuredClone(next);
    },
    async getUsageRecords() {
      return structuredClone(usageRecords);
    },
    async saveUsageRecords(next) {
      takeFailure();
      usageRecords = structuredClone(next);
    },
    failNextWrite(error = new Error('write failed')) {
      pendingFailure = error;
    },
    get rules() {
      return structuredClone(rules);
    },
    get usageRecords() {
      return structuredClone(usageRecords);
    },
  };
  let pendingFailure: Error | null = null;
  function takeFailure() {
    if (!pendingFailure) return;
    const error = pendingFailure;
    pendingFailure = null;
    throw error;
  }
  return store;
}

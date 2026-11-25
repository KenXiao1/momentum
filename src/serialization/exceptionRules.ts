import type { ExceptionRule, RuleUsageRecord } from '../types';

/** A rule as JSON stores it (local storage or the cloud rule set). */
export type SerializedExceptionRule = Omit<
  ExceptionRule,
  'createdAt' | 'lastUsedAt'
> & {
  createdAt: string;
  lastUsedAt?: string | null;
};

export type SerializedRuleUsageRecord = Omit<RuleUsageRecord, 'usedAt'> & {
  usedAt: string;
};

export function decodeExceptionRule(
  stored: SerializedExceptionRule,
): ExceptionRule {
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

export function decodeRuleUsageRecord(
  stored: SerializedRuleUsageRecord,
): RuleUsageRecord {
  return { ...stored, usedAt: new Date(stored.usedAt) };
}

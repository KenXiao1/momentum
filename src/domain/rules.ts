import {
  ExceptionRuleError,
  ExceptionRuleException,
  ExceptionRuleType,
  type ExceptionRule,
  type PauseOptions,
  type RuleUsageRecord,
  type SessionContext,
} from '../types';
import { calculateSimilarity, normalizeName } from '../utils/stringUtils';

export type RuleActionType = 'pause' | 'early_completion';

export interface RuleInput {
  name?: string;
  type?: ExceptionRuleType;
  description?: string;
}

const RULE_TYPES: readonly string[] = Object.values(ExceptionRuleType);
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const SIMILARITY_THRESHOLD = 0.7;

function validationError(message: string): ExceptionRuleException {
  return new ExceptionRuleException(
    ExceptionRuleError.VALIDATION_ERROR,
    message,
  );
}

export function ruleTypeForAction(action: RuleActionType): ExceptionRuleType {
  return action === 'pause'
    ? ExceptionRuleType.PAUSE_ONLY
    : ExceptionRuleType.EARLY_COMPLETION_ONLY;
}

/** Throws when a create (all fields required) or update (fields optional) is invalid. */
export function validateRuleInput(input: RuleInput, creating: boolean): void {
  if (input.name === undefined) {
    if (creating) throw validationError('规则名称不能为空');
  } else if (input.name.trim().length === 0) {
    throw validationError('规则名称不能为空');
  } else if (input.name.length > MAX_NAME_LENGTH) {
    throw validationError('规则名称不能超过100个字符');
  }

  if (input.type === undefined) {
    if (creating) throw validationError('规则类型不能为空');
  } else if (!RULE_TYPES.includes(input.type)) {
    throw new ExceptionRuleException(
      ExceptionRuleError.INVALID_RULE_TYPE,
      `无效的规则类型: ${input.type}`,
    );
  }

  if ((input.description?.length ?? 0) > MAX_DESCRIPTION_LENGTH) {
    throw validationError('规则描述不能超过500个字符');
  }
}

/** Active rules whose names match ignoring case, spacing and punctuation. */
export function findExactDuplicates(
  rules: ExceptionRule[],
  name: string,
  excludeId?: string,
): ExceptionRule[] {
  const target = normalizeName(name);
  return rules.filter(
    (rule) =>
      rule.isActive &&
      rule.id !== excludeId &&
      normalizeName(rule.name) === target,
  );
}

/** Active rules with similar but not identical names, most similar first. */
export function findSimilarRules(
  rules: ExceptionRule[],
  name: string,
  excludeId?: string,
): ExceptionRule[] {
  const target = normalizeName(name);
  return rules
    .filter((rule) => rule.isActive && rule.id !== excludeId)
    .map((rule) => ({
      rule,
      similarity: calculateSimilarity(target, normalizeName(rule.name)),
    }))
    .filter(
      ({ similarity }) => similarity >= SIMILARITY_THRESHOLD && similarity < 1,
    )
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ rule }) => rule);
}

/** Up to three numbered variants of `baseName` that no active rule uses. */
export function suggestRuleNames(
  baseName: string,
  rules: ExceptionRule[],
): string[] {
  const suggestions: string[] = [];
  for (let n = 2; suggestions.length < 3 && n < 100; n += 1) {
    const candidate = `${baseName} ${n}`;
    if (findExactDuplicates(rules, candidate).length === 0) {
      suggestions.push(candidate);
    }
  }
  return suggestions;
}

/** Throws unless `rule` exists, is active, and its type allows `action`. */
export function assertRuleUsableForAction(
  rule: ExceptionRule | undefined,
  ruleId: string,
  action: RuleActionType,
): asserts rule is ExceptionRule {
  if (!rule) {
    throw new ExceptionRuleException(
      ExceptionRuleError.RULE_NOT_FOUND,
      `规则 ID ${ruleId} 不存在`,
    );
  }
  if (!rule.isActive) {
    throw new ExceptionRuleException(
      ExceptionRuleError.RULE_NOT_FOUND,
      `规则 "${rule.name}" 已被删除`,
    );
  }
  if (rule.type !== ruleTypeForAction(action)) {
    const typeName =
      rule.type === ExceptionRuleType.PAUSE_ONLY ? '暂停' : '提前完成';
    const actionName = action === 'pause' ? '暂停计时' : '提前完成';
    throw new ExceptionRuleException(
      ExceptionRuleError.RULE_TYPE_MISMATCH,
      `规则 "${rule.name}" 是${typeName}类型，不能用于${actionName}操作`,
    );
  }
}

export function buildUsageRecord(args: {
  id: string;
  rule: ExceptionRule;
  session: SessionContext;
  action: RuleActionType;
  pauseOptions?: PauseOptions;
  usedAt: Date;
}): RuleUsageRecord {
  const { id, rule, session, action, pauseOptions, usedAt } = args;
  return {
    id,
    ruleId: rule.id,
    chainId: session.chainId,
    sessionId: session.sessionId,
    usedAt,
    actionType: action,
    taskElapsedTime: session.elapsedTime,
    taskRemainingTime: session.remainingTime,
    pauseDuration: pauseOptions?.duration,
    autoResume: pauseOptions?.autoResume,
    ruleScope: rule.scope,
  };
}

interface RepairedRuleData {
  rules: ExceptionRule[];
  usageRecords: RuleUsageRecord[];
  repairCount: number;
}

function isUsableId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && !id.includes(' ');
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Repairs rule data written by older versions or damaged outside the app.
 * Names must be unique among global rules and within each chain; a chain rule
 * may share a global rule's name. Rules without a name are left untouched.
 */
export function repairRuleData(
  storedRules: ExceptionRule[],
  storedRecords: RuleUsageRecord[],
  generateId: () => string,
): RepairedRuleData {
  let repairCount = 0;
  const seenIds = new Set<string>();
  const renamedIds = new Map<string, string>();
  const activeNameCounts = new Map<string, number>();

  const rules = storedRules.map((stored) => {
    const rule = { ...stored };

    const storedId: unknown = stored.id;
    if (!isUsableId(storedId)) {
      const newId = generateId();
      if (typeof storedId === 'string' && storedId.length > 0) {
        renamedIds.set(storedId, newId);
      }
      rule.id = newId;
      repairCount += 1;
    } else if (seenIds.has(rule.id)) {
      rule.id = generateId();
      repairCount += 1;
    }
    seenIds.add(rule.id);

    if (!RULE_TYPES.includes(rule.type)) {
      rule.type = ExceptionRuleType.PAUSE_ONLY;
      repairCount += 1;
    }
    if (!isValidDate(rule.createdAt)) {
      rule.createdAt = new Date();
      repairCount += 1;
    }
    if (typeof rule.usageCount !== 'number' || rule.usageCount < 0) {
      rule.usageCount = 0;
      repairCount += 1;
    }

    if (rule.isActive && typeof rule.name === 'string') {
      const key = [
        rule.scope,
        rule.scope === 'chain' ? rule.chainId : '',
        rule.name.toLowerCase().trim(),
      ].join('\u0000');
      const occurrence = (activeNameCounts.get(key) ?? 0) + 1;
      activeNameCounts.set(key, occurrence);
      if (occurrence > 1) {
        rule.name = `${rule.name} (${occurrence})`;
        repairCount += 1;
      }
    }

    return rule;
  });

  const usageRecords: RuleUsageRecord[] = [];
  for (const stored of storedRecords) {
    const ruleId = renamedIds.get(stored.ruleId) ?? stored.ruleId;
    if (!seenIds.has(ruleId)) {
      repairCount += 1;
      continue;
    }
    const usedAtIsValid = isValidDate(stored.usedAt);
    if (ruleId !== stored.ruleId || !usedAtIsValid) repairCount += 1;
    usageRecords.push({
      ...stored,
      ruleId,
      usedAt: usedAtIsValid ? stored.usedAt : new Date(),
    });
  }

  return { rules, usageRecords, repairCount };
}

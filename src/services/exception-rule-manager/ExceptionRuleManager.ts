import {
  ExceptionRuleError,
  ExceptionRuleException,
  type ExceptionRule,
  type ExceptionRuleType,
  type PauseOptions,
  type RuleUsageRecord,
  type SessionContext,
} from '../../types';
import {
  assertRuleUsableForAction,
  buildUsageRecord,
  findExactDuplicates,
  findSimilarRules,
  repairRuleData,
  suggestRuleNames,
  validateRuleInput,
  type RuleActionType,
} from '../../domain/rules';
import type { RuleStore } from '../../storage/ports';
import { localRuleStore } from '../../storage/localRuleStore';
import { logger } from '../../utils/logger';
import { randomId } from '../../utils/random';
import { t } from '../../utils/runtimeI18n';

export interface RuleCreationResult {
  rule: ExceptionRule;
  warnings: string[];
}

export interface RuleExecutionResult {
  record: RuleUsageRecord;
  rule: ExceptionRule;
}

export interface ImportResult {
  imported: ExceptionRule[];
  skipped: Array<{ name: string; reason: string }>;
  errors: Array<{ name: string; error: string }>;
}

export interface ExportResult {
  rules: ExceptionRule[];
  usageRecords?: RuleUsageRecord[];
  exportedAt: Date;
  summary: { totalRules: number; totalUsageRecords: number };
}

type RuleFields = Pick<ExceptionRule, 'name' | 'type' | 'description'>;

const DUPLICATE_NAME = 'Rule name already exists';

function notFound(id: string): ExceptionRuleException {
  return new ExceptionRuleException(
    ExceptionRuleError.RULE_NOT_FOUND,
    `规则 ID ${id} 不存在`,
  );
}

function replaceAt(
  rules: ExceptionRule[],
  index: number,
  rule: ExceptionRule,
): ExceptionRule[] {
  return rules.map((item, i) => (i === index ? rule : item));
}

function similarNames(rules: ExceptionRule[]): string {
  return rules.map((rule) => rule.name).join('", "');
}

/**
 * Exception rules: creation, editing, use and import/export over a RuleStore.
 * Operations run one at a time so concurrent read-modify-write calls cannot
 * overwrite each other; any non-rule failure surfaces as STORAGE_ERROR.
 */
export class ExceptionRuleManager {
  private initialization: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: RuleStore,
    private readonly generateId: () => string = () => randomId('rule'),
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Repairs stored data once; later calls reuse the result. */
  initialize(): Promise<void> {
    this.initialization ??= this.repairStoredData().catch((error) => {
      this.initialization = null;
      throw error;
    });
    return this.initialization;
  }

  getAllRules(): Promise<ExceptionRule[]> {
    return this.run('Failed to get rule list', () => this.store.getRules());
  }

  suggestRuleNames(name: string): Promise<string[]> {
    return this.run('Failed to suggest rule names', async () =>
      suggestRuleNames(name, await this.store.getRules()),
    );
  }

  /**
   * Creates a global rule. An exact name match throws, or with `reuseExisting`
   * returns the existing rule; similar names only add a warning.
   */
  createRule(
    name: string,
    type: ExceptionRuleType,
    description?: string,
    options: { reuseExisting?: boolean } = {},
  ): Promise<RuleCreationResult> {
    return this.run('Failed to create rule', async () => {
      validateRuleInput({ name, type, description }, true);
      const rules = await this.store.getRules();
      const exact = findExactDuplicates(rules, name);
      if (exact.length > 0) {
        if (!options.reuseExisting) {
          throw new ExceptionRuleException(
            ExceptionRuleError.DUPLICATE_RULE_NAME,
            t(
              'duplication.enhancedHandler.suggestionHelpers.ruleNameExistingRules0nameAlreadyExists',
              { existingRules0Name: exact[0].name },
            ),
          );
        }
        const rule = exact.find((item) => item.type === type) ?? exact[0];
        const warnings =
          rule.type === type
            ? []
            : [
                t(
                  'duplication.enhancedHandler.creationHandlers.ruleTypeRuleTypeDoesNotMatchRequested',
                  { ruleType: rule.type, requestedType: type },
                ),
              ];
        return { rule, warnings };
      }

      const similar = findSimilarRules(rules, name);
      const rule = this.newRule({ name, type, description }, 'global');
      await this.store.saveRules([...rules, rule]);
      const warnings =
        similar.length === 0
          ? []
          : [
              t(
                'duplication.enhancedHandler.creationHandlers.similarRulesFoundSimilarNames',
                { similarNames: similarNames(similar) },
              ),
            ];
      return { rule, warnings };
    });
  }

  /** Creates a rule visible only to `chainId`; names must be unique per chain. */
  createChainRule(
    chainId: string,
    name: string,
    type: ExceptionRuleType,
    description?: string,
  ): Promise<RuleCreationResult> {
    return this.run('Failed to create chain rule', async () => {
      validateRuleInput({ name, type, description }, true);
      if (chainId.trim().length === 0) {
        throw new ExceptionRuleException(
          ExceptionRuleError.VALIDATION_ERROR,
          '链专属规则必须指定 chainId',
        );
      }
      const rules = await this.store.getRules();
      const sameChain = rules.filter(
        (rule) => rule.scope === 'chain' && rule.chainId === chainId,
      );
      if (findExactDuplicates(sameChain, name).length > 0) {
        throw new ExceptionRuleException(
          ExceptionRuleError.DUPLICATE_RULE_NAME,
          `规则名称 "${name.trim()}" 在此链中已存在`,
        );
      }
      const rule = {
        ...this.newRule({ name, type, description }, 'chain'),
        chainId,
      };
      await this.store.saveRules([...rules, rule]);
      return { rule, warnings: [] };
    });
  }

  updateRule(
    id: string,
    updates: Partial<RuleFields>,
  ): Promise<RuleCreationResult> {
    return this.run('Failed to update rule', async () => {
      validateRuleInput(updates, false);
      const rules = await this.store.getRules();
      const index = rules.findIndex((rule) => rule.id === id);
      if (index === -1) throw notFound(id);

      const warnings: string[] = [];
      if (updates.name !== undefined) {
        if (findExactDuplicates(rules, updates.name, id).length > 0) {
          throw new ExceptionRuleException(
            ExceptionRuleError.DUPLICATE_RULE_NAME,
            `Rule name "${updates.name}" already exists`,
          );
        }
        const similar = findSimilarRules(rules, updates.name, id);
        if (similar.length > 0) {
          warnings.push(
            t(
              'ruleManager.ruleMaintenanceService.similarRulesFoundSimilarRuleNames',
              { similarRuleNames: similar.map((rule) => rule.name).join(', ') },
            ),
          );
        }
      }

      const current = rules[index];
      const rule: ExceptionRule = {
        ...current,
        ...updates,
        name: updates.name?.trim() ?? current.name,
      };
      await this.store.saveRules(replaceAt(rules, index, rule));
      return { rule, warnings };
    });
  }

  /** Deactivates the rule; its usage history stays. */
  deleteRule(id: string): Promise<void> {
    return this.run('Failed to delete rule', async () => {
      const rules = await this.store.getRules();
      const index = rules.findIndex((rule) => rule.id === id);
      if (index === -1) throw notFound(id);
      await this.store.saveRules(
        replaceAt(rules, index, { ...rules[index], isActive: false }),
      );
    });
  }

  /** Records one use of a rule for `action`, after checking it allows it. */
  useRule(
    ruleId: string,
    session: SessionContext,
    action: RuleActionType,
    pauseOptions?: PauseOptions,
  ): Promise<RuleExecutionResult> {
    return this.run('Failed to use rule', async () => {
      const rules = await this.store.getRules();
      const index = rules.findIndex((rule) => rule.id === ruleId);
      const current = rules[index];
      assertRuleUsableForAction(current, ruleId, action);

      const usedAt = this.now();
      const record = buildUsageRecord({
        id: this.generateId(),
        rule: current,
        session,
        action,
        pauseOptions,
        usedAt,
      });
      const records = await this.store.getUsageRecords();
      await this.store.saveUsageRecords([...records, record]);

      const rule = {
        ...current,
        usageCount: current.usageCount + 1,
        lastUsedAt: usedAt,
      };
      await this.store.saveRules(replaceAt(rules, index, rule));
      return { record, rule };
    });
  }

  exportRules(includeUsageData = false): Promise<ExportResult> {
    return this.run('Failed to export rule data', async () => {
      const rules = (await this.store.getRules()).filter(
        (rule) => rule.isActive,
      );
      const usageRecords = includeUsageData
        ? await this.store.getUsageRecords()
        : undefined;
      return {
        rules,
        usageRecords,
        exportedAt: this.now(),
        summary: {
          totalRules: rules.length,
          totalUsageRecords: usageRecords?.length ?? 0,
        },
      };
    });
  }

  /**
   * Imports global rules in one save. An exact name match is skipped, updated
   * in place, or reported as an error, depending on the options.
   */
  importRules(
    incoming: RuleFields[],
    options: { skipDuplicates?: boolean; updateExisting?: boolean } = {},
  ): Promise<ImportResult> {
    return this.run('Failed to import rules', async () => {
      const rules = await this.store.getRules();
      const result: ImportResult = { imported: [], skipped: [], errors: [] };

      for (const item of incoming) {
        try {
          validateRuleInput(item, true);
        } catch (error) {
          result.errors.push({
            name: item.name,
            error: (error as Error).message,
          });
          continue;
        }
        const existing = findExactDuplicates(rules, item.name)[0];
        if (!existing) {
          const rule = this.newRule(item, 'global');
          rules.push(rule);
          result.imported.push(rule);
        } else if (options.skipDuplicates) {
          result.skipped.push({ name: item.name, reason: DUPLICATE_NAME });
        } else if (options.updateExisting) {
          const rule = {
            ...existing,
            type: item.type,
            description: item.description,
          };
          rules[rules.indexOf(existing)] = rule;
          result.imported.push(rule);
        } else {
          result.errors.push({ name: item.name, error: DUPLICATE_NAME });
        }
      }

      if (result.imported.length > 0) await this.store.saveRules(rules);
      return result;
    });
  }

  private newRule(
    fields: RuleFields,
    scope: ExceptionRule['scope'],
  ): ExceptionRule {
    return {
      id: this.generateId(),
      name: fields.name.trim(),
      type: fields.type,
      description: fields.description?.trim() || undefined,
      scope,
      createdAt: this.now(),
      usageCount: 0,
      isActive: true,
    };
  }

  private async repairStoredData(): Promise<void> {
    const { rules, usageRecords, repairCount } = repairRuleData(
      await this.store.getRules(),
      await this.store.getUsageRecords(),
      this.generateId,
    );
    if (repairCount === 0) return;
    await this.store.saveRules(rules);
    await this.store.saveUsageRecords(usageRecords);
    logger.warn('EXCEPTION_RULE_MANAGER', 'Repaired stored rule data', {
      repairCount,
    });
  }

  private run<T>(failureMessage: string, operation: () => Promise<T>) {
    const task = this.queue.then(async () => {
      try {
        await this.initialize();
        return await operation();
      } catch (error) {
        if (error instanceof ExceptionRuleException) throw error;
        throw new ExceptionRuleException(
          ExceptionRuleError.STORAGE_ERROR,
          failureMessage,
          error,
        );
      }
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}

export const exceptionRuleManager = new ExceptionRuleManager(localRuleStore);

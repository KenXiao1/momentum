/** Pending rule creation and temporary IDs share one owner. */
import type { ExceptionRule, ExceptionRuleType } from '../types';
import { ExceptionRuleError, ExceptionRuleException } from '../types';
import { exceptionRuleStorage } from './ExceptionRuleStorage';
import { logger } from '../utils/logger';
import { isDev } from '../utils/env';
import { randomId } from '../utils/random';
import { toError, getErrorMessage } from '../utils/errorMessage';

type RuleStatus =
  | 'active'
  | 'creating'
  | 'updating'
  | 'deleting'
  | 'error'
  | 'pending';

interface RuleState {
  id: string;
  status: RuleStatus;
  lastValidated?: Date;
  validationErrors?: string[];
  temporaryId?: string; // 用于跟踪乐观更新的临时ID
  realId?: string; // 实际存储的ID
  createdAt: Date;
  updatedAt: Date;
}

interface PendingRuleCreation {
  temporaryId: string;
  name: string;
  type: ExceptionRuleType;
  description?: string;
  createdAt: Date;
  promise: Promise<ExceptionRule>;
}

interface IdMapping {
  temporaryId: string;
  realId: string;
  mappedAt: Date;
}

class RuleStateManager {
  private states = new Map<string, RuleState>();

  private pendingCreations = new Map<string, PendingRuleCreation>();

  private idMappings = new Map<string, IdMapping>();

  private idCounter = 0;

  private generateTemporaryId(): string {
    this.idCounter++;
    return `temp_${Date.now()}_${this.idCounter}`;
  }

  private trackRuleState(
    ruleId: string,
    status: RuleStatus,
    temporaryId?: string,
  ): void {
    const now = new Date();
    const existingState = this.states.get(ruleId);

    const state: RuleState = {
      id: ruleId,
      status,
      temporaryId,
      createdAt: existingState?.createdAt || now,
      updatedAt: now,
      lastValidated: existingState?.lastValidated,
      validationErrors: existingState?.validationErrors,
      realId: existingState?.realId,
    };

    this.states.set(ruleId, state);

    if (temporaryId) {
      this.states.set(temporaryId, state);
    }

    if (isDev) {
      logger.debug('RULE_STATE', 'Rule state updated', {
        ruleId,
        status,
        temporaryId,
        state,
      });
    }
  }

  getAllStates(): {
    states: Map<string, RuleState>;
    pendingCreations: Map<string, PendingRuleCreation>;
    idMappings: Map<string, IdMapping>;
  } {
    return {
      states: new Map(this.states),
      pendingCreations: new Map(this.pendingCreations),
      idMappings: new Map(this.idMappings),
    };
  }

  private getRealRuleId(temporaryId: string): string | null {
    const mapping = this.idMappings.get(temporaryId);
    if (mapping) {
      return mapping.realId;
    }

    const state = this.states.get(temporaryId);
    if (state?.realId) {
      return state.realId;
    }

    if (!temporaryId.startsWith('temp_')) {
      return temporaryId;
    }

    return null;
  }

  private applyCreationSuccess(temporaryId: string, realId: string): void {
    this.idMappings.set(temporaryId, {
      temporaryId,
      realId,
      mappedAt: new Date(),
    });

    this.trackRuleState(realId, 'active');
    this.trackRuleState(temporaryId, 'active', temporaryId);

    const state = this.states.get(temporaryId);
    if (state) {
      state.realId = realId;
      state.status = 'active';
      this.states.set(temporaryId, state);
      this.states.set(realId, state);
    }
  }

  private applyCreationError(temporaryId: string, errorMessage: string): void {
    this.trackRuleState(temporaryId, 'error');

    const state = this.states.get(temporaryId);
    if (state) {
      state.validationErrors = [errorMessage];
      this.states.set(temporaryId, state);
    }
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟

    for (const [id, state] of this.states.entries()) {
      if (now - state.updatedAt.getTime() > maxAge) {
        this.states.delete(id);
      }
    }

    for (const [tempId, mapping] of this.idMappings.entries()) {
      if (now - mapping.mappedAt.getTime() > maxAge) {
        this.idMappings.delete(tempId);
      }
    }

    for (const [tempId, pending] of this.pendingCreations.entries()) {
      if (now - pending.createdAt.getTime() > maxAge) {
        this.pendingCreations.delete(tempId);
      }
    }
  }

  startOptimisticCreation(
    name: string,
    type: ExceptionRuleType,
    description?: string,
  ): { temporaryRule: ExceptionRule; temporaryId: string } {
    const temporaryId = this.generateTemporaryId();
    const now = new Date();

    const temporaryRule: ExceptionRule = {
      id: temporaryId,
      name,
      type,
      description,
      scope: 'global',
      chainId: undefined,
      createdAt: now,
      lastUsedAt: undefined,
      usageCount: 0,
      isActive: true,
      isArchived: false,
    };

    this.trackRuleState(temporaryId, 'creating');

    const creationPromise = this.performActualCreation(temporaryRule);

    const pendingCreation: PendingRuleCreation = {
      temporaryId,
      name,
      type,
      description,
      createdAt: now,
      promise: creationPromise,
    };

    this.pendingCreations.set(temporaryId, pendingCreation);

    creationPromise
      .then((realRule) => {
        this.handleCreationSuccess(temporaryId, realRule);
      })
      .catch((error) => {
        this.handleCreationError(temporaryId, error);
      });

    return { temporaryRule, temporaryId };
  }

  async waitForRuleCreation(temporaryId: string): Promise<ExceptionRule> {
    const pending = this.pendingCreations.get(temporaryId);
    if (!pending) {
      throw new ExceptionRuleException(
        ExceptionRuleError.RULE_NOT_FOUND,
        `临时规则 ${temporaryId} 不存在`,
      );
    }

    try {
      const realRule = await pending.promise;
      return realRule;
    } catch (error) {
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        `规则创建失败: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  private async performActualCreation(
    temporaryRule: ExceptionRule,
  ): Promise<ExceptionRule> {
    try {
      const realId = randomId('rule');

      const realRule = await exceptionRuleStorage.createRule({
        name: temporaryRule.name,
        type: temporaryRule.type,
        description: temporaryRule.description,
        scope: temporaryRule.scope,
        chainId: temporaryRule.chainId,
        isArchived: temporaryRule.isArchived || false,
      });

      if (realRule.id !== realId) {
        realRule.id = realId;
      }

      return realRule;
    } catch (error) {
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        `创建规则失败: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  private handleCreationSuccess(
    temporaryId: string,
    realRule: ExceptionRule,
  ): void {
    logger.info('RULE_STATE', '规则创建成功', {
      temporaryId,
      realId: realRule.id,
    });

    this.applyCreationSuccess(temporaryId, realRule.id);
    this.pendingCreations.delete(temporaryId);
  }

  private handleCreationError(temporaryId: string, error: unknown): void {
    const err = toError(error);
    logger.error('RULE_STATE', `规则创建失败: ${temporaryId}`, undefined, err);

    this.applyCreationError(temporaryId, err.message);
    this.pendingCreations.delete(temporaryId);
  }

  async validateRuleId(ruleId: string): Promise<{
    isValid: boolean;
    isTemporary: boolean;
    realId?: string;
    error?: string;
  }> {
    try {
      const isTemporary = ruleId.startsWith('temp_');

      if (isTemporary) {
        const pending = this.pendingCreations.get(ruleId);
        if (pending) {
          return {
            isValid: true,
            isTemporary: true,
            realId: undefined,
          };
        }

        const realId = this.getRealRuleId(ruleId);
        if (realId) {
          return {
            isValid: true,
            isTemporary: true,
            realId,
          };
        }

        return {
          isValid: false,
          isTemporary: true,
          error: '临时规则不存在或已过期',
        };
      }

      const rule = await exceptionRuleStorage.getRuleById(ruleId);
      return {
        isValid: rule !== null,
        isTemporary: false,
        realId: ruleId,
        error: rule ? undefined : '规则不存在',
      };
    } catch (error) {
      return {
        isValid: false,
        isTemporary: false,
        error: getErrorMessage(error),
      };
    }
  }

  async syncRuleStates(): Promise<void> {
    try {
      const allRules = await exceptionRuleStorage.getRules();

      for (const rule of allRules) {
        this.trackRuleState(rule.id, 'active');
      }

      const existingIds = new Set(allRules.map((r) => r.id));
      for (const id of this.states.keys()) {
        if (!id.startsWith('temp_') && !existingIds.has(id))
          this.states.delete(id);
      }
    } catch (error) {
      const err = toError(error);
      logger.error('RULE_STATE', '同步规则状态失败', undefined, err);
    }
  }

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredStates();
      },
      5 * 60 * 1000,
    ); // 每5分钟清理一次
  }

  stop(): void {
    if (!this.cleanupInterval) return;
    clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
  }
}

export const ruleStateManager = new RuleStateManager();

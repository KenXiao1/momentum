import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExceptionRuleError,
  ExceptionRuleException,
  ExceptionRuleType,
  type ExceptionRule,
} from '../../../types';

const exceptionRuleStorageMock = vi.hoisted(() => ({
  validateRule: vi.fn(),
  createRule: vi.fn(),
  getRuleById: vi.fn(),
}));

const enhancedDuplicationHandlerMock = vi.hoisted(() => ({
  handleDuplicateCreation: vi.fn(),
  checkDuplicationRealTime: vi.fn(),
}));

const validateRulesIntegrityMock = vi.hoisted(() => vi.fn());

const errorClassificationServiceMock = vi.hoisted(() => ({
  analyzeError: vi.fn(),
}));

const errorRecoveryManagerMock = vi.hoisted(() => ({
  attemptRecovery: vi.fn(),
}));

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../ExceptionRuleStorage', () => ({
  exceptionRuleStorage: exceptionRuleStorageMock,
}));

vi.mock('../../EnhancedDuplicationHandler', () => ({
  enhancedDuplicationHandler: enhancedDuplicationHandlerMock,
}));

vi.mock('../../validateRulesIntegrity', () => ({
  validateRulesIntegrity: validateRulesIntegrityMock,
}));

vi.mock('../../ErrorClassificationService', () => ({
  errorClassificationService: errorClassificationServiceMock,
}));

vi.mock('../../ErrorRecoveryManager', () => ({
  errorRecoveryManager: errorRecoveryManagerMock,
}));

vi.mock('../../../utils/logger', () => ({
  logger: loggerMock,
}));

vi.mock('../../../utils/env', () => ({
  isDev: true,
}));

vi.mock('../../../utils/runtimeI18n', () => ({
  tr: (_zh: string, en: string) => en,
}));

import { ruleCreator } from '../RuleCreator';

function createRule(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    id: overrides.id ?? 'rule-1',
    name: overrides.name ?? 'Focus Rule',
    description: overrides.description ?? 'desc',
    type: overrides.type ?? ExceptionRuleType.PAUSE_ONLY,
    scope: overrides.scope ?? 'global',
    chainId: overrides.chainId,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    lastUsedAt: overrides.lastUsedAt,
    usageCount: overrides.usageCount ?? 0,
    isActive: overrides.isActive ?? true,
    isArchived: overrides.isArchived,
  };
}

describe('rule-manager/RuleCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    exceptionRuleStorageMock.validateRule.mockImplementation(() => undefined);
    enhancedDuplicationHandlerMock.handleDuplicateCreation.mockResolvedValue({
      rule: createRule(),
      warnings: ['duplicate warning'],
    });
    validateRulesIntegrityMock.mockResolvedValue({
      invalidRules: [],
    });
    errorClassificationServiceMock.analyzeError.mockReturnValue({
      error: new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        'classified error',
      ),
    });
    errorRecoveryManagerMock.attemptRecovery.mockResolvedValue({
      success: false,
    });
    exceptionRuleStorageMock.getRuleById.mockResolvedValue(
      createRule({ id: 'rule-recovered' }),
    );
    enhancedDuplicationHandlerMock.checkDuplicationRealTime.mockResolvedValue({
      hasConflict: true,
      conflictMessage: 'duplicate found',
      suggestions: [
        {
          type: 'modify_name',
          title: 'Rename',
          description: 'Use a different name',
          suggestedName: 'Focus Rule (1)',
        },
      ],
    });
  });

  it('creates rules through duplication handler and returns warnings', async () => {
    const result = await ruleCreator.createRule(
      'Focus Rule',
      ExceptionRuleType.PAUSE_ONLY,
      'test desc',
    );

    expect(exceptionRuleStorageMock.validateRule).toHaveBeenCalledWith(
      {
        name: 'Focus Rule',
        type: ExceptionRuleType.PAUSE_ONLY,
        description: 'test desc',
      },
      true,
    );
    expect(
      enhancedDuplicationHandlerMock.handleDuplicateCreation,
    ).toHaveBeenCalledWith(
      'Focus Rule',
      ExceptionRuleType.PAUSE_ONLY,
      'test desc',
      undefined,
    );
    expect(result).toEqual({
      rule: createRule(),
      warnings: ['duplicate warning'],
    });
  });

  it('logs warnings when created rule fails integrity validation', async () => {
    validateRulesIntegrityMock.mockResolvedValue({
      invalidRules: [{ ruleId: 'rule-1' }],
    });

    await ruleCreator.createRule('Focus Rule', ExceptionRuleType.PAUSE_ONLY);

    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
  });

  it('recovers creation errors when recovery returns a valid rule id', async () => {
    const classifiedError = new ExceptionRuleException(
      ExceptionRuleError.STORAGE_ERROR,
      'classified',
    );
    enhancedDuplicationHandlerMock.handleDuplicateCreation.mockRejectedValue(
      new Error('duplicate handler failed'),
    );
    errorClassificationServiceMock.analyzeError.mockReturnValue({
      error: classifiedError,
    });
    errorRecoveryManagerMock.attemptRecovery.mockResolvedValue({
      success: true,
      recoveredData: { id: 'rule-recovered' },
    });
    exceptionRuleStorageMock.getRuleById.mockResolvedValue(
      createRule({ id: 'rule-recovered' }),
    );

    const result = await ruleCreator.createRule(
      'Recovered Rule',
      ExceptionRuleType.PAUSE_ONLY,
    );

    expect(result.rule.id).toBe('rule-recovered');
    expect(result.warnings).toEqual(['Rule created via error recovery']);
  });

  it('throws classified errors when recovery cannot resolve creation failure', async () => {
    const classifiedError = new ExceptionRuleException(
      ExceptionRuleError.STORAGE_ERROR,
      'classified',
    );
    enhancedDuplicationHandlerMock.handleDuplicateCreation.mockRejectedValue(
      new Error('duplicate handler failed'),
    );
    errorClassificationServiceMock.analyzeError.mockReturnValue({
      error: classifiedError,
    });
    errorRecoveryManagerMock.attemptRecovery.mockResolvedValue({
      success: false,
    });

    await expect(
      ruleCreator.createRule('Failed Rule', ExceptionRuleType.PAUSE_ONLY),
    ).rejects.toBe(classifiedError);
  });

  it('creates chain-scoped rules and returns wrapped storage errors when needed', async () => {
    const chainRule = createRule({
      id: 'chain-rule',
      scope: 'chain',
      chainId: 'chain-1',
    });
    exceptionRuleStorageMock.createRule.mockResolvedValueOnce(chainRule);

    const success = await ruleCreator.createChainRule(
      'chain-1',
      'Chain Rule',
      ExceptionRuleType.EARLY_COMPLETION_ONLY,
      'chain desc',
    );

    expect(exceptionRuleStorageMock.createRule).toHaveBeenCalledWith({
      name: 'Chain Rule',
      type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      description: 'chain desc',
      chainId: 'chain-1',
      scope: 'chain',
    });
    expect(success).toEqual({ rule: chainRule, warnings: [] });

    const knownError = new ExceptionRuleException(
      ExceptionRuleError.DUPLICATE_RULE_NAME,
      'duplicate',
    );
    exceptionRuleStorageMock.createRule.mockRejectedValueOnce(knownError);
    await expect(
      ruleCreator.createChainRule(
        'chain-1',
        'Known Error',
        ExceptionRuleType.PAUSE_ONLY,
      ),
    ).rejects.toBe(knownError);

    exceptionRuleStorageMock.createRule.mockRejectedValueOnce(
      new Error('db down'),
    );
    await expect(
      ruleCreator.createChainRule(
        'chain-1',
        'Wrapped Error',
        ExceptionRuleType.PAUSE_ONLY,
      ),
    ).rejects.toMatchObject({
      type: ExceptionRuleError.STORAGE_ERROR,
      message: 'Failed to create chain rule',
    });
  });

  it('supports real-time name checks with fallback', async () => {
    const checkResult = await ruleCreator.checkRuleNameRealTime(
      'Rule Name',
      'exclude-id',
    );
    expect(checkResult).toEqual({
      hasConflict: true,
      conflictMessage: 'duplicate found',
      suggestions: [
        {
          type: 'modify_name',
          title: 'Rename',
          description: 'Use a different name',
          suggestedName: 'Focus Rule (1)',
        },
      ],
    });

    enhancedDuplicationHandlerMock.checkDuplicationRealTime.mockRejectedValueOnce(
      new Error('real-time check failed'),
    );
    await expect(
      ruleCreator.checkRuleNameRealTime('Rule Name'),
    ).resolves.toEqual({
      hasConflict: false,
      suggestions: [],
    });
  });
});

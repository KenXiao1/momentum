import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExceptionRuleError, ExceptionRuleException } from '../../../types';

const dataIntegrityCheckerMock = vi.hoisted(() => ({
  checkRuleDataIntegrity: vi.fn(),
  autoFixIssues: vi.fn(),
}));

const enhancedDuplicationHandlerMock = vi.hoisted(() => ({
  generateNameSuggestions: vi.fn(),
}));

vi.mock('../../DataIntegrityChecker', () => ({
  dataIntegrityChecker: dataIntegrityCheckerMock,
}));

vi.mock('../../EnhancedDuplicationHandler', () => ({
  enhancedDuplicationHandler: enhancedDuplicationHandlerMock,
}));

import { recoveryHandlers } from '../RecoveryHandlers';

function createError(
  message: string,
  details?: unknown,
  type: ExceptionRuleError = ExceptionRuleError.STORAGE_ERROR,
): ExceptionRuleException {
  return new ExceptionRuleException(type, message, details);
}

describe('recovery/RecoveryHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user-action responses for direct prompt handlers', async () => {
    const error = createError('validation needed');
    const handlers = [
      recoveryHandlers.handleCreateNewRule,
      recoveryHandlers.handleSelectExistingRule,
      recoveryHandlers.handleCreateCorrectType,
      recoveryHandlers.handleSelectMatchingRule,
      recoveryHandlers.handleRetryOperation,
      recoveryHandlers.handleValidationFix,
      recoveryHandlers.handleSystemReset,
    ];

    for (const handler of handlers) {
      const result = await handler(error);
      expect(result.success).toBe(false);
      expect(result.requiresUserAction).toBe(true);
    }
  });

  it('uses existing rules from error details when available', async () => {
    const existingRule = { id: 'rule-1', name: 'Existing' };
    const success = await recoveryHandlers.handleUseExistingRule(
      createError('duplicate', { existingRules: [existingRule] }),
    );
    expect(success).toEqual(
      expect.objectContaining({
        success: true,
        recoveredData: existingRule,
      }),
    );

    const failure = await recoveryHandlers.handleUseExistingRule(
      createError('duplicate', {}),
    );
    expect(failure.success).toBe(false);
  });

  it('generates rename suggestions when rule name can be parsed', async () => {
    enhancedDuplicationHandlerMock.generateNameSuggestions.mockReturnValue([
      'Focus Rule (1)',
    ]);

    const success = await recoveryHandlers.handleRenameRule(
      createError('Rule name "Focus Rule" already exists'),
    );
    expect(
      enhancedDuplicationHandlerMock.generateNameSuggestions,
    ).toHaveBeenCalledWith('Focus Rule', []);
    expect(success).toEqual(
      expect.objectContaining({
        success: true,
        recoveredData: { suggestedName: 'Focus Rule (1)' },
      }),
    );

    enhancedDuplicationHandlerMock.generateNameSuggestions.mockReturnValue([]);
    const failure = await recoveryHandlers.handleRenameRule(
      createError('Rule name "Focus Rule" already exists'),
    );
    expect(failure.success).toBe(false);
  });

  it('handles data integrity checks with no issues and with auto-fix actions', async () => {
    dataIntegrityCheckerMock.checkRuleDataIntegrity.mockResolvedValueOnce({
      issues: [],
    });

    const noIssueResult = await recoveryHandlers.handleDataIntegrityCheck(
      createError('storage'),
    );
    expect(noIssueResult).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );

    dataIntegrityCheckerMock.checkRuleDataIntegrity.mockResolvedValueOnce({
      issues: [
        { type: 'A', description: 'fix me', autoFixable: true },
        { type: 'B', description: 'manual', autoFixable: false },
      ],
    });
    dataIntegrityCheckerMock.autoFixIssues.mockResolvedValueOnce([
      { success: true },
      { success: false },
    ]);

    const issueResult = await recoveryHandlers.handleDataIntegrityCheck(
      createError('storage'),
    );
    expect(issueResult.success).toBe(false);
    expect(issueResult.actions).toHaveLength(1);

    const autoFixResult = await issueResult.actions?.[0]?.handler();
    expect(dataIntegrityCheckerMock.autoFixIssues).toHaveBeenCalledTimes(1);
    expect(autoFixResult).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('returns graceful failures when data integrity checks throw', async () => {
    dataIntegrityCheckerMock.checkRuleDataIntegrity.mockRejectedValueOnce(
      new Error('check failed'),
    );
    const integrityFailure = await recoveryHandlers.handleDataIntegrityCheck(
      createError('storage'),
    );
    expect(integrityFailure.success).toBe(false);
  });
});

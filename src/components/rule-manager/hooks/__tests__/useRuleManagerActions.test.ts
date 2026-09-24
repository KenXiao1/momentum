import { createTranslator } from '../../../../i18n/translate';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExceptionRuleError,
  ExceptionRuleException,
  ExceptionRuleType,
  type ExceptionRule,
} from '../../../../types';
import { useRuleManagerActions } from '../useRuleManagerActions';

const exceptionRuleManagerMock = vi.hoisted(() => ({
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  exportRules: vi.fn(),
  getDuplicationSuggestions: vi.fn(),
}));

const asyncOperationManagerMock = vi.hoisted(() => ({
  executeOperation: vi.fn(),
}));

const errorMessageMock = vi.hoisted(() => ({
  getSafeErrorDetail: vi.fn(),
  getSafeErrorDetailFromUnknown: vi.fn(),
  toError: vi.fn((value: unknown) =>
    value instanceof Error ? value : new Error(String(value)),
  ),
}));
const saveFileMock = vi.hoisted(() => vi.fn(async () => true));

vi.mock('../../../../services/ExceptionRuleManager', () => ({
  exceptionRuleManager: exceptionRuleManagerMock,
}));

vi.mock('../../../../utils/AsyncOperationManager', () => ({
  asyncOperationManager: asyncOperationManagerMock,
}));

vi.mock('../../../../utils/errorMessage', () => errorMessageMock);

vi.mock('../../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({
    file: {
      saveFile: saveFileMock,
    },
  }),
}));

function createRule(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    id: overrides.id ?? 'rule-1',
    name: overrides.name ?? 'Rule 1',
    description: overrides.description,
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

function createState<T>(initial: T) {
  let value = initial;
  const set = vi.fn((next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
  });

  return {
    get: () => value,
    set,
  };
}

function createArgs(overrides?: {
  editingRule?: ExceptionRule | null;
  rules?: ExceptionRule[];
}) {
  const rulesState = createState<ExceptionRule[]>(overrides?.rules ?? []);
  const formErrorsState = createState<string[]>([]);
  const formWarningsState = createState<string[]>([]);
  const duplicateSuggestionsState = createState<string[]>([]);
  const errorState = createState<string | null>(null);
  const editingRuleState = createState<ExceptionRule | null>(
    overrides?.editingRule ?? null,
  );
  const showCreateFormState = createState(true);

  const loadRules = vi.fn(async () => undefined);
  const resetForm = vi.fn();
  const beginEditRule = vi.fn();

  return {
    args: {
      language: 'en' as const,
      t: createTranslator('en'),
      loadRules,
      setError: errorState.set,
      formData: {
        name: 'New Rule',
        type: ExceptionRuleType.PAUSE_ONLY,
        description: 'test description',
      },
      editingRule: editingRuleState.get(),
      setEditingRule: editingRuleState.set,
      setShowCreateForm: showCreateFormState.set,
      resetForm,
      beginEditRule,
      setRules: rulesState.set,
      setFormErrors: formErrorsState.set,
      setFormWarnings: formWarningsState.set,
      setDuplicateSuggestions: duplicateSuggestionsState.set,
    },
    rulesState,
    formErrorsState,
    formWarningsState,
    duplicateSuggestionsState,
    errorState,
    loadRules,
    resetForm,
    beginEditRule,
    showCreateFormState,
    editingRuleState,
  };
}

describe('useRuleManagerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveFileMock.mockResolvedValue(true);
    errorMessageMock.getSafeErrorDetail.mockReturnValue('friendly error');
    errorMessageMock.getSafeErrorDetailFromUnknown.mockReturnValue(
      'friendly unknown error',
    );
  });

  it('creates rule successfully with optimistic update replacement', async () => {
    const createdRule = createRule({ id: 'server-rule', name: 'Server Rule' });
    asyncOperationManagerMock.executeOperation.mockImplementation(
      async ({ operation, onSuccess }) => {
        await operation();
        onSuccess?.({ rule: createdRule, warnings: [] });
        return undefined;
      },
    );
    exceptionRuleManagerMock.createRule.mockResolvedValue({
      rule: createdRule,
      warnings: [],
    });

    const context = createArgs();
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    await act(async () => {
      await result.current.handleCreateRule();
    });

    expect(exceptionRuleManagerMock.createRule).toHaveBeenCalledWith(
      'New Rule',
      ExceptionRuleType.PAUSE_ONLY,
      'test description',
    );
    expect(context.rulesState.get()).toEqual([createdRule]);
    expect(context.showCreateFormState.set).toHaveBeenCalledWith(false);
    expect(context.resetForm).toHaveBeenCalledTimes(1);
    expect(result.current.savingOperations.size).toBe(0);
    expect(result.current.optimisticUpdates.size).toBe(0);
  });

  it('keeps create form open and shows warnings when creation returns warnings', async () => {
    const createdRule = createRule({
      id: 'server-rule-with-warning',
      name: 'Server Rule Warning',
    });
    asyncOperationManagerMock.executeOperation.mockImplementation(
      async ({ operation, onSuccess }) => {
        await operation();
        onSuccess?.({ rule: createdRule, warnings: ['warning-1'] });
        return undefined;
      },
    );
    exceptionRuleManagerMock.createRule.mockResolvedValue({
      rule: createdRule,
      warnings: ['warning-1'],
    });

    const context = createArgs();
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    await act(async () => {
      await result.current.handleCreateRule();
    });

    expect(context.formWarningsState.get()).toEqual(['warning-1']);
    expect(context.showCreateFormState.set).not.toHaveBeenCalledWith(false);
    expect(context.resetForm).not.toHaveBeenCalled();
  });

  it('handles duplicate name creation errors and loads name suggestions', async () => {
    asyncOperationManagerMock.executeOperation.mockImplementation(
      async ({ onError }) => {
        onError?.(
          new ExceptionRuleException(
            ExceptionRuleError.DUPLICATE_RULE_NAME,
            'duplicate rule name',
          ),
        );
        return undefined;
      },
    );
    exceptionRuleManagerMock.getDuplicationSuggestions.mockResolvedValue({
      hasExactMatch: true,
      hasSimilarRules: false,
      exactMatches: [],
      similarMatches: [],
      suggestion: null,
      nameSuggestions: ['New Rule (1)', 'New Rule (2)'],
    });

    const context = createArgs();
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    await act(async () => {
      await result.current.handleCreateRule();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(context.rulesState.get()).toHaveLength(0);
    expect(context.formErrorsState.get()).toEqual(['friendly error']);
    expect(
      exceptionRuleManagerMock.getDuplicationSuggestions,
    ).toHaveBeenCalledWith('New Rule');
    expect(context.duplicateSuggestionsState.get()).toEqual([
      'New Rule (1)',
      'New Rule (2)',
    ]);
  });

  it('rolls back updated rule when async update fails', async () => {
    const originalRule = createRule({ id: 'rule-123', name: 'Original name' });
    asyncOperationManagerMock.executeOperation.mockImplementation(
      async ({ onError }) => {
        onError?.(
          new ExceptionRuleException(
            ExceptionRuleError.VALIDATION_ERROR,
            'bad input',
          ),
        );
        return undefined;
      },
    );

    const context = createArgs({
      editingRule: originalRule,
      rules: [originalRule],
    });
    context.args.formData = {
      ...context.args.formData,
      name: 'Updated name',
      description: 'updated desc',
    };

    const { result } = renderHook(() => useRuleManagerActions(context.args));

    await act(async () => {
      await result.current.handleUpdateRule();
    });

    expect(context.formErrorsState.get()).toEqual(['friendly error']);
    expect(context.rulesState.get()[0]?.name).toBe('Original name');
    expect(result.current.savingOperations.size).toBe(0);
  });

  it('handles update success warnings without closing edit mode', async () => {
    const originalRule = createRule({
      id: 'rule-update-warning',
      name: 'Original name',
    });
    asyncOperationManagerMock.executeOperation.mockImplementation(
      async ({ operation, onSuccess }) => {
        await operation();
        onSuccess?.({ rule: originalRule, warnings: ['update-warning'] });
        return undefined;
      },
    );
    exceptionRuleManagerMock.updateRule.mockResolvedValue({
      rule: originalRule,
      warnings: ['update-warning'],
    });

    const context = createArgs({
      editingRule: originalRule,
      rules: [originalRule],
    });
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    await act(async () => {
      await result.current.handleUpdateRule();
    });

    expect(context.formWarningsState.get()).toEqual(['update-warning']);
    expect(context.editingRuleState.set).not.toHaveBeenCalledWith(null);
    expect(context.resetForm).not.toHaveBeenCalled();
  });

  it('returns early when trying to update without an editing rule', async () => {
    const context = createArgs({ editingRule: null, rules: [] });
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    await act(async () => {
      await result.current.handleUpdateRule();
    });

    expect(asyncOperationManagerMock.executeOperation).not.toHaveBeenCalled();
  });

  it('handles non-exception update errors and executeOperation throws', async () => {
    const originalRule = createRule({
      id: 'rule-unknown-error',
      name: 'Original name',
    });
    const context = createArgs({
      editingRule: originalRule,
      rules: [originalRule],
    });
    const { result, rerender } = renderHook(() =>
      useRuleManagerActions(context.args),
    );

    asyncOperationManagerMock.executeOperation.mockImplementationOnce(
      async ({ onError }) => {
        onError?.(new Error('unknown update error'));
        return undefined;
      },
    );

    await act(async () => {
      await result.current.handleUpdateRule();
    });

    expect(context.formErrorsState.get()).toEqual([
      'Failed to update rule. Please try again.',
    ]);

    asyncOperationManagerMock.executeOperation.mockImplementationOnce(
      async () => {
        throw new Error('execute failed before handlers');
      },
    );

    rerender();
    await act(async () => {
      await result.current.handleUpdateRule();
    });

    expect(context.formErrorsState.get()).toEqual(['Failed to update rule']);
  });

  it('delegates edit action to beginEditRule', () => {
    const context = createArgs();
    const { result } = renderHook(() => useRuleManagerActions(context.args));
    const rule = createRule({ id: 'edit-rule' });

    act(() => {
      result.current.handleEditRule(rule);
    });

    expect(context.beginEditRule).toHaveBeenCalledWith(rule);
  });

  it('confirms delete and reloads rules', async () => {
    const rule = createRule({ id: 'delete-me' });
    exceptionRuleManagerMock.deleteRule.mockResolvedValue(undefined);

    const context = createArgs();
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    act(() => {
      result.current.handleDeleteRule(rule);
    });

    await act(async () => {
      await result.current.confirmDeleteRule();
    });

    expect(exceptionRuleManagerMock.deleteRule).toHaveBeenCalledWith(
      'delete-me',
    );
    expect(context.loadRules).toHaveBeenCalledTimes(1);
  });

  it('surfaces delete errors via translated safe detail', async () => {
    const rule = createRule({ id: 'delete-fail' });
    exceptionRuleManagerMock.deleteRule.mockRejectedValue(
      new Error('delete failed'),
    );

    const context = createArgs();
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    act(() => {
      result.current.handleDeleteRule(rule);
    });

    await act(async () => {
      await result.current.confirmDeleteRule();
    });

    expect(context.errorState.get()).toBe('friendly unknown error');
  });

  it('exports rules through capability center and handles export failure', async () => {
    const context = createArgs();
    const { result } = renderHook(() => useRuleManagerActions(context.args));

    exceptionRuleManagerMock.exportRules.mockResolvedValue({
      rules: [],
      usageRecords: [],
    });

    await act(async () => {
      await result.current.handleExportRules();
    });

    expect(saveFileMock).toHaveBeenCalledTimes(1);
    expect(saveFileMock).toHaveBeenCalledWith(
      expect.stringContaining('"rules"'),
      expect.stringMatching(/^exception-rules-\d{4}-\d{2}-\d{2}\.json$/),
    );

    exceptionRuleManagerMock.exportRules.mockRejectedValue(
      new Error('cannot export'),
    );
    await act(async () => {
      await result.current.handleExportRules();
    });

    expect(context.errorState.get()).toBe('Failed to export rules');
  });
});

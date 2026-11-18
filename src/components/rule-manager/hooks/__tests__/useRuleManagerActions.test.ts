import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../i18n/translate';
import { exceptionRuleManager } from '../../../../services/ExceptionRuleManager';
import { ExceptionRuleType, type ExceptionRule } from '../../../../types';
import { LOCAL_STORAGE_KEYS } from '../../../../utils/local-preferences/keys';
import { localPreferences } from '../../../../utils/localPreferences';
import type { RuleManagerFormData } from '../../types';
import { useRuleManagerActions } from '../useRuleManagerActions';

const saveFile = vi.hoisted(() =>
  vi.fn(async (_content: string, _fileName: string) => true),
);

// Native file saving is the only collaborator replaced; rules persist for real.
vi.mock('../../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({ file: { saveFile } }),
}));

function state<T>(initial: T) {
  let value = initial;
  const set = vi.fn((next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
  });
  return { get: () => value, set };
}

function storedRules(): ExceptionRule[] {
  return JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_KEYS.EXCEPTION_RULES) ?? '[]',
  );
}

function renderActions(
  formData: Partial<RuleManagerFormData> = {},
  editingRule: ExceptionRule | null = null,
) {
  const rules = state<ExceptionRule[]>(editingRule ? [editingRule] : []);
  const formErrors = state<string[]>([]);
  const formWarnings = state<string[]>([]);
  const suggestions = state<string[]>([]);
  const error = state<string | null>(null);
  const editing = state(editingRule);
  const showCreateForm = state(true);
  const resetForm = vi.fn();
  const loadRules = vi.fn(async () => {
    rules.set(await exceptionRuleManager.getAllRules());
  });
  const { result } = renderHook(() =>
    useRuleManagerActions({
      language: 'en',
      t: createTranslator('en'),
      loadRules,
      setError: error.set,
      formData: {
        name: 'Refill water',
        type: ExceptionRuleType.PAUSE_ONLY,
        description: '',
        ...formData,
      },
      editingRule: editing.get(),
      setEditingRule: editing.set,
      setShowCreateForm: showCreateForm.set,
      resetForm,
      beginEditRule: vi.fn(),
      setRules: rules.set,
      setFormErrors: formErrors.set,
      setFormWarnings: formWarnings.set,
      setDuplicateSuggestions: suggestions.set,
    }),
  );
  return {
    result,
    rules,
    formErrors,
    formWarnings,
    suggestions,
    error,
    editing,
    showCreateForm,
    resetForm,
  };
}

describe('useRuleManagerActions', () => {
  beforeEach(() => {
    localStorage.clear();
    localPreferences.setLanguage('en');
    saveFile.mockClear();
  });

  it('creates a global rule, replaces the placeholder, and closes the form', async () => {
    const view = renderActions();

    await act(() => view.result.current.handleCreateRule());

    const [saved] = storedRules();
    expect(saved).toMatchObject({ name: 'Refill water', scope: 'global' });
    expect(view.rules.get()).toEqual([
      expect.objectContaining({ id: saved.id }),
    ]);
    expect(view.showCreateForm.get()).toBe(false);
    expect(view.resetForm).toHaveBeenCalledTimes(1);
    expect(view.result.current.savingOperations.size).toBe(0);
    expect(view.result.current.optimisticUpdates.size).toBe(0);
  });

  it('keeps the form open with a warning when a similar rule exists', async () => {
    await exceptionRuleManager.createRule(
      'Refill waters',
      ExceptionRuleType.PAUSE_ONLY,
    );
    const view = renderActions();

    await act(() => view.result.current.handleCreateRule());

    expect(storedRules()).toHaveLength(2);
    expect(view.formWarnings.get()).toHaveLength(1);
    expect(view.showCreateForm.get()).toBe(true);
  });

  it('rolls back the placeholder and suggests names on a duplicate', async () => {
    await exceptionRuleManager.createRule(
      'Refill water',
      ExceptionRuleType.PAUSE_ONLY,
    );
    const view = renderActions({ name: 'refill  WATER' });

    await act(() => view.result.current.handleCreateRule());

    expect(storedRules()).toHaveLength(1);
    expect(view.rules.get()).toEqual([]);
    expect(view.formErrors.get()).toHaveLength(1);
    expect(view.suggestions.get()).toEqual([
      'refill  WATER 2',
      'refill  WATER 3',
      'refill  WATER 4',
    ]);
  });

  it('saves an edit and leaves edit mode', async () => {
    const { rule } = await exceptionRuleManager.createRule(
      'Refill water',
      ExceptionRuleType.PAUSE_ONLY,
    );
    const view = renderActions(
      { name: 'Refill bottle', type: ExceptionRuleType.EARLY_COMPLETION_ONLY },
      rule,
    );

    await act(() => view.result.current.handleUpdateRule());

    expect(storedRules()).toEqual([
      expect.objectContaining({
        id: rule.id,
        name: 'Refill bottle',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      }),
    ]);
    expect(view.editing.get()).toBeNull();
  });

  it('restores the original rule when an edit collides with another name', async () => {
    const { rule } = await exceptionRuleManager.createRule(
      'Refill water',
      ExceptionRuleType.PAUSE_ONLY,
    );
    await exceptionRuleManager.createRule(
      'Answer door',
      ExceptionRuleType.PAUSE_ONLY,
    );
    const view = renderActions({ name: 'Answer door' }, rule);

    await act(() => view.result.current.handleUpdateRule());

    expect(view.rules.get()).toEqual([rule]);
    expect(view.formErrors.get()).toHaveLength(1);
    expect(view.editing.get()).toEqual(rule);
    expect(storedRules().find((item) => item.id === rule.id)?.name).toBe(
      'Refill water',
    );
  });

  it('deletes after confirmation and reloads without the rule', async () => {
    const { rule } = await exceptionRuleManager.createRule(
      'Refill water',
      ExceptionRuleType.PAUSE_ONLY,
    );
    const view = renderActions();

    act(() => view.result.current.handleDeleteRule(rule));
    expect(view.result.current.deleteConfirmationRule).toEqual(rule);
    await act(() => view.result.current.confirmDeleteRule());

    expect(storedRules()).toEqual([
      expect.objectContaining({ id: rule.id, isActive: false }),
    ]);
    expect(view.result.current.deleteConfirmationRule).toBeNull();
    expect(view.error.get()).toBeNull();
  });

  it('reports a delete of a rule that no longer exists', async () => {
    const view = renderActions();
    const missing = {
      ...(
        await exceptionRuleManager.createRule(
          'Gone',
          ExceptionRuleType.PAUSE_ONLY,
        )
      ).rule,
      id: 'missing',
    };

    act(() => view.result.current.handleDeleteRule(missing));
    await act(() => view.result.current.confirmDeleteRule());

    expect(view.error.get()).toEqual(expect.any(String));
  });

  it('exports active rules with usage data as dated JSON', async () => {
    await exceptionRuleManager.createRule(
      'Refill water',
      ExceptionRuleType.PAUSE_ONLY,
    );
    const view = renderActions();

    await act(() => view.result.current.handleExportRules());

    expect(saveFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/^exception-rules-\d{4}-\d{2}-\d{2}\.json$/),
    );
    const exported = JSON.parse(saveFile.mock.calls[0][0]);
    expect(exported.rules).toEqual([
      expect.objectContaining({ name: 'Refill water' }),
    ]);
    expect(exported.usageRecords).toEqual([]);
  });

  it('shows an error when saving the export file fails', async () => {
    saveFile.mockRejectedValueOnce(new Error('disk full'));
    const view = renderActions();

    await act(() => view.result.current.handleExportRules());

    expect(view.error.get()).toBe('Failed to export rules');
  });
});

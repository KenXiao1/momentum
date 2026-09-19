import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { exceptionRuleStorage } from '../../../services/ExceptionRuleStorage';
import { ExceptionRuleType } from '../../../types';
import {
  useRuleSelectionRules,
  type RuleActionType,
} from '../useRuleSelectionRules';

const tr = (_zh: string, en: string) => en;

function renderRules(actionType: RuleActionType = 'pause') {
  return renderHook(
    ({ actionType, chainId }) =>
      useRuleSelectionRules({ actionType, chainId, language: 'en', tr }),
    { initialProps: { actionType, chainId: 'chain-1' } },
  );
}

describe('rule selection storage freshness', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('switches action types within one chain without reusing the previous list', async () => {
    const pause = await exceptionRuleStorage.createRule({
      name: 'Break',
      type: ExceptionRuleType.PAUSE_ONLY,
      scope: 'chain',
      chainId: 'chain-1',
    });
    const completion = await exceptionRuleStorage.createRule({
      name: 'Done',
      type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      scope: 'chain',
      chainId: 'chain-1',
    });
    const { result, rerender } = renderRules();
    await act(() => result.current.loadRules());
    expect(result.current.rules.map((rule) => rule.id)).toEqual([pause.id]);
    rerender({ actionType: 'early_completion', chainId: 'chain-1' });
    await act(() => result.current.loadRules());
    expect(result.current.rules.map((rule) => rule.id)).toEqual([
      completion.id,
    ]);
  });

  it('reloads persisted edits and excludes deleted rules', async () => {
    const rule = await exceptionRuleStorage.createRule({
      name: 'Original',
      type: ExceptionRuleType.PAUSE_ONLY,
      scope: 'chain',
      chainId: 'chain-1',
    });
    const survivor = await exceptionRuleStorage.createRule({
      name: 'Survivor',
      type: ExceptionRuleType.PAUSE_ONLY,
      scope: 'chain',
      chainId: 'chain-1',
    });
    const { result } = renderRules();
    await act(() => result.current.loadRules());
    await exceptionRuleStorage.updateRule(rule.id, { name: 'Renamed' });
    await act(() => result.current.loadRules());
    expect(result.current.rules.find((item) => item.id === rule.id)?.name).toBe(
      'Renamed',
    );
    await exceptionRuleStorage.deleteRule(rule.id);
    await act(() => result.current.loadRules());
    expect(result.current.rules.map((item) => item.id)).toEqual([survivor.id]);
  });

  it('adds a created rule while excluding other chains', async () => {
    const rule = await exceptionRuleStorage.createRule({
      name: 'Break',
      type: ExceptionRuleType.PAUSE_ONLY,
      scope: 'chain',
      chainId: 'chain-1',
    });
    const { result } = renderRules();
    await act(() => result.current.loadRules());
    const added = { ...rule, id: 'added', name: 'Added' };
    act(() => result.current.addRule(added));
    act(() =>
      result.current.addRule({ ...added, id: 'other', chainId: 'chain-2' }),
    );
    expect(result.current.rules.map((item) => item.id)).toEqual([
      rule.id,
      added.id,
    ]);
  });
});

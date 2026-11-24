import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTranslator } from '../../../i18n/translate';
import { exceptionRuleManager } from '../../../services/exception-rule-manager/ExceptionRuleManager';
import { ExceptionRuleType } from '../../../types';
import {
  useRuleSelectionRules,
  type RuleActionType,
} from '../useRuleSelectionRules';

const t = createTranslator('en');

function renderRules(actionType: RuleActionType = 'pause') {
  return renderHook(
    ({ actionType, chainId }) =>
      useRuleSelectionRules({ actionType, chainId, language: 'en', t }),
    { initialProps: { actionType, chainId: 'chain-1' } },
  );
}

async function chainRule(name: string, type = ExceptionRuleType.PAUSE_ONLY) {
  return (await exceptionRuleManager.createChainRule('chain-1', name, type))
    .rule;
}

describe('useRuleSelectionRules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists only rules whose type matches the action', async () => {
    const pause = await chainRule('Break');
    const completion = await chainRule(
      'Done',
      ExceptionRuleType.EARLY_COMPLETION_ONLY,
    );
    const { result, rerender } = renderRules();
    await act(() => result.current.loadRules());
    expect(result.current.rules.map((rule) => rule.id)).toEqual([pause.id]);

    rerender({ actionType: 'early_completion', chainId: 'chain-1' });
    await act(() => result.current.loadRules());
    expect(result.current.rules.map((rule) => rule.id)).toEqual([
      completion.id,
    ]);
  });

  it('lists global rules alongside this chain, but not other chains', async () => {
    const own = await chainRule('Break');
    const { rule: global } = await exceptionRuleManager.createRule(
      'Refill water',
      ExceptionRuleType.PAUSE_ONLY,
    );
    await exceptionRuleManager.createChainRule(
      'chain-2',
      'Elsewhere',
      ExceptionRuleType.PAUSE_ONLY,
    );
    const { result } = renderRules();

    await act(() => result.current.loadRules());

    expect(result.current.rules.map((rule) => rule.id)).toEqual([
      own.id,
      global.id,
    ]);
  });

  it('reloads persisted edits and excludes deleted rules', async () => {
    const rule = await chainRule('Original');
    const survivor = await chainRule('Survivor');
    const { result } = renderRules();
    await act(() => result.current.loadRules());

    await exceptionRuleManager.updateRule(rule.id, { name: 'Renamed' });
    await act(() => result.current.loadRules());
    expect(result.current.rules.find((item) => item.id === rule.id)?.name).toBe(
      'Renamed',
    );

    await exceptionRuleManager.deleteRule(rule.id);
    await act(() => result.current.loadRules());
    expect(result.current.rules.map((item) => item.id)).toEqual([survivor.id]);
  });

  it('creates default chain rules once when nothing applies', async () => {
    const { result } = renderRules();

    await act(() => result.current.loadRules());
    await act(() => result.current.loadRules());

    expect(result.current.rules.map((rule) => rule.name)).toEqual([
      'Bathroom break',
      'Phone call',
    ]);
    expect(await exceptionRuleManager.getAllRules()).toHaveLength(2);
  });

  it('adds a created rule only when this chain can use it', async () => {
    const rule = await chainRule('Break');
    const { result } = renderRules();
    await act(() => result.current.loadRules());

    act(() => result.current.addRule({ ...rule, id: 'added' }));
    act(() =>
      result.current.addRule({ ...rule, id: 'other', chainId: 'chain-2' }),
    );
    act(() =>
      result.current.addRule({
        ...rule,
        id: 'global',
        scope: 'global',
        chainId: undefined,
      }),
    );

    expect(result.current.rules.map((item) => item.id)).toEqual([
      rule.id,
      'added',
      'global',
    ]);
  });
});

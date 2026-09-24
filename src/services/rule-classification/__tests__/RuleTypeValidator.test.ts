import { describe, expect, it } from 'vitest';
import { ExceptionRuleType, type ExceptionRule } from '../../../types';
import {
  getActionTypeDisplayName,
  getRuleTypeDisplayName,
  isValidActionType,
  isValidRuleType,
  validateRuleTypeForAction,
  type RuleActionType,
} from '../RuleTypeValidator';

describe('persisted rule type compatibility', () => {
  it('does not permit a legacy rule without a type for either action', () => {
    // Represents legacy storage data at the validation boundary.
    const legacyRule = { id: 'legacy', name: 'Legacy rule' } as ExceptionRule;
    expect(validateRuleTypeForAction(legacyRule, 'pause')).toBe(false);
    expect(validateRuleTypeForAction(legacyRule, 'early_completion')).toBe(
      false,
    );
  });

  it.each(['', 'unknown', 'PAUSE_ONLY', 'early_completion_only '])(
    'rejects the unsupported persisted rule type %j',
    (value) => {
      expect(isValidRuleType(value)).toBe(false);
      expect(getRuleTypeDisplayName(value as ExceptionRuleType)).toBe(
        '未知类型',
      );
    },
  );

  it.each(['', 'unknown', 'Pause', 'early_completion '])(
    'rejects the unsupported action %j',
    (value) => {
      expect(isValidActionType(value)).toBe(false);
      expect(getActionTypeDisplayName(value as RuleActionType)).toBe(
        '未知操作',
      );
    },
  );

  it('recognizes both persisted types and action names without coercion', () => {
    expect(isValidRuleType(ExceptionRuleType.PAUSE_ONLY)).toBe(true);
    expect(isValidRuleType(ExceptionRuleType.EARLY_COMPLETION_ONLY)).toBe(true);
    expect(isValidActionType('pause')).toBe(true);
    expect(isValidActionType('early_completion')).toBe(true);
  });
});

import { createTranslator } from '../../i18n/translate';
import { describe, expect, it } from 'vitest';
import type { GamblingSettings } from '../../domain/userSettings';
import { getBetPlacementValidationError } from './betPlacementRules';

const t = createTranslator('en');
const trZh = createTranslator('zh');

function validate(
  amount: string,
  overrides: Partial<{
    availablePoints: number;
    todayBetAmount: number;
    settings: GamblingSettings | null;
  }> = {},
) {
  return getBetPlacementValidationError({
    amount,
    availablePoints: overrides.availablePoints ?? 100,
    todayBetAmount: overrides.todayBetAmount ?? 0,
    settings: overrides.settings ?? null,
    t,
  });
}

function validateZh(
  amount: string,
  overrides: Partial<{
    availablePoints: number;
    todayBetAmount: number;
    settings: GamblingSettings | null;
  }> = {},
) {
  return getBetPlacementValidationError({
    amount,
    availablePoints: overrides.availablePoints ?? 100,
    todayBetAmount: overrides.todayBetAmount ?? 0,
    settings: overrides.settings ?? null,
    t: trZh,
  });
}

describe('getBetPlacementValidationError', () => {
  it.each([
    ['   ', {}, 'Enter a bet amount'],
    ['not-a-number', {}, 'Enter a valid bet amount'],
    ['Infinity', {}, 'Enter a valid bet amount'],
    ['1.5', {}, 'Bet amount must be an integer'],
    ['0', {}, 'Bet amount must be greater than 0'],
    ['-1', {}, 'Bet amount must be greater than 0'],
    ['51', { availablePoints: 50 }, 'Not enough points. Available: 50'],
    [
      '26',
      {
        availablePoints: 100,
        settings: { gambling_mode_enabled: true, max_single_bet: 25 },
      },
      'Exceeds max single bet: 25',
    ],
    [
      '11',
      {
        availablePoints: 100,
        todayBetAmount: 40,
        settings: { gambling_mode_enabled: true, daily_bet_limit: 50 },
      },
      'Exceeds daily limit: 50 (used today: 40)',
    ],
  ] as const)(
    'rejects amount %s before reaching the storage boundary',
    (amount, overrides, expected) => {
      expect(validate(amount, overrides)).toBe(expected);
    },
  );

  it.each([
    ['1', {}],
    ['50', { availablePoints: 50 }],
    [
      '25',
      {
        settings: { gambling_mode_enabled: true, max_single_bet: 25 },
      },
    ],
    [
      '10',
      {
        todayBetAmount: 40,
        settings: { gambling_mode_enabled: true, daily_bet_limit: 50 },
      },
    ],
  ] as const)('accepts boundary-valid amount %s', (amount, overrides) => {
    expect(validate(amount, overrides)).toBeNull();
  });

  it.each([
    ['   ', {}, '请输入押注金额'],
    ['not-a-number', {}, '请输入有效的押注金额'],
    ['1.5', {}, '押注金额必须是整数'],
    ['0', {}, '押注金额必须大于 0'],
    ['51', { availablePoints: 50 }, '可用积分不足，当前可用：50'],
    [
      '26',
      {
        settings: { gambling_mode_enabled: true, max_single_bet: 25 },
      },
      '超出单次押注限制：25',
    ],
    [
      '11',
      {
        todayBetAmount: 40,
        settings: { gambling_mode_enabled: true, daily_bet_limit: 50 },
      },
      '超出每日押注限制：50（今日已用：40）',
    ],
  ] as const)(
    'preserves the Chinese validation contract for amount %s',
    (amount, overrides, expected) => {
      expect(validateZh(amount, overrides)).toBe(expected);
    },
  );
});

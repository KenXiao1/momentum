import { describe, expect, it } from 'vitest';
import { getSplitTemplates } from '../rsipViewHelpers';

describe('rsipViewHelpers', () => {
  it('returns localized split templates', () => {
    const zhTemplates = getSplitTemplates('zh-CN');
    const enTemplates = getSplitTemplates('en');

    expect(zhTemplates.sleep.goal).toBe('早睡早起');
    expect(enTemplates.sleep.goal).toBe('Sleep early and wake early');
    expect(zhTemplates.exercise.items).toHaveLength(2);
  });
});

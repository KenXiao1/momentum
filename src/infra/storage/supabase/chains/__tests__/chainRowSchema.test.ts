import { describe, expect, it } from 'vitest';
import { chainRowSchema } from '../chainRowSchema';

const validRow = {
  id: 'chain-1',
  name: 'Test Chain',
  parent_id: null,
  type: 'unit',
  sort_order: 1000,
  trigger: 'Wake up',
  duration: 45,
  description: 'A test chain',
  current_streak: 3,
  auxiliary_streak: 1,
  total_completions: 10,
  total_failures: 2,
  auxiliary_failures: 0,
  exceptions: [],
  auxiliary_exceptions: [],
  auxiliary_signal: '',
  auxiliary_duration: 15,
  auxiliary_completion_trigger: '',
  user_id: 'user-1',
};

describe('chainRowSchema', () => {
  it('accepts a valid chain row', () => {
    const result = chainRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
  });

  it('accepts a row with all optional nullable fields', () => {
    const row = {
      ...validRow,
      is_durationless: true,
      minimum_duration: 10,
      is_task_group: false,
      task_repeat_count: 3,
      group_repeat_count: 2,
      time_limit_hours: 4,
      time_limit_exceptions: ['exception-1'],
      group_started_at: '2026-01-01T00:00:00Z',
      group_expires_at: '2026-01-08T00:00:00Z',
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      last_completed_at: '2026-01-02T00:00:00Z',
    };
    expect(chainRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepts a row from a database without the newer JSON columns', () => {
    const {
      exceptions: _exceptions,
      auxiliary_exceptions: _auxiliaryExceptions,
      ...legacyRow
    } = validRow;
    expect(chainRowSchema.safeParse(legacyRow).success).toBe(true);
  });

  it('rejects a row missing a required field', () => {
    const { id: _id, ...withoutId } = validRow;
    expect(chainRowSchema.safeParse(withoutId).success).toBe(false);
  });

  it('rejects a row where a numeric field contains a string', () => {
    const row = { ...validRow, duration: 'not-a-number' };
    expect(chainRowSchema.safeParse(row).success).toBe(false);
  });
});

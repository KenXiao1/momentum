import { describe, expect, it } from 'vitest';
import {
  USER_INTERRUPTED_REASON,
  isUserInterruptedReason,
} from '../failureReason';

describe('isUserInterruptedReason', () => {
  it.each([
    [USER_INTERRUPTED_REASON, true],
    ['用户主动中断', true],
    ['Interrupted by user', true],
    ['User interrupted', true],
    ['Phone rang', false],
    ['', false],
  ])('treats %j as a user interruption: %s', (reason, expected) => {
    expect(isUserInterruptedReason(reason)).toBe(expected);
  });
});

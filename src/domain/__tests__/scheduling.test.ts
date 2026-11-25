import { describe, expect, it } from 'vitest';
import { getEndingSoonWarningSeconds } from '../scheduling';

describe('getEndingSoonWarningSeconds', () => {
  it.each([
    // countdown minutes, warning seconds before the end
    [0, null],
    [1, null],
    [3, null],
    [3.5, 60],
    [4, 60],
    [10, 60],
    [25, 60],
    [90, 60],
  ] as const)('a %s-minute countdown warns at %s', (minutes, expected) => {
    expect(getEndingSoonWarningSeconds(minutes)).toBe(expected);
  });
});

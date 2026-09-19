import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExceptionRuleType, type ExceptionRule } from '../../../types';
import { useRuleSearchResults } from '../useRuleSearchResults';

const rules: ExceptionRule[] = ['Water', 'Walk'].map((name, index) => ({
  id: name,
  name,
  chainId: 'chain',
  scope: 'chain',
  type: ExceptionRuleType.PAUSE_ONLY,
  isActive: true,
  usageCount: index + 1,
  createdAt: new Date('2026-01-01'),
}));

describe('rule search lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps usage order when the query is cleared before debounce fires', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useRuleSearchResults(rules, query),
      { initialProps: { query: 'Water' } },
    );
    rerender({ query: '' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results.map(({ rule }) => rule.name)).toEqual([
      'Walk',
      'Water',
    ]);
    expect(
      result.current.results.every(
        ({ highlightRanges }) => highlightRanges.length === 0,
      ),
    ).toBe(true);
  });

  it('does not restore deleted rules when the list becomes empty', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useRuleSearchResults(items, 'Water'),
      { initialProps: { items: rules } },
    );
    rerender({ items: [] });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results).toEqual([]);
  });

  it('debounces rapid queries and uses renamed rule data and current highlights', () => {
    const { result, rerender } = renderHook(
      ({ items, query }) => useRuleSearchResults(items, query),
      { initialProps: { items: rules, query: 'Water' } },
    );
    rerender({ items: rules, query: 'Wal' });
    act(() => vi.advanceTimersByTime(199));
    expect(result.current.results).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.results[0].rule.name).toBe('Walk');
    expect(result.current.results[0].highlightRanges).toEqual([
      { start: 0, end: 3 },
    ]);
    rerender({ items: [{ ...rules[0], name: 'Walking water' }], query: 'Wal' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.results.map(({ rule }) => rule.name)).toEqual([
      'Walking water',
    ]);
    expect(result.current.results[0].highlightRanges).toEqual([
      { start: 0, end: 3 },
    ]);
  });

  it('cancels pending search work on unmount', () => {
    const { unmount } = renderHook(() => useRuleSearchResults(rules, 'Water'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

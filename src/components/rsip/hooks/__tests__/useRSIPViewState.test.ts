import { createTranslator } from '../../../../i18n/translate';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RSIPMeta, RSIPNode } from '../../../../types';
import { useRSIPViewState } from '../useRSIPViewState';
import { createNode } from './testHelpers';

vi.mock('../../../../i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: createTranslator('en'),
  }),
}));

const NOW = new Date('2026-07-16T10:20:30.000Z');

function renderState(nodes: RSIPNode[], meta: RSIPMeta) {
  return renderHook(() => useRSIPViewState({ nodes, meta }));
}

describe('useRSIPViewState daily creation limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks strict-mode creation from a committed node when metadata drifted', () => {
    const { result } = renderState(
      [createNode({ id: 'committed-today', createdAt: NOW })],
      { allowMultiplePerDay: false },
    );

    expect(result.current.canAddToday).toBe(false);
  });

  it('keeps free mode open even when a node was committed today', () => {
    const { result } = renderState(
      [createNode({ id: 'committed-today', createdAt: NOW })],
      { allowMultiplePerDay: true },
    );

    expect(result.current.canAddToday).toBe(true);
  });

  it('uses the newest persisted fact from metadata or node creation time', () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);

    const oldOnly = renderState([createNode({ createdAt: yesterday })], {
      allowMultiplePerDay: false,
      lastAddedAt: yesterday,
    });
    const freshMeta = renderState([], {
      allowMultiplePerDay: false,
      lastAddedAt: NOW,
    });

    expect(oldOnly.result.current.canAddToday).toBe(true);
    expect(freshMeta.result.current.canAddToday).toBe(false);
  });
});

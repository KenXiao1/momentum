import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TaskLifecycleEvent } from '../../../types';
import { logger } from '../../../utils/logger';
import { useTaskLifecycleIntegration } from '../useTaskLifecycleIntegration';

const event: TaskLifecycleEvent = {
  type: 'task_completed',
  chainId: 'chain-1',
  chainKind: 'unit',
  occurredAt: new Date('2026-07-11T10:00:00.000Z'),
};

describe('useTaskLifecycleIntegration', () => {
  it('adapts events asynchronously so integration does not block completion', async () => {
    let finish: () => void = () => undefined;
    const handler = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useTaskLifecycleIntegration(handler));

    expect(result.current(event)).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(handler).toHaveBeenCalledWith({
      event: event.type,
      chainId: event.chainId,
      chainKind: event.chainKind,
      occurredAt: event.occurredAt,
    });
    await act(async () => {
      finish();
    });
  });

  it('uses the mounted handler for delayed session events and stops dispatch after unmount', async () => {
    const previousHandler = vi.fn();
    const currentHandler = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ handler }) => useTaskLifecycleIntegration(handler),
      { initialProps: { handler: previousHandler } },
    );
    const delayedSessionCallback = result.current;
    rerender({ handler: currentHandler });
    await act(async () => {
      delayedSessionCallback(event);
    });
    expect(previousHandler).not.toHaveBeenCalled();
    expect(currentHandler).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      delayedSessionCallback(event);
    });
    expect(currentHandler).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'])(
    'isolates integration errors (%s)',
    async (failure) => {
      const error = new Error('RSIP persistence unavailable');
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const handler = () => {
        if (failure === 'throw') throw error;
        return Promise.reject(error);
      };
      const { result } = renderHook(() => useTaskLifecycleIntegration(handler));
      await act(async () => {
        result.current(event);
      });
      expect(warn).toHaveBeenCalledWith(
        'TASK_LIFECYCLE',
        'Task lifecycle integration failed',
        event,
        error,
      );
      warn.mockRestore();
    },
  );
});

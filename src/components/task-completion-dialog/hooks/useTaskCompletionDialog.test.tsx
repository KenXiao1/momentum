import { createLocalStorageMock } from '../../../test/factories';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import { StorageContext } from '../../../storage/storageContextValue';
import type { CompletionHistory } from '../../../types';
import { logger } from '../../../utils/logger';
import { useTaskCompletionDialog } from './useTaskCompletionDialog';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function history(
  description: string | undefined,
  completedAt: string,
  overrides: Partial<CompletionHistory> = {},
): CompletionHistory {
  return {
    chainId: 'chain-a',
    completedAt: new Date(completedAt),
    duration: 25,
    wasSuccessful: true,
    description,
    ...overrides,
  };
}

function createStorage(entries: CompletionHistory[] = []) {
  return createLocalStorageMock({
    getCompletionHistory: vi.fn(async () => entries),
  });
}

function storageWrapper(storage: ReturnType<typeof createStorage>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageContext.Provider value={storage}>
        {children}
      </StorageContext.Provider>
    );
  };
}

function keyEvent(
  key: string,
  modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {},
) {
  const preventDefault = vi.fn();
  const event = {
    key,
    ctrlKey: false,
    shiftKey: false,
    preventDefault,
    ...modifiers,
  } as unknown as ReactKeyboardEvent;
  return { event, preventDefault };
}

function renderDialogHook(
  storage: ReturnType<typeof createStorage>,
  overrides: Partial<{
    isOpen: boolean;
    chainId: string;
    isDurationless: boolean;
    onComplete: (
      description: string,
      notes?: string,
    ) => void | Promise<void | boolean>;
    onCancel: () => void;
  }> = {},
) {
  const params = {
    isOpen: true,
    chainId: 'chain-a',
    isDurationless: true,
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return {
    params,
    ...renderHook(() => useTaskCompletionDialog(params), {
      wrapper: storageWrapper(storage),
    }),
  };
}

describe('useTaskCompletionDialog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the five newest distinct successful descriptions for the open chain', async () => {
    const storage = createStorage([
      history('newest', '2026-07-10T00:00:00.000Z'),
      history('newest', '2026-07-09T00:00:00.000Z'),
      history('second', '2026-07-08T00:00:00.000Z'),
      history('third', '2026-07-07T00:00:00.000Z'),
      history('fourth', '2026-07-06T00:00:00.000Z'),
      history('fifth', '2026-07-05T00:00:00.000Z'),
      history('sixth', '2026-07-04T00:00:00.000Z'),
      history('failed', '2026-07-11T00:00:00.000Z', {
        wasSuccessful: false,
      }),
      history(undefined, '2026-07-12T00:00:00.000Z'),
      history('other chain', '2026-07-13T00:00:00.000Z', {
        chainId: 'chain-b',
      }),
    ]);

    const { result } = renderDialogHook(storage);

    await waitFor(() => {
      expect(result.current.recentDescriptions).toEqual([
        'newest',
        'second',
        'third',
        'fourth',
        'fifth',
      ]);
    });
    expect(storage.getCompletionHistory).toHaveBeenCalledTimes(1);
  });

  it('does not load while closed and never exposes suggestions from another chain', async () => {
    const nextHistory = deferred<CompletionHistory[]>();
    const storage = createStorage();
    vi.mocked(storage.getCompletionHistory)
      .mockResolvedValueOnce([
        history('chain A task', '2026-07-10T00:00:00.000Z'),
      ])
      .mockReturnValueOnce(nextHistory.promise);
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const { result, rerender } = renderHook(
      ({ isOpen, chainId }) =>
        useTaskCompletionDialog({
          isOpen,
          chainId,
          isDurationless: true,
          onComplete,
          onCancel,
        }),
      {
        initialProps: { isOpen: false, chainId: 'chain-a' },
        wrapper: storageWrapper(storage),
      },
    );

    expect(storage.getCompletionHistory).not.toHaveBeenCalled();

    rerender({ isOpen: true, chainId: 'chain-a' });
    await waitFor(() => {
      expect(result.current.recentDescriptions).toEqual(['chain A task']);
    });

    rerender({ isOpen: true, chainId: 'chain-b' });
    expect(result.current.recentDescriptions).toEqual([]);

    await act(async () => {
      nextHistory.resolve([
        history('chain B task', '2026-07-11T00:00:00.000Z', {
          chainId: 'chain-b',
        }),
      ]);
      await nextHistory.promise;
    });

    expect(result.current.recentDescriptions).toEqual(['chain B task']);
    expect(storage.getCompletionHistory).toHaveBeenCalledTimes(2);
  });

  it('blocks a blank durationless completion, then sanitizes and resets a valid submission', async () => {
    const onComplete = vi.fn();
    const storage = createStorage();
    const { result } = renderDialogHook(storage, { onComplete });

    act(() => {
      result.current.setDescription('   ');
      result.current.setNotes('not submitted');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.description).toBe('   ');
    expect(result.current.notes).toBe('not submitted');

    act(() => {
      result.current.setDescription('  <done/"\'>  ');
      result.current.setNotes("  note/' <>  ");
      result.current.setIsNotesVisible(true);
      result.current.setShowQuickFill(true);
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      '&lt;done&#x2F;&quot;&#x27;&gt;',
      'note&#x2F;&#x27; &lt;&gt;',
    );
    expect(result.current.description).toBe('');
    expect(result.current.notes).toBe('');
    expect(result.current.isNotesVisible).toBe(false);
    expect(result.current.showQuickFill).toBe(false);
  });

  it('allows a timed completion without a description', async () => {
    const onComplete = vi.fn();
    const { result } = renderDialogHook(createStorage(), {
      isDurationless: false,
      onComplete,
    });
    const enter = keyEvent('Enter');

    await act(async () => {
      result.current.handleDescriptionKeyDown(enter.event);
    });

    expect(enter.preventDefault).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('', undefined);
  });

  it('supports quick fill, keyboard navigation, focus, and Ctrl+Enter submission', async () => {
    const onComplete = vi.fn();
    const storage = createStorage([
      history('recent task', '2026-07-10T00:00:00.000Z'),
    ]);
    const { result } = renderDialogHook(storage, { onComplete });
    await waitFor(() => {
      expect(result.current.recentDescriptions).toEqual(['recent task']);
    });

    act(() => result.current.toggleQuickFill());
    expect(result.current.showQuickFill).toBe(true);
    act(() => result.current.toggleQuickFill());
    expect(result.current.showQuickFill).toBe(false);

    const firstTab = keyEvent('Tab');
    act(() => result.current.handleDescriptionKeyDown(firstTab.event));
    expect(firstTab.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.description).toBe('recent task');

    const shiftTab = keyEvent('Tab', { shiftKey: true });
    act(() => result.current.handleDescriptionKeyDown(shiftTab.event));
    expect(shiftTab.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.showQuickFill).toBe(true);

    const descriptionInput = document.createElement('input');
    const notesTextarea = document.createElement('textarea');
    document.body.append(descriptionInput, notesTextarea);
    Object.assign(result.current.descriptionInputRef, {
      current: descriptionInput,
    });
    Object.assign(result.current.notesTextareaRef, { current: notesTextarea });

    act(() => result.current.handleQuickFill('chosen task'));
    expect(result.current.description).toBe('chosen task');
    expect(result.current.showQuickFill).toBe(false);
    expect(document.activeElement).toBe(descriptionInput);

    vi.useFakeTimers();
    const secondTab = keyEvent('Tab');
    act(() => result.current.handleDescriptionKeyDown(secondTab.event));
    expect(result.current.isNotesVisible).toBe(true);
    expect(document.activeElement).toBe(descriptionInput);

    act(() => vi.advanceTimersByTime(100));
    expect(document.activeElement).toBe(notesTextarea);

    act(() => result.current.setNotes('keyboard note'));
    const ctrlEnter = keyEvent('Enter', { ctrlKey: true });
    await act(async () => {
      result.current.handleNotesKeyDown(ctrlEnter.event);
    });

    expect(ctrlEnter.preventDefault).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('chosen task', 'keyboard note');
    descriptionInput.remove();
    notesTextarea.remove();
  });

  it('resets state and calls the cancel boundary exactly once', () => {
    const onCancel = vi.fn();
    const { result } = renderDialogHook(createStorage(), { onCancel });

    act(() => {
      result.current.setDescription('draft');
      result.current.setNotes('draft note');
      result.current.setIsNotesVisible(true);
      result.current.setShowQuickFill(true);
    });
    act(() => result.current.handleCancel());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.current.description).toBe('');
    expect(result.current.notes).toBe('');
    expect(result.current.isNotesVisible).toBe(false);
    expect(result.current.showQuickFill).toBe(false);
  });

  it('logs a history failure and retries when the dialog is reopened', async () => {
    const priorLogCount = logger.getLogs(undefined, 'TASK_COMPLETION').length;
    const storage = createStorage();
    vi.mocked(storage.getCompletionHistory)
      .mockRejectedValueOnce(new Error('history unavailable'))
      .mockResolvedValueOnce([
        history('loaded on retry', '2026-07-10T00:00:00.000Z'),
      ]);
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useTaskCompletionDialog({
          isOpen,
          chainId: 'chain-a',
          isDurationless: true,
          onComplete,
          onCancel,
        }),
      {
        initialProps: { isOpen: true },
        wrapper: storageWrapper(storage),
      },
    );

    await waitFor(() => {
      expect(
        logger.getLogs(undefined, 'TASK_COMPLETION').slice(priorLogCount),
      ).toEqual([
        expect.objectContaining({
          message: 'Failed to load recent descriptions',
          context: { chainId: 'chain-a' },
          error: expect.objectContaining({ message: 'history unavailable' }),
        }),
      ]);
    });

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    await waitFor(() => {
      expect(result.current.recentDescriptions).toEqual(['loaded on retry']);
    });
    expect(storage.getCompletionHistory).toHaveBeenCalledTimes(2);
  });

  it('ignores an obsolete history request completed after close', async () => {
    const firstRequest = deferred<CompletionHistory[]>();
    const secondRequest = deferred<CompletionHistory[]>();
    const storage = createStorage();
    vi.mocked(storage.getCompletionHistory)
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useTaskCompletionDialog({
          isOpen,
          chainId: 'chain-a',
          isDurationless: true,
          onComplete,
          onCancel,
        }),
      {
        initialProps: { isOpen: true },
        wrapper: storageWrapper(storage),
      },
    );

    rerender({ isOpen: false });
    await act(async () => {
      firstRequest.resolve([
        history('obsolete task', '2026-07-10T00:00:00.000Z'),
      ]);
      await firstRequest.promise;
    });

    rerender({ isOpen: true });
    expect(result.current.recentDescriptions).toEqual([]);

    await act(async () => {
      secondRequest.resolve([
        history('current task', '2026-07-11T00:00:00.000Z'),
      ]);
      await secondRequest.promise;
    });

    expect(result.current.recentDescriptions).toEqual(['current task']);
  });
  it('retains the completion draft after a rejected save and clears only after a committed retry', async () => {
    const onComplete = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { result } = renderDialogHook(createStorage(), { onComplete });
    act(() => {
      result.current.setDescription('Keep my completed work');
      result.current.setNotes('Recovery note');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.description).toBe('Keep my completed work');
    expect(result.current.notes).toBe('Recovery note');
    expect(result.current.isSubmitting).toBe(false);
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(result.current.description).toBe('');
    expect(result.current.notes).toBe('');
  });
});

import { createTranslator } from '../../../i18n/translate';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeletedChain } from '../../../types';
import { useRecycleBinModal } from './useRecycleBinModal';

const useStorageMock = vi.hoisted(() => vi.fn());
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
const i18nMock = vi.hoisted(() => ({
  language: 'en' as const,
  t: vi.fn(),
}));

vi.mock('../../../storage/useStorage', () => ({
  useStorage: useStorageMock,
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => i18nMock,
}));

vi.mock('../../../utils/toast', () => ({
  toast: toastMocks,
}));

vi.mock('../../../utils/logger', () => ({
  logger: loggerMocks,
}));

function deletedChain(
  id: string,
  name: string,
  deletedAt = new Date('2026-07-10T08:00:00.000Z'),
): DeletedChain {
  return {
    id,
    type: 'unit',
    sortOrder: 1,
    name,
    trigger: 'Start',
    duration: 25,
    description: `${name} description`,
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: 'Alarm',
    auxiliaryDuration: 5,
    auxiliaryCompletionTrigger: 'Alarm rings',
    timeLimitExceptions: [],
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    deletedAt,
  };
}

interface HarnessOptions {
  isOpen?: boolean;
  onRestore?: (chainIds: string[]) => void | Promise<void>;
  onPermanentDelete?: (chainIds: string[]) => void | Promise<void>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderRecycleBinHook({
  isOpen = true,
  onRestore = vi.fn(),
  onPermanentDelete = vi.fn(),
}: HarnessOptions = {}) {
  return renderHook(
    ({ open }) =>
      useRecycleBinModal({
        isOpen: open,
        onClose: vi.fn(),
        onRestore,
        onPermanentDelete,
      }),
    { initialProps: { open: isOpen } },
  );
}

describe('useRecycleBinModal', () => {
  const chains = [
    deletedChain('chain-1', 'First chain'),
    deletedChain('chain-2', 'Second chain'),
  ];
  let getDeletedChains: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    i18nMock.t.mockImplementation(createTranslator('en'));
    vi.clearAllMocks();
    getDeletedChains = vi.fn().mockResolvedValue(chains);
    useStorageMock.mockReturnValue({ getDeletedChains });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads only when opened and replaces stale selection with fresh data', async () => {
    const { result, rerender } = renderRecycleBinHook({ isOpen: false });

    expect(getDeletedChains).not.toHaveBeenCalled();
    expect(result.current.deletedChains).toEqual([]);

    rerender({ open: true });
    await waitFor(() => expect(result.current.deletedChains).toEqual(chains));

    expect(getDeletedChains).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect([...result.current.selectedChains]).toEqual([]);
  });

  it('reports a load failure without committing partial state', async () => {
    getDeletedChains.mockRejectedValue(new Error('storage unavailable'));
    const { result } = renderRecycleBinHook();

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        'Failed to load recycle bin. Please try again.',
      ),
    );

    expect(result.current.deletedChains).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores an older load when close and reopen starts a newer request', async () => {
    const firstLoad = deferred<DeletedChain[]>();
    const secondLoad = deferred<DeletedChain[]>();
    const freshChains = [chains[1]];
    getDeletedChains
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    const { result, rerender } = renderRecycleBinHook();
    await waitFor(() => expect(getDeletedChains).toHaveBeenCalledTimes(1));
    expect(result.current.isLoading).toBe(true);

    rerender({ open: false });
    expect(result.current.isLoading).toBe(false);
    rerender({ open: true });
    await waitFor(() => expect(getDeletedChains).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondLoad.resolve(freshChains);
      await secondLoad.promise;
    });
    expect(result.current.deletedChains).toEqual(freshChains);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      firstLoad.resolve(chains);
      await firstLoad.promise;
    });
    expect(result.current.deletedChains).toEqual(freshChains);
    expect(result.current.isLoading).toBe(false);
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it('selects individual chains and toggles select-all from observable state', async () => {
    const { result } = renderRecycleBinHook();
    await waitFor(() => expect(result.current.deletedChains).toEqual(chains));

    act(() => result.current.handleSelectChain('chain-1', true));
    expect([...result.current.selectedChains]).toEqual(['chain-1']);

    act(() => result.current.handleSelectChain('chain-1', false));
    expect([...result.current.selectedChains]).toEqual([]);

    act(() => result.current.handleSelectAll());
    expect([...result.current.selectedChains]).toEqual(['chain-1', 'chain-2']);

    act(() => result.current.handleSelectAll());
    expect([...result.current.selectedChains]).toEqual([]);
  });

  it('builds single and bulk confirmation state from loaded chains', async () => {
    const { result } = renderRecycleBinHook();
    await waitFor(() => expect(result.current.deletedChains).toEqual(chains));

    act(() => result.current.handleSingleRestore('missing-chain'));
    expect(result.current.showConfirmDialog).toBeNull();

    act(() => result.current.handleSingleRestore('chain-1'));
    expect(result.current.showConfirmDialog).toEqual({
      type: 'restore',
      chainIds: ['chain-1'],
      chainNames: ['First chain'],
    });

    act(() => result.current.handleCancelConfirm());
    act(() => result.current.handleBulkRestore());
    expect(result.current.showConfirmDialog).toBeNull();

    act(() => result.current.handleSelectChain('chain-1', true));
    act(() => result.current.handleBulkRestore());
    expect(result.current.showConfirmDialog).toEqual({
      type: 'restore',
      chainIds: ['chain-1'],
      chainNames: ['First chain'],
    });

    act(() => result.current.handleCancelConfirm());
    act(() => {
      result.current.handleSelectChain('chain-1', false);
      result.current.handleSelectChain('chain-2', true);
      result.current.handleSelectChain('chain-1', true);
    });
    act(() => result.current.handleBulkPermanentDelete());

    expect(result.current.showConfirmDialog).toEqual({
      type: 'delete',
      chainIds: ['chain-2', 'chain-1'],
      chainNames: ['Second chain', 'First chain'],
    });
  });

  it('formats deleted timestamps through the real time-formatting rules', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const { result } = renderRecycleBinHook({ isOpen: false });

    expect(
      result.current.formatDeletedTime(new Date('2026-07-12T12:00:00.000Z')),
    ).toBe('2 days ago');
    expect(
      result.current.formatDeletedTime(new Date('2026-07-14T10:00:00.000Z')),
    ).toBe('2 hours ago');
    expect(
      result.current.formatDeletedTime(new Date('2026-07-14T11:59:45.000Z')),
    ).toBe('just now');
  });

  it('restores the confirmed chains, refreshes data, and clears transient state', async () => {
    const onRestore = vi.fn(async () => undefined);
    getDeletedChains
      .mockResolvedValueOnce(chains)
      .mockResolvedValueOnce([chains[1]]);
    const { result } = renderRecycleBinHook({ onRestore });
    await waitFor(() => expect(result.current.deletedChains).toEqual(chains));

    act(() => result.current.handleSingleRestore('chain-1'));
    await act(async () => {
      await result.current.handleConfirmAction();
    });

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(['chain-1']);
    expect(getDeletedChains).toHaveBeenCalledTimes(2);
    expect(result.current.deletedChains).toEqual([chains[1]]);
    expect(result.current.showConfirmDialog).toBeNull();
    expect([...result.current.selectedChains]).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(toastMocks.success).toHaveBeenCalledWith(
      expect.stringContaining('Restored 1 chain(s)'),
    );
  });

  it('runs a confirm operation only once while the first call is pending', async () => {
    const pendingRestore = deferred<void>();
    const onRestore = vi.fn(() => pendingRestore.promise);
    const { result } = renderRecycleBinHook({ onRestore });
    await waitFor(() => expect(result.current.deletedChains).toEqual(chains));
    act(() => result.current.handleSingleRestore('chain-1'));

    let firstConfirmation!: Promise<void>;
    act(() => {
      firstConfirmation = result.current.handleConfirmAction();
      void result.current.handleConfirmAction();
    });
    expect(onRestore).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingRestore.resolve();
      await firstConfirmation;
    });

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(getDeletedChains).toHaveBeenCalledTimes(2);
    expect(toastMocks.success).toHaveBeenCalledTimes(1);
    expect(result.current.showConfirmDialog).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces a permanent-delete failure while still reconciling local data', async () => {
    const onPermanentDelete = vi.fn(async () => {
      throw new Error('database unavailable');
    });
    const { result } = renderRecycleBinHook({ onPermanentDelete });
    await waitFor(() => expect(result.current.deletedChains).toEqual(chains));

    act(() => result.current.handleSinglePermanentDelete('chain-2'));
    await act(async () => {
      await result.current.handleConfirmAction();
    });

    expect(onPermanentDelete).toHaveBeenCalledWith(['chain-2']);
    expect(getDeletedChains).toHaveBeenCalledTimes(2);
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('database unavailable'),
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(result.current.showConfirmDialog).toBeNull();
    expect([...result.current.selectedChains]).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

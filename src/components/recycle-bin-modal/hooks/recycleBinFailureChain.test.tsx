import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardController } from '../../dashboard/useDashboardController';
import { useRecycleBinDomain } from '../../../hooks/domains/useRecycleBinDomain';
import { StorageContext } from '../../../storage/storageContextValue';
import { StorageModeContext } from '../../../storage/storageModeContextValue';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import type { DeletedChain } from '../../../types';
import {
  createAppState,
  createLocalStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { useRecycleBinModal } from './useRecycleBinModal';

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));
const i18nMock = vi.hoisted(() => ({
  language: 'en' as const,
  t: (key: string) => key,
  tr: (_zh: string, en: string) => en,
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

const deletedChain: DeletedChain = {
  ...createUnitChain({ id: 'deleted-chain', name: 'Deleted chain' }),
  deletedAt: new Date('2026-07-13T08:00:00.000Z'),
};
const secondDeletedChain: DeletedChain = {
  ...createUnitChain({ id: 'second-deleted-chain', name: 'Second deleted' }),
  deletedAt: new Date('2026-07-13T09:00:00.000Z'),
};

function createWrapper(storage: MomentumStorage) {
  const storageMode = {
    mode: storage.kind,
    canUseSupabase: false,
    isChoicePending: false,
    setMode: vi.fn(),
    dismissFirstLaunchHint: vi.fn(),
  } as const;

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <StorageModeContext.Provider value={storageMode}>
        <StorageContext.Provider value={storage}>
          {children}
        </StorageContext.Provider>
      </StorageModeContext.Provider>
    );
  };
}

function useFailureChain(storage: MomentumStorage) {
  const [state, setState] = useState(() =>
    createAppState({ chains: [deletedChain] }),
  );
  const domain = useRecycleBinDomain({ state, setState, storage });
  const dashboard = useDashboardController({
    chains: state.chains,
    scheduledSessions: state.scheduledSessions,
    onCreateChain: vi.fn(),
    onStartChain: vi.fn(),
    onScheduleChain: vi.fn(),
    onViewChainDetail: vi.fn(),
    onDeleteChain: vi.fn(),
    onImportChains: vi.fn(async () => undefined),
    onRestoreChains: domain.handleRestoreChains,
    onPermanentDeleteChains: domain.handlePermanentDeleteChains,
  });
  const modal = useRecycleBinModal({
    isOpen: true,
    onClose: vi.fn(),
    onRestore: dashboard.handleRestore,
    onPermanentDelete: dashboard.handlePermanentDelete,
  });

  return { modal };
}

describe('recycle-bin failure chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps a real restore storage failure from becoming modal success', async () => {
    const storageFailure = new Error('restore storage unavailable');
    const storage = createLocalStorageMock({
      getDeletedChains: vi.fn(async () => [deletedChain]),
      getActiveChains: vi.fn(async () => []),
      restoreChain: vi.fn(async () => {
        throw storageFailure;
      }),
    });
    const { result } = renderHook(() => useFailureChain(storage), {
      wrapper: createWrapper(storage),
    });
    await waitFor(() =>
      expect(result.current.modal.deletedChains).toEqual([deletedChain]),
    );

    act(() => result.current.modal.handleSingleRestore(deletedChain.id));
    await act(async () => {
      await result.current.modal.handleConfirmAction();
    });

    expect(storage.restoreChain).toHaveBeenCalledWith(deletedChain.id);
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('restore storage unavailable'),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(loggerMocks.info).not.toHaveBeenCalledWith(
      'DASHBOARD',
      'Restored chains and updated stats',
      expect.anything(),
    );
    expect(result.current.modal.deletedChains).toEqual([deletedChain]);
    expect(result.current.modal.showConfirmDialog).toBeNull();
  });

  it('reports a real partial restore once instead of claiming full success', async () => {
    const storage = createLocalStorageMock({
      getDeletedChains: vi.fn(async () => [deletedChain, secondDeletedChain]),
      getActiveChains: vi.fn(async () => [
        createUnitChain({ id: deletedChain.id }),
      ]),
      restoreChain: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('second restore unavailable')),
    });
    const { result } = renderHook(() => useFailureChain(storage), {
      wrapper: createWrapper(storage),
    });
    await waitFor(() =>
      expect(result.current.modal.deletedChains).toEqual([
        deletedChain,
        secondDeletedChain,
      ]),
    );

    act(() => result.current.modal.handleSelectAll());
    act(() => result.current.modal.handleBulkRestore());
    await act(async () => {
      await result.current.modal.handleConfirmAction();
    });

    expect(storage.restoreChain).toHaveBeenNthCalledWith(1, deletedChain.id);
    expect(storage.restoreChain).toHaveBeenNthCalledWith(
      2,
      secondDeletedChain.id,
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(toastMocks.warning).toHaveBeenCalledWith(
      expect.stringContaining('Some chains may not have been restored'),
    );
    expect(toastMocks.warning).toHaveBeenCalledTimes(1);
    expect(loggerMocks.info).not.toHaveBeenCalledWith(
      'DASHBOARD',
      'Restored chains and updated stats',
      expect.anything(),
    );
  });

  it('keeps a real permanent-delete storage failure from becoming modal success', async () => {
    const storageFailure = new Error('permanent delete storage unavailable');
    const storage = createLocalStorageMock({
      getDeletedChains: vi.fn(async () => [deletedChain]),
      permanentlyDeleteChain: vi.fn(async () => {
        throw storageFailure;
      }),
    });
    const { result } = renderHook(() => useFailureChain(storage), {
      wrapper: createWrapper(storage),
    });
    await waitFor(() =>
      expect(result.current.modal.deletedChains).toEqual([deletedChain]),
    );

    act(() =>
      result.current.modal.handleSinglePermanentDelete(deletedChain.id),
    );
    await act(async () => {
      await result.current.modal.handleConfirmAction();
    });

    expect(storage.permanentlyDeleteChain).toHaveBeenCalledWith(
      deletedChain.id,
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      expect.stringContaining('permanent delete storage unavailable'),
    );
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(loggerMocks.info).not.toHaveBeenCalledWith(
      'DASHBOARD',
      'Permanently deleted chains and updated stats',
      expect.anything(),
    );
    expect(result.current.modal.deletedChains).toEqual([deletedChain]);
    expect(result.current.modal.showConfirmDialog).toBeNull();
  });
});

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useImportExportDomain } from '../useImportExportDomain';
import {
  createAppState,
  createLocalStorageMock,
  createSupabaseStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { ok, err } from '../../../domain/result';
import type { AppState } from '../../../types';
import { createNewPet } from '../../../utils/petLogic';

vi.mock('../../../i18n', () => ({
  useI18n: () => ({ tr: (_zh: string, en: string) => en }),
}));

function setup(storage = createLocalStorageMock()) {
  let state = createAppState();
  const setState = (update: React.SetStateAction<AppState>) => {
    state = typeof update === 'function' ? update(state) : update;
  };
  const safelySaveChains = vi.fn(async () => undefined);
  const onPetImported = vi.fn(async () => undefined);
  const hook = renderHook(() =>
    useImportExportDomain({
      storage,
      setState,
      safelySaveChains,
      onPetImported,
    }),
  );
  return {
    ...hook,
    storage,
    safelySaveChains,
    onPetImported,
    getState: () => state,
  };
}

describe('transactional import orchestration', () => {
  it('commits the entire import once and reloads persisted slices including history', async () => {
    const chain = createUnitChain();
    const history = [
      {
        chainId: chain.id,
        completedAt: new Date(),
        duration: 10,
        wasSuccessful: true,
      },
    ];
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [chain]),
      getCompletionHistory: vi.fn(async () => history),
      getRSIPMeta: vi.fn(async () => ({ currentRunNumber: 2 })),
    });
    const context = setup(storage);
    await act(async () =>
      context.result.current.handleImportChains([chain], {
        history,
        rsipMeta: { currentRunNumber: 2 },
      }),
    );
    expect(storage.importData).toHaveBeenCalledExactlyOnceWith({
      chains: [chain],
      history,
      rsipMeta: { currentRunNumber: 2 },
    });
    expect(context.safelySaveChains).not.toHaveBeenCalled();
    expect(storage.saveCompletionHistory).not.toHaveBeenCalled();
    expect(context.onPetImported).not.toHaveBeenCalled();
    expect(context.getState()).toMatchObject({
      chains: [chain],
      completionHistory: history,
      rsipMeta: { currentRunNumber: 2 },
    });
  });

  it('keeps import data available to retry after a failed commit', async () => {
    const chain = createUnitChain();
    const failure = new Error('network interrupted');
    const storage = createLocalStorageMock({
      importData: vi
        .fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined),
    });
    const context = setup(storage);
    await expect(
      context.result.current.handleImportChains([chain]),
    ).rejects.toBe(failure);
    expect(context.getState().chains).toEqual([]);
    expect(storage.getCompletionHistory).toHaveBeenCalled();
    await context.result.current.handleImportChains([chain]);
    expect(storage.importData).toHaveBeenNthCalledWith(1, { chains: [chain] });
    expect(storage.importData).toHaveBeenNthCalledWith(2, { chains: [chain] });
  });

  it('does not hide the original commit error when reload also fails', async () => {
    const failure = new Error('commit failed');
    const storage = createLocalStorageMock({
      importData: vi.fn().mockRejectedValue(failure),
      getChains: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const context = setup(storage);
    await expect(
      context.result.current.handleImportChains([createUnitChain()]),
    ).rejects.toBe(failure);
  });

  it('rejects an empty payload without committing', async () => {
    const context = setup();
    await expect(context.result.current.handleImportChains([])).rejects.toThrow(
      'No valid chains',
    );
    expect(context.storage.importData).not.toHaveBeenCalled();
  });

  it('does not treat empty optional collections or account metadata as importable data', async () => {
    const context = setup();
    await expect(
      context.result.current.handleImportChains([], {
        expectedUserId: 'account',
        history: [],
        rsipNodes: [],
        rsipMeta: undefined,
      }),
    ).rejects.toThrow('No valid chains');
    expect(context.storage.importData).not.toHaveBeenCalled();
  });

  it('accepts metadata alongside empty optional collections', async () => {
    const context = setup();
    const options = {
      rsipMeta: { currentRunNumber: 2 },
      history: [],
      petState: undefined,
    };
    await context.result.current.handleImportChains([], options);
    expect(context.storage.importData).toHaveBeenCalledExactlyOnceWith({
      chains: [],
      ...options,
    });
    expect(context.onPetImported).not.toHaveBeenCalled();
  });

  it('turns an unstructured storage failure into a visible error while reloading persisted data', async () => {
    const context = setup(
      createLocalStorageMock({ importData: vi.fn().mockRejectedValue(null) }),
    );
    await expect(
      context.result.current.handleImportChains([createUnitChain()]),
    ).rejects.toThrow('Unknown error');
    expect(context.storage.getCompletionHistory).toHaveBeenCalledOnce();
  });

  it.each([
    ok({ isAuthenticated: false, user: { id: 'a' } }),
    ok({ isAuthenticated: true, user: null }),
    err({
      code: 'STORAGE' as const,
      message: 'authentication service unavailable',
    }),
  ])(
    'rejects incomplete or failed authentication results',
    async (authResult) => {
      const context = setup(
        createSupabaseStorageMock({
          isUserAuthenticated: vi.fn(async () => ok(false)),
          waitForAuthentication: vi.fn(async () => authResult),
        }),
      );
      await expect(
        context.result.current.handleImportChains([createUnitChain()]),
      ).rejects.toThrow('Authentication failed');
      expect(context.storage.importData).not.toHaveBeenCalled();
    },
  );

  it('accepts a history-only import', async () => {
    const context = setup();
    const history = [
      {
        chainId: 'existing',
        completedAt: new Date(),
        duration: 1,
        wasSuccessful: false,
      },
    ];
    await context.result.current.handleImportChains([], { history });
    expect(context.storage.importData).toHaveBeenCalledExactlyOnceWith({
      chains: [],
      history,
    });
  });

  it('supports a pet-only import without requiring a UI observer', async () => {
    const storage = createLocalStorageMock();
    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: vi.fn(),
      }),
    );
    const petState = createNewPet('Restored pet');
    await expect(
      result.current.handleImportChains([], { petState }),
    ).resolves.toBeUndefined();
    expect(storage.importData).toHaveBeenCalledExactlyOnceWith({
      chains: [],
      petState,
    });
  });

  it('rejects cloud import until authentication is ready', async () => {
    const storage = createSupabaseStorageMock();
    const context = setup(storage);
    await expect(
      context.result.current.handleImportChains([createUnitChain()]),
    ).rejects.toThrow('Authentication failed');
    expect(storage.waitForAuthentication).toHaveBeenCalledWith(10000);
    expect(storage.importData).not.toHaveBeenCalled();
  });

  it('uses an already authenticated account without waiting', async () => {
    const storage = createSupabaseStorageMock({
      isUserAuthenticated: vi.fn(async () => ok(true)),
    });
    const context = setup(storage);
    await context.result.current.handleImportChains([createUnitChain()]);
    expect(storage.waitForAuthentication).not.toHaveBeenCalled();
    expect(storage.importData).toHaveBeenCalledTimes(1);
  });

  it('waits after an auth error and imports only after the user is confirmed', async () => {
    const storage = createSupabaseStorageMock({
      isUserAuthenticated: vi.fn(async () =>
        err({ code: 'STORAGE' as const, message: 'wait' }),
      ),
      waitForAuthentication: vi.fn(async () =>
        ok({ isAuthenticated: true, user: { id: 'a' } }),
      ),
    });
    const context = setup(storage);
    await context.result.current.handleImportChains([createUnitChain()]);
    expect(storage.waitForAuthentication).toHaveBeenCalledWith(10000);
    expect(storage.importData).toHaveBeenCalledTimes(1);
  });
});

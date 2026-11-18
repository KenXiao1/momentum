import { describe, expect, it, vi } from 'vitest';
import type { MomentumStorage } from '../../storage/MomentumStorage';

function createStorageMock(
  overrides: Partial<MomentumStorage> = {},
): MomentumStorage {
  return {
    kind: 'supabase',
    getChains: vi.fn().mockResolvedValue([]),
    saveChains: vi.fn().mockResolvedValue(undefined),
    upsertChain: vi.fn().mockResolvedValue(undefined),
    upsertChains: vi.fn().mockResolvedValue(undefined),
    getActiveChains: vi.fn().mockResolvedValue([]),
    getDeletedChains: vi.fn().mockResolvedValue([]),
    softDeleteChain: vi.fn().mockResolvedValue(undefined),
    restoreChain: vi.fn().mockResolvedValue(undefined),
    permanentlyDeleteChain: vi.fn().mockResolvedValue(undefined),
    cleanupExpiredDeletedChains: vi.fn().mockResolvedValue(0),
    getScheduledSessions: vi.fn().mockResolvedValue([]),
    saveScheduledSessions: vi.fn().mockResolvedValue(undefined),
    getActiveSession: vi.fn().mockResolvedValue(null),
    saveActiveSession: vi.fn().mockResolvedValue(undefined),
    getCompletionHistory: vi.fn().mockResolvedValue([]),
    saveCompletionHistory: vi.fn().mockResolvedValue(undefined),
    getRSIPNodes: vi.fn().mockResolvedValue([]),
    saveRSIPNodes: vi.fn().mockResolvedValue(undefined),
    getRSIPMeta: vi.fn().mockResolvedValue({}),
    saveRSIPMeta: vi.fn().mockResolvedValue(undefined),
    getTaskTimeStats: vi.fn().mockResolvedValue([]),
    saveTaskTimeStats: vi.fn().mockResolvedValue(undefined),
    getLastCompletionTime: vi.fn().mockResolvedValue(null),
    updateTaskTimeStats: vi.fn().mockResolvedValue(undefined),
    getTaskAverageTime: vi.fn().mockResolvedValue(null),
    migrateCompletionHistoryForTiming: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn(),
    getCurrentUser: vi.fn().mockResolvedValue({ ok: true, value: null }),
    waitForAuthentication: vi.fn().mockResolvedValue({
      ok: true,
      value: { user: null, isAuthenticated: false },
    }),
    isUserAuthenticated: vi.fn().mockResolvedValue({ ok: true, value: false }),
    signUp: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    signIn: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    signOut: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    onAuthStateChange: vi.fn().mockReturnValue({ ok: true, value: vi.fn() }),
    getGamblingSettings: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    toggleGamblingMode: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    isGamblingModeEnabled: vi
      .fn()
      .mockResolvedValue({ ok: true, value: false }),
    createBettingSession: vi
      .fn()
      .mockResolvedValue({ ok: true, value: 'session-1' }),
    deleteBettingSession: vi
      .fn()
      .mockResolvedValue({ ok: true, value: undefined }),
    completeTaskWithBetting: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    placeBet: vi.fn().mockResolvedValue({ ok: true, value: { success: true } }),
    getUserAvailablePoints: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
    getTodayBetAmount: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
    performDailyCheckin: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getUserCheckinStats: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getPetState: vi.fn().mockResolvedValue(null),
    savePetState: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as MomentumStorage;
}

async function loadService() {
  vi.resetModules();
  const loggerMock = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  vi.doMock('../../utils/logger', () => ({ logger: loggerMock }));
  vi.doMock('../../utils/env', () => ({ isDev: false }));

  const mod = await import('../RealTimeSyncService');
  return { service: mod.realTimeSyncService, loggerMock };
}

describe('RealTimeSyncService', () => {
  it('supports subscribe/unsubscribe lifecycle', async () => {
    const { service } = await loadService();
    const callback = vi.fn();
    const unsubscribe = service.subscribe('chains', callback);

    await service.syncAfterOperation('chains', 'update', [{ id: 'chain-1' }]);
    expect(callback).toHaveBeenCalledWith([{ id: 'chain-1' }]);

    unsubscribe();
    await service.syncAfterOperation('chains', 'update', [{ id: 'chain-2' }]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(service.getStats().subscriberCount).toBe(0);
  });

  it('short-circuits sync actions when disabled', async () => {
    const { service } = await loadService();
    const storage = createStorageMock();
    service.setStorage(storage);
    service.setEnabled(false);

    const callback = vi.fn();
    service.subscribe('chains', callback);

    await service.syncAfterOperation('chains', 'update');
    await service.forceRefresh();

    expect(callback).not.toHaveBeenCalled();
    expect(storage.getActiveChains).not.toHaveBeenCalled();
  });

  it('fetches fresh data by type when freshData is not provided', async () => {
    const { service } = await loadService();
    const storage = createStorageMock({
      getActiveChains: vi.fn().mockResolvedValue([{ id: 'chain-1' }]),
      getScheduledSessions: vi.fn().mockResolvedValue([{ id: 'session-1' }]),
      getCompletionHistory: vi.fn().mockResolvedValue([{ id: 'history-1' }]),
    });
    service.setStorage(storage);

    const chainsCb = vi.fn();
    const sessionsCb = vi.fn();
    const historyCb = vi.fn();
    service.subscribe('chains', chainsCb);
    service.subscribe('sessions', sessionsCb);
    service.subscribe('history', historyCb);

    await service.syncAfterOperation('chains', 'update');
    await service.syncAfterOperation('sessions', 'update');
    await service.syncAfterOperation('history', 'update');

    expect(storage.getActiveChains).toHaveBeenCalledTimes(1);
    expect(storage.getScheduledSessions).toHaveBeenCalledTimes(1);
    expect(storage.getCompletionHistory).toHaveBeenCalledTimes(1);
    expect(chainsCb).toHaveBeenCalledWith([{ id: 'chain-1' }]);
    expect(sessionsCb).toHaveBeenCalledWith([{ id: 'session-1' }]);
    expect(historyCb).toHaveBeenCalledWith([{ id: 'history-1' }]);
  });

  it('isolates callback errors so other subscribers still receive updates', async () => {
    const { service, loggerMock } = await loadService();
    const broken = vi.fn(() => {
      throw new Error('callback failed');
    });
    const healthy = vi.fn();

    service.subscribe('chains', broken);
    service.subscribe('chains', healthy);

    await service.syncAfterOperation('chains', 'update', [{ id: 'chain-1' }]);

    expect(broken).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('forceRefresh updates all channels and refreshes timestamp', async () => {
    const { service } = await loadService();
    const storage = createStorageMock({
      getActiveChains: vi.fn().mockResolvedValue([{ id: 'c1' }]),
      getScheduledSessions: vi.fn().mockResolvedValue([{ id: 's1' }]),
      getCompletionHistory: vi.fn().mockResolvedValue([{ id: 'h1' }]),
    });
    service.setStorage(storage);

    const before = service.getStats().lastSyncTimestamp;
    const chainsCb = vi.fn();
    const sessionsCb = vi.fn();
    const historyCb = vi.fn();
    service.subscribe('chains', chainsCb);
    service.subscribe('sessions', sessionsCb);
    service.subscribe('history', historyCb);

    await service.forceRefresh();

    expect(storage.getActiveChains).toHaveBeenCalledTimes(1);
    expect(storage.getScheduledSessions).toHaveBeenCalledTimes(1);
    expect(storage.getCompletionHistory).toHaveBeenCalledTimes(1);
    expect(chainsCb).toHaveBeenCalledWith([{ id: 'c1' }]);
    expect(sessionsCb).toHaveBeenCalledWith([{ id: 's1' }]);
    expect(historyCb).toHaveBeenCalledWith([{ id: 'h1' }]);
    expect(service.getStats().lastSyncTimestamp).toBeGreaterThanOrEqual(before);
  });

  it('deleteWithSync and saveWithSync trigger operation and chain sync', async () => {
    const { service } = await loadService();
    const storage = createStorageMock({
      getActiveChains: vi.fn().mockResolvedValue([{ id: 'chain-10' }]),
    });
    const callback = vi.fn();
    service.subscribe('chains', callback);

    await expect(service.deleteWithSync(storage, 'chain-10')).resolves.toEqual([
      { id: 'chain-10' },
    ]);
    expect(storage.softDeleteChain).toHaveBeenCalledWith('chain-10');

    await expect(
      service.saveWithSync(storage, [{ id: 'chain-10' }] as never),
    ).resolves.toEqual([{ id: 'chain-10' }]);
    expect(storage.upsertChains).toHaveBeenCalledWith([{ id: 'chain-10' }]);
    expect(storage.saveChains).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('restoreWithSync refreshes data but rejects a partial failure', async () => {
    const { service, loggerMock } = await loadService();
    const storage = createStorageMock({
      restoreChain: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('restore failed')),
      getActiveChains: vi.fn().mockResolvedValue([{ id: 'chain-ok' }]),
    });

    await expect(
      service.restoreWithSync(storage, ['chain-ok', 'chain-bad']),
    ).rejects.toThrow('Partial restore failure: restore failed');
    expect(storage.restoreChain).toHaveBeenCalledTimes(2);
    expect(storage.getActiveChains).toHaveBeenCalledTimes(1);
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it('restoreWithSync throws when all restore operations fail', async () => {
    const { service } = await loadService();
    const storage = createStorageMock({
      restoreChain: vi.fn().mockRejectedValue(new Error('cannot restore')),
      getActiveChains: vi.fn().mockResolvedValue([]),
    });

    await expect(service.restoreWithSync(storage, ['a', 'b'])).rejects.toThrow(
      'All restore operations failed',
    );
  });

  it('permanentDeleteWithSync processes all ids then refreshes', async () => {
    const { service } = await loadService();
    const storage = createStorageMock({
      getActiveChains: vi.fn().mockResolvedValue([{ id: 'left' }]),
    });
    const callback = vi.fn();
    service.subscribe('chains', callback);

    const result = await service.permanentDeleteWithSync(storage, ['a', 'b']);
    expect(result).toEqual([{ id: 'left' }]);
    expect(storage.permanentlyDeleteChain).toHaveBeenNthCalledWith(1, 'a');
    expect(storage.permanentlyDeleteChain).toHaveBeenNthCalledWith(2, 'b');
    expect(callback).toHaveBeenCalledWith([{ id: 'left' }]);
  });
});

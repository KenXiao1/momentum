import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../domain/result';
import type { AppState } from '../../../types';
import {
  createAppState,
  createLocalStorageMock,
  createPetState,
  createSupabaseStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { logger } from '../../../utils/logger';
import { useImportExportDomain } from '../useImportExportDomain';

vi.mock('../../../i18n', () => ({
  useI18n: vi.fn(() => ({
    tr: (_zh: string, en: string) => en,
  })),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createStateContainer(initial: AppState) {
  let state = initial;
  const setState = vi.fn(
    (update: AppState | ((prev: AppState) => AppState)) => {
      state =
        typeof update === 'function'
          ? (update as (prev: AppState) => AppState)(state)
          : update;
    },
  );
  return {
    getState: () => state,
    setState,
  };
}

describe('useImportExportDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import chains and merge optional history/rsip payloads in local mode', async () => {
    const existing = createUnitChain({ id: 'existing-1' });
    const imported = createUnitChain({ id: 'imported-1' });
    const stateRef = createStateContainer(
      createAppState({
        chains: [existing],
        completionHistory: [],
        rsipNodes: [],
        rsipMeta: {},
        rsipGroups: [],
        rsipPolicyLibrary: [],
        rsipRunHistory: [],
        rsipExecutionRecords: [],
        rsipTaskLinks: [],
      }),
    );

    const pet = createPetState({ id: 'pet-imported', name: 'Nori' });
    const rsipGroups = [
      {
        id: 'group-1',
        title: 'Group',
        faultTolerance: 1,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ];
    const rsipPolicyLibrary = [
      {
        id: 'lib-1',
        title: 'Lib',
        rule: 'Rule',
        cumulativeExecutionDays: 2,
        internalizationProgress: 10,
        lastActiveAt: new Date('2026-02-01T10:00:00.000Z'),
        timesUsed: 1,
      },
    ];
    const rsipRunHistory = [
      {
        runNumber: 1,
        startedAt: new Date('2026-02-01T10:00:00.000Z'),
        maxNodeCount: 2,
        durationDays: 1,
      },
    ];
    const rsipExecutionRecords = [
      {
        id: 'exec-1',
        nodeId: 'node-1',
        executedAt: new Date('2026-02-01T10:00:00.000Z'),
        status: 'executed' as const,
      },
    ];
    const rsipTaskLinks = [
      {
        id: 'link-1',
        rsipNodeId: 'node-1',
        chainId: imported.id,
        chainKind: 'unit' as const,
        triggerEvent: 'task_completed' as const,
        effect: 'mark_rsip_executed' as const,
        automation: 'confirm' as const,
        isActive: true,
        updatedAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ];

    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [existing]),
      getCompletionHistory: vi.fn(async () => []),
      saveCompletionHistory: vi.fn(async () => undefined),
      getRSIPNodes: vi.fn(async () => []),
      saveRSIPNodes: vi.fn(async () => undefined),
      getRSIPMeta: vi.fn(async () => ({ origin: 'local' })),
      saveRSIPMeta: vi.fn(async () => undefined),
      getRSIPGroups: vi.fn(async () => []),
      saveRSIPGroups: vi.fn(async () => undefined),
      getRSIPPolicyLibrary: vi.fn(async () => []),
      saveRSIPPolicyLibrary: vi.fn(async () => undefined),
      getRSIPRunHistory: vi.fn(async () => []),
      saveRSIPRunHistory: vi.fn(async () => undefined),
      getRSIPTaskLinks: vi.fn(async () => []),
      saveRSIPTaskLinks: vi.fn(async () => undefined),
      appendRSIPExecutionRecord: vi.fn(async () => undefined),
      savePetState: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains,
        setState: stateRef.setState,
      }),
    );

    const history = [
      {
        chainId: imported.id,
        completedAt: new Date('2026-02-01T10:00:00.000Z'),
        duration: 20,
        wasSuccessful: true,
      },
    ];
    const rsipNodes = [
      {
        id: 'node-1',
        title: 'Node',
        rule: 'Rule',
        sortOrder: 1,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ];

    await act(async () => {
      await result.current.handleImportChains([imported], {
        history,
        rsipNodes,
        rsipMeta: { imported: true },
        rsipGroups,
        rsipPolicyLibrary,
        rsipRunHistory,
        rsipExecutionRecords,
        rsipTaskLinks,
        petState: pet,
      });
    });

    expect(safelySaveChains).toHaveBeenCalledWith([existing, imported]);
    expect(storage.saveCompletionHistory).toHaveBeenCalledWith(history);
    expect(storage.saveRSIPNodes).toHaveBeenCalledWith(rsipNodes);
    expect(storage.saveRSIPMeta).toHaveBeenCalledWith({
      origin: 'local',
      imported: true,
    });
    expect(storage.saveRSIPGroups).toHaveBeenCalledWith(rsipGroups);
    expect(storage.saveRSIPPolicyLibrary).toHaveBeenCalledWith(
      rsipPolicyLibrary,
    );
    expect(storage.saveRSIPRunHistory).toHaveBeenCalledWith(rsipRunHistory);
    expect(storage.appendRSIPExecutionRecord).toHaveBeenCalledWith(
      rsipExecutionRecords[0],
    );
    expect(storage.saveRSIPTaskLinks).toHaveBeenCalledWith(rsipTaskLinks);
    expect(storage.savePetState).toHaveBeenCalledWith(pet);
    expect(stateRef.getState().chains).toEqual([existing, imported]);
    expect(stateRef.getState().completionHistory).toEqual(history);
    expect(stateRef.getState().rsipNodes).toEqual(rsipNodes);
    expect(stateRef.getState().rsipMeta).toEqual({ imported: true });
    expect(stateRef.getState().rsipGroups).toEqual(rsipGroups);
    expect(stateRef.getState().rsipPolicyLibrary).toEqual(rsipPolicyLibrary);
    expect(stateRef.getState().rsipRunHistory).toEqual(rsipRunHistory);
    expect(stateRef.getState().rsipExecutionRecords).toEqual(
      rsipExecutionRecords,
    );
    expect(stateRef.getState().rsipTaskLinks).toEqual(rsipTaskLinks);

    expect(logger.info).toHaveBeenCalledWith(
      'APP_SHELL',
      '开始导入数据',
      expect.objectContaining({ chainCount: 1, options: expect.any(Object) }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'APP_SHELL',
      '准备保存导入的数据到存储',
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'APP_SHELL',
      '当前数据库中的链条数量',
      { count: 1 },
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'APP_SHELL',
      '准备导入的链条数量',
      { count: 1 },
    );
    expect(logger.info).toHaveBeenCalledWith(
      'APP_SHELL',
      '导入数据保存成功，更新 UI 状态',
    );
    expect(logger.info).toHaveBeenCalledWith(
      'APP_SHELL',
      '导入完成，UI 状态更新完成',
    );
  });

  it('should append imported history and rsip nodes onto existing local persisted data', async () => {
    const existing = createUnitChain({ id: 'existing-1' });
    const imported = createUnitChain({ id: 'imported-1' });
    const stateRef = createStateContainer(
      createAppState({
        chains: [existing],
        completionHistory: [
          {
            chainId: 'old',
            completedAt: new Date('2026-01-01T00:00:00.000Z'),
            duration: 10,
            wasSuccessful: true,
          },
        ],
        rsipNodes: [
          {
            id: 'old-node',
            title: 'Old Node',
            rule: 'Old Rule',
            sortOrder: 1,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        rsipMeta: { old: true },
      }),
    );

    const existingHistory = [
      {
        chainId: 'persisted-old',
        completedAt: new Date('2026-01-03T00:00:00.000Z'),
        duration: 3,
        wasSuccessful: true,
      },
    ];
    const existingNodes = [
      {
        id: 'persisted-node',
        title: 'Persisted Node',
        rule: 'Persisted Rule',
        sortOrder: 1,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ];
    const importedHistory = [
      {
        chainId: imported.id,
        completedAt: new Date('2026-02-01T00:00:00.000Z'),
        duration: 20,
        wasSuccessful: true,
      },
    ];
    const importedNodes = [
      {
        id: 'imported-node',
        title: 'Imported Node',
        rule: 'Imported Rule',
        sortOrder: 2,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ];

    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [existing]),
      getCompletionHistory: vi.fn(async () => existingHistory),
      saveCompletionHistory: vi.fn(async () => undefined),
      getRSIPNodes: vi.fn(async () => existingNodes),
      saveRSIPNodes: vi.fn(async () => undefined),
      getRSIPMeta: vi.fn(async () => ({ origin: 'local' })),
      saveRSIPMeta: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: stateRef.setState,
      }),
    );

    await act(async () => {
      await result.current.handleImportChains([imported], {
        history: importedHistory,
        rsipNodes: importedNodes,
        rsipMeta: { imported: true },
      });
    });

    expect(storage.saveCompletionHistory).toHaveBeenCalledWith([
      ...existingHistory,
      ...importedHistory,
    ]);
    expect(storage.saveRSIPNodes).toHaveBeenCalledWith([
      ...existingNodes,
      ...importedNodes,
    ]);
    expect(stateRef.getState().completionHistory).toHaveLength(2);
    expect(stateRef.getState().rsipNodes).toHaveLength(2);
    expect(stateRef.getState().rsipMeta).toEqual({ old: true, imported: true });
  });

  it('should import chains without optional payloads and keep existing local view state arrays', async () => {
    const existing = createUnitChain({ id: 'existing-1' });
    const imported = createUnitChain({ id: 'imported-1' });
    const initialHistory = [
      {
        chainId: 'history-1',
        completedAt: new Date('2026-01-01T00:00:00.000Z'),
        duration: 5,
        wasSuccessful: true,
      },
    ];
    const initialNodes = [
      {
        id: 'node-1',
        title: 'Node 1',
        rule: 'Rule 1',
        sortOrder: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    const stateRef = createStateContainer(
      createAppState({
        chains: [existing],
        completionHistory: initialHistory,
        rsipNodes: initialNodes,
        rsipMeta: { local: true },
      }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [existing]),
      saveCompletionHistory: vi.fn(async () => undefined),
      saveRSIPNodes: vi.fn(async () => undefined),
      saveRSIPMeta: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains,
        setState: stateRef.setState,
      }),
    );

    await act(async () => {
      await result.current.handleImportChains([imported]);
    });

    expect(safelySaveChains).toHaveBeenCalledWith([existing, imported]);
    expect(storage.saveCompletionHistory).not.toHaveBeenCalled();
    expect(storage.saveRSIPNodes).not.toHaveBeenCalled();
    expect(storage.saveRSIPMeta).not.toHaveBeenCalled();
    expect(stateRef.getState().completionHistory).toEqual(initialHistory);
    expect(stateRef.getState().rsipNodes).toEqual(initialNodes);
    expect(stateRef.getState().rsipMeta).toEqual({ local: true });
  });

  it('should reject empty import payloads', async () => {
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => []),
      getRSIPNodes: vi.fn(async () => []),
      getRSIPMeta: vi.fn(async () => ({})),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: vi.fn(),
      }),
    );

    await expect(result.current.handleImportChains([])).rejects.toThrow(
      'No valid chains found to import',
    );
  });

  it('should reject ID conflicts and reload state after import failure', async () => {
    const existing = createUnitChain({ id: 'conflict-id' });
    const stateRef = createStateContainer(createAppState());
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [existing]),
      getRSIPNodes: vi.fn(async () => []),
      getRSIPMeta: vi.fn(async () => ({})),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: stateRef.setState,
      }),
    );

    await expect(
      result.current.handleImportChains([
        createUnitChain({ id: 'conflict-id', name: 'conflict-a' }),
        createUnitChain({ id: 'conflict-id', name: 'conflict-b' }),
      ]),
    ).rejects.toThrow('found 2 chains with conflicting IDs');

    expect(storage.getChains).toHaveBeenCalledTimes(2);
    expect(storage.getRSIPNodes).toHaveBeenCalledTimes(1);
    expect(storage.getRSIPMeta).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'IMPORT',
      'Failed to import data',
      { errorMessage: 'Import failed: found 2 chains with conflicting IDs' },
      expect.any(Error),
    );
  });

  it('should enforce auth checks for supabase imports', async () => {
    const storage = createSupabaseStorageMock({
      isUserAuthenticated: vi.fn(async () => ok(false)),
      waitForAuthentication: vi.fn(async () =>
        ok({ user: null, isAuthenticated: false }),
      ),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: vi.fn(),
      }),
    );

    await expect(
      result.current.handleImportChains([
        createUnitChain({ id: 'imported-auth' }),
      ]),
    ).rejects.toThrow('Authentication failed during import');
  });

  it('should skip waitForAuthentication when supabase auth is already valid', async () => {
    const existing = createUnitChain({ id: 'existing-1' });
    const imported = createUnitChain({ id: 'imported-1' });
    const storage = createSupabaseStorageMock({
      isUserAuthenticated: vi.fn(async () => ok(true)),
      waitForAuthentication: vi.fn(async () =>
        ok({ user: null, isAuthenticated: false }),
      ),
      getChains: vi.fn(async () => [existing]),
      saveCompletionHistory: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleImportChains([imported], {
        history: [
          {
            chainId: imported.id,
            completedAt: new Date('2026-02-01T00:00:00.000Z'),
            duration: 10,
            wasSuccessful: true,
          },
        ],
      });
    });

    expect(storage.waitForAuthentication).not.toHaveBeenCalled();
    expect(storage.saveCompletionHistory).toHaveBeenCalledWith([
      {
        chainId: imported.id,
        completedAt: new Date('2026-02-01T00:00:00.000Z'),
        duration: 10,
        wasSuccessful: true,
      },
    ]);
  });

  it('should warn and wait for authentication when initial auth check fails with error', async () => {
    const storage = createSupabaseStorageMock({
      isUserAuthenticated: vi.fn(async () =>
        err({
          code: 'AUTH_TEMP',
          message: 'temporary auth error',
          recoverable: true,
        }),
      ),
      waitForAuthentication: vi.fn(async () =>
        ok({ user: null, isAuthenticated: false }),
      ),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: vi.fn(),
      }),
    );

    await expect(
      result.current.handleImportChains([
        createUnitChain({ id: 'imported-auth' }),
      ]),
    ).rejects.toThrow('Authentication failed during import');

    expect(logger.warn).toHaveBeenCalledWith(
      'IMPORT',
      'isUserAuthenticated failed',
      {
        code: 'AUTH_TEMP',
        message: 'temporary auth error',
      },
    );
    expect(storage.waitForAuthentication).toHaveBeenCalledWith(10000);
  });

  it('should continue import when auth check fails but waitForAuthentication succeeds', async () => {
    const existing = createUnitChain({ id: 'existing-auth' });
    const imported = createUnitChain({ id: 'imported-auth-success' });
    const stateRef = createStateContainer(
      createAppState({ chains: [existing] }),
    );
    const storage = createSupabaseStorageMock({
      isUserAuthenticated: vi.fn(async () =>
        err({
          code: 'AUTH_TEMP',
          message: 'temporary auth error',
          recoverable: true,
        }),
      ),
      waitForAuthentication: vi.fn(async () =>
        ok({ user: { id: 'user-1' }, isAuthenticated: true }),
      ),
      getChains: vi.fn(async () => [existing]),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => undefined),
        setState: stateRef.setState,
      }),
    );

    await act(async () => {
      await result.current.handleImportChains([imported]);
    });

    expect(storage.waitForAuthentication).toHaveBeenCalledWith(10000);
    expect(stateRef.getState().chains.map((chain) => chain.id)).toEqual([
      'existing-auth',
      'imported-auth-success',
    ]);
  });

  it('should reload state and rethrow when chain persistence fails during import', async () => {
    const existing = createUnitChain({ id: 'existing-1' });
    const imported = createUnitChain({ id: 'imported-1' });
    const stateRef = createStateContainer(
      createAppState({ chains: [existing], rsipNodes: [], rsipMeta: {} }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [existing]),
      getRSIPNodes: vi.fn(async () => [
        {
          id: 'rsip-1',
          title: 'n',
          rule: 'r',
          sortOrder: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
      getRSIPMeta: vi.fn(async () => ({ source: 'storage' })),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => {
          throw new Error('save chains failed');
        }),
        setState: stateRef.setState,
      }),
    );

    await expect(result.current.handleImportChains([imported])).rejects.toThrow(
      'save chains failed',
    );

    expect(storage.getChains).toHaveBeenCalledTimes(2);
    expect(stateRef.getState().chains).toEqual([existing]);
    expect(stateRef.getState().rsipMeta).toEqual({ source: 'storage' });
    expect(stateRef.getState().rsipNodes).toHaveLength(1);
  });

  it('should log reload failure after import failure and rethrow original error', async () => {
    const imported = createUnitChain({ id: 'imported-reload-fail' });
    const storage = createLocalStorageMock({
      getChains: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValue(new Error('reload chains failed')),
      getRSIPNodes: vi.fn(async () => []),
      getRSIPMeta: vi.fn(async () => ({})),
    });

    const { result } = renderHook(() =>
      useImportExportDomain({
        storage,
        safelySaveChains: vi.fn(async () => {
          throw new Error('save failed hard');
        }),
        setState: vi.fn(),
      }),
    );

    await expect(result.current.handleImportChains([imported])).rejects.toThrow(
      'save failed hard',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'IMPORT',
      'Reload after import failure also failed',
      undefined,
      expect.any(Error),
    );
  });
});

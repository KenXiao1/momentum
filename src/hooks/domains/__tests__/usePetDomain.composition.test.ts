import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalStorageMock } from '../../../test/factories';
import type { PetState, TaskCompletionReward } from '../../../types/pet';
import { useStorage } from '../../../storage/useStorage';
import { createAppState } from '../../../test/factories';
import { localStorageAdapter } from '../../../storage/localStorageAdapter';
import { importExportService } from '../../../services/ImportExportService';
import { useImportExportDomain } from '../useImportExportDomain';
import { usePetDomain } from '../usePetDomain';

vi.mock('../../../storage/useStorage', () => ({
  useStorage: vi.fn(),
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({ tr: (_zh: string, en: string) => en }),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createPetState(overrides: Partial<PetState> = {}): PetState {
  const now = new Date();
  return {
    id: 'pet-1',
    name: 'Momo',
    hunger: 50,
    happiness: 70,
    health: 100,
    level: 1,
    experience: 0,
    stage: 'egg',
    createdAt: now,
    lastFedAt: now,
    lastInteractedAt: now,
    lastDecayCalculatedAt: now,
    isVisible: true,
    isMinimized: false,
    position: { x: 80, y: 80 },
    minimizedPosition: { x: 92, y: 2 },
    ...overrides,
  };
}

describe('usePetDomain real pet-logic composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies two hours of real decay before persisting a loaded pet', async () => {
    const savedPet = createPetState({
      lastDecayCalculatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);

    const { result } = renderHook(() => usePetDomain());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.pet).toMatchObject({
      hunger: 54,
      happiness: 68,
      health: 100,
    });
    expect(storage.savePetState).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pet-1',
        hunger: 54,
        happiness: 68,
        health: 100,
      }),
    );
  });

  it('composes the real reward, level threshold, evolution, and persisted state', async () => {
    const savedPet = createPetState({ experience: 95, stage: 'egg' });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    const { result } = renderHook(() => usePetDomain());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let reward: TaskCompletionReward | null = null;
    await act(async () => {
      reward = await result.current.onTaskCompleted(10, true);
    });

    expect(reward).toEqual({
      xpGained: 11,
      hungerReduced: 3.3,
      happinessGained: 5,
      leveledUp: true,
      evolved: true,
      newLevel: 2,
      newStage: 'baby',
    });
    expect(result.current.pet).toMatchObject({
      hunger: 46.7,
      happiness: 75,
      experience: 6,
      level: 2,
      stage: 'baby',
    });
    expect(storage.savePetState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hunger: 46.7,
        happiness: 75,
        experience: 6,
        level: 2,
        stage: 'baby',
      }),
    );
  });
  it('B08/B10 restores a pet-only backup and updates the mounted UI state immediately', async () => {
    localStorage.clear();
    vi.mocked(useStorage).mockReturnValue(localStorageAdapter);
    let appState = createAppState();
    const { result } = renderHook(() => {
      const petDomain = usePetDomain();
      const importer = useImportExportDomain({
        storage: localStorageAdapter,
        safelySaveChains: (chains) => localStorageAdapter.saveChains(chains),
        setState: (update) => {
          appState = typeof update === 'function' ? update(appState) : update;
        },
        onPetImported: petDomain.reloadPet,
      });
      return { petDomain, importer };
    });
    await waitFor(() => expect(result.current.petDomain.isLoading).toBe(false));
    expect(result.current.petDomain.hasPet).toBe(false);
    const pet = createPetState({ name: 'Imported pet' });
    const json = JSON.stringify(
      importExportService.createExportData({ chains: [], petState: pet }),
    );
    const parsed = importExportService.parseImportData({
      json,
      options: {
        preserveStatistics: true,
        preserveTimestamps: true,
        importCompletionHistory: true,
      },
      tr: (_zh, en) => en,
    });
    await act(() =>
      result.current.importer.handleImportChains(parsed.chains, {
        petState: parsed.petState,
      }),
    );
    expect(result.current.petDomain.hasPet).toBe(true);
    expect(result.current.petDomain.pet?.name).toBe('Imported pet');
    expect((await localStorageAdapter.getPetState())?.name).toBe(
      'Imported pet',
    );
    expect(appState.chains).toEqual([]);
  });
});

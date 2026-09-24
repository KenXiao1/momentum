import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PetState, TaskCompletionReward } from '../../../types/pet';
import { createLocalStorageMock } from '../../../test/factories';
import { useStorage } from '../../../storage/useStorage';
import { logger } from '../../../utils/logger';
import {
  calculateDecay,
  calculateMood,
  calculateTaskReward,
  createNewPet,
  getXpForLevel,
} from '../../../utils/petLogic';
import { usePetDomain } from '../usePetDomain';

vi.mock('../../../storage/useStorage', () => ({
  useStorage: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/petLogic', () => ({
  DEFAULT_PET_CONFIG: {
    feedingHungerReduction: 30,
  },
  calculateDecay: vi.fn(),
  calculateTaskReward: vi.fn(),
  calculateMood: vi.fn(),
  createNewPet: vi.fn(),
  getXpForLevel: vi.fn(),
}));

function createPetState(overrides: Partial<PetState> = {}): PetState {
  const now = new Date('2026-02-01T10:00:00.000Z');
  return {
    id: overrides.id ?? 'pet-1',
    name: overrides.name ?? 'Momo',
    hunger: overrides.hunger ?? 50,
    happiness: overrides.happiness ?? 70,
    health: overrides.health ?? 100,
    level: overrides.level ?? 1,
    experience: overrides.experience ?? 0,
    stage: overrides.stage ?? 'egg',
    createdAt: overrides.createdAt ?? now,
    lastFedAt: overrides.lastFedAt ?? now,
    lastInteractedAt: overrides.lastInteractedAt ?? now,
    lastDecayCalculatedAt: overrides.lastDecayCalculatedAt ?? now,
    isVisible: overrides.isVisible ?? true,
    isMinimized: overrides.isMinimized ?? false,
    position: overrides.position ?? { x: 80, y: 80 },
    minimizedPosition: overrides.minimizedPosition ?? { x: 92, y: 2 },
  };
}

describe('usePetDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(calculateMood).mockReturnValue('happy');
    vi.mocked(getXpForLevel).mockReturnValue(100);
    vi.mocked(calculateDecay).mockImplementation((pet, now) => ({
      hunger: pet.hunger,
      happiness: pet.happiness,
      health: pet.health,
      lastDecayCalculatedAt: now,
    }));
    vi.mocked(calculateTaskReward).mockReturnValue({
      xpGained: 10,
      hungerReduced: 5,
      happinessGained: 3,
      leveledUp: false,
      evolved: false,
    } as TaskCompletionReward);
    vi.mocked(createNewPet).mockImplementation((name: string) =>
      createPetState({ id: 'new-pet', name }),
    );
  });

  it('should load saved pet, apply decay, and persist the updated pet', async () => {
    const savedPet = createPetState({
      id: 'saved-pet',
      hunger: 40,
      happiness: 75,
      health: 90,
      lastDecayCalculatedAt: new Date('2026-02-01T08:00:00.000Z'),
    });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(calculateDecay).mockReturnValue({
      hunger: 44,
      happiness: 71,
      health: 88,
      lastDecayCalculatedAt: new Date('2026-02-01T10:00:00.000Z'),
    });

    const { result } = renderHook(() => usePetDomain());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPet).toBe(true);
    expect(result.current.pet).toMatchObject({
      id: 'saved-pet',
      hunger: 44,
      happiness: 71,
      health: 88,
    });
    expect(storage.savePetState).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'saved-pet',
        hunger: 44,
        happiness: 71,
        health: 88,
      }),
    );
    expect(calculateMood).toHaveBeenCalled();
  });

  it('should log load failure and stop loading when reading pet state throws', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => {
        throw new Error('pet read failed');
      }),
    });
    vi.mocked(useStorage).mockReturnValue(storage);

    const { result } = renderHook(() => usePetDomain());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pet).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'PET',
      'Failed to load pet state',
      undefined,
      expect.any(Error),
    );
  });

  it('should keep neutral mood and skip decay when no saved pet exists', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
    });
    vi.mocked(useStorage).mockReturnValue(storage);

    const { result } = renderHook(() => usePetDomain());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pet).toBeNull();
    expect(result.current.hasPet).toBe(false);
    expect(result.current.mood).toBe('neutral');
    expect(calculateDecay).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should create pet and handle feed/task/position/visibility actions', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(calculateTaskReward).mockReturnValue({
      xpGained: 20,
      hungerReduced: 10,
      happinessGained: 5,
      leveledUp: true,
      evolved: false,
      newLevel: 2,
    } as TaskCompletionReward);

    const { result } = renderHook(() => usePetDomain());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const created = await result.current.createPet('Nova');
      expect(created.id).toBe('new-pet');
      expect(created.name).toBe('Nova');
    });
    await waitFor(() => {
      expect(result.current.hasPet).toBe(true);
    });

    await act(async () => {
      const feedResult = await result.current.feedPet();
      expect(feedResult).toEqual({
        hungerReduced: 30,
        newHunger: 20,
        happinessGained: 5,
      });
    });

    await act(async () => {
      const reward = await result.current.onTaskCompleted(30, true);
      expect(reward?.xpGained).toBe(20);
      expect(reward?.newLevel).toBe(2);
    });

    await act(async () => {
      await result.current.updatePosition(10, 20);
    });
    expect(result.current.pet?.position).toEqual({ x: 10, y: 20 });

    await act(async () => {
      await result.current.updateMinimizedPosition(30, 40);
    });
    expect(result.current.pet?.minimizedPosition).toEqual({ x: 30, y: 40 });

    await act(async () => {
      await result.current.toggleVisibility();
    });
    expect(result.current.pet?.isVisible).toBe(false);

    await act(async () => {
      await result.current.showPet();
    });
    expect(result.current.pet?.isVisible).toBe(true);

    await act(async () => {
      await result.current.minimize();
    });
    expect(result.current.pet?.isMinimized).toBe(true);
    expect(result.current.pet?.minimizedPosition).toEqual({ x: 10, y: 20 });

    await act(async () => {
      await result.current.expand();
    });
    expect(result.current.pet?.isMinimized).toBe(false);
    expect(result.current.pet?.position).toEqual({ x: 10, y: 20 });
    expect(storage.savePetState).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('PET', 'Created new pet', {
      name: 'Nova',
    });
    expect(logger.info).toHaveBeenCalledWith(
      'PET',
      'Fed pet',
      expect.objectContaining({ hungerReduced: expect.any(Number) }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'PET',
      'Task completed reward',
      expect.objectContaining({ xpGained: 20, leveledUp: true }),
    );
    expect(logger.info).toHaveBeenCalledWith('PET', 'Pet minimized');
    expect(logger.info).toHaveBeenCalledWith('PET', 'Pet expanded');
  });

  it('should return null for feed/task actions and no-op mutators when no pet exists', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    const { result } = renderHook(() => usePetDomain());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.feedPet()).resolves.toBeNull();
      await expect(
        result.current.onTaskCompleted(20, true),
      ).resolves.toBeNull();
      await expect(
        result.current.updatePosition(1, 2),
      ).resolves.toBeUndefined();
      await expect(
        result.current.updateMinimizedPosition(3, 4),
      ).resolves.toBeUndefined();
      await expect(result.current.toggleVisibility()).resolves.toBeUndefined();
      await expect(result.current.showPet()).resolves.toBeUndefined();
      await expect(result.current.minimize()).resolves.toBeUndefined();
      await expect(result.current.expand()).resolves.toBeUndefined();
    });

    expect(storage.savePetState).not.toHaveBeenCalled();
  });

  it('should compute feed values with decimal rounding and happiness cap', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(createNewPet).mockReturnValue(
      createPetState({
        id: 'feed-decimal',
        hunger: 45.67,
        happiness: 66.66,
      }),
    );

    const { result } = renderHook(() => usePetDomain());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createPet('Decimal');
    });

    const feedResult = await act(async () => result.current.feedPet());

    expect(feedResult).not.toBeNull();
    expect(feedResult?.hungerReduced).toBeCloseTo(30, 6);
    expect(feedResult?.newHunger).toBeCloseTo(15.67, 6);
    expect(feedResult?.happinessGained).toBeCloseTo(5, 6);
    expect(result.current.pet).toMatchObject({
      hunger: 15.7,
      happiness: 71.7,
    });
  });

  it('should compute feed values below cap when hunger is low', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(createNewPet).mockReturnValue(
      createPetState({
        id: 'feed-low',
        hunger: 12.3,
        happiness: 30,
      }),
    );

    const { result } = renderHook(() => usePetDomain());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createPet('LowFeed');
    });

    const feedResult = await act(async () => result.current.feedPet());

    expect(feedResult).not.toBeNull();
    expect(feedResult?.hungerReduced).toBeCloseTo(12.3, 6);
    expect(feedResult?.newHunger).toBeCloseTo(0, 6);
    expect(feedResult?.happinessGained).toBeCloseTo(2.05, 6);
    expect(result.current.pet).toMatchObject({
      hunger: 0,
      happiness: 32.1,
    });
  });

  it('should clamp hunger and happiness and apply level-up xp subtraction on task completion', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(createNewPet).mockReturnValue(
      createPetState({
        id: 'task-pet',
        hunger: 2,
        happiness: 99,
        level: 1,
        experience: 120,
        stage: 'egg',
      }),
    );
    vi.mocked(getXpForLevel).mockReturnValue(100);
    vi.mocked(calculateTaskReward).mockReturnValue({
      xpGained: 30,
      hungerReduced: 10,
      happinessGained: 10,
      leveledUp: true,
      evolved: true,
      newLevel: 2,
      newStage: 'baby',
    } as TaskCompletionReward);

    const { result } = renderHook(() => usePetDomain());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    await act(async () => {
      await result.current.createPet('Tasky');
    });

    await act(async () => {
      await result.current.onTaskCompleted(45, true);
    });

    expect(result.current.pet).toMatchObject({
      hunger: 0,
      happiness: 100,
      experience: 50,
      level: 2,
      stage: 'baby',
    });
  });

  it('should keep level and stage when reward does not provide upgrades', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(createNewPet).mockReturnValue(
      createPetState({
        id: 'task-fallback',
        hunger: 40,
        happiness: 50,
        level: 3,
        stage: 'adult',
      }),
    );
    vi.mocked(calculateTaskReward).mockReturnValue({
      xpGained: 5,
      hungerReduced: 1,
      happinessGained: -2,
      leveledUp: false,
      evolved: false,
    } as TaskCompletionReward);

    const { result } = renderHook(() => usePetDomain());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    await act(async () => {
      await result.current.createPet('Fallback');
    });

    await act(async () => {
      await result.current.onTaskCompleted(20, false);
    });

    expect(result.current.pet).toMatchObject({
      level: 3,
      stage: 'adult',
      hunger: 39,
      happiness: 48,
      experience: 5,
    });
  });

  it('should no-op show/minimize/expand when guards block action', async () => {
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => null),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(createNewPet).mockReturnValue(
      createPetState({
        id: 'guards',
        isVisible: true,
        isMinimized: false,
      }),
    );

    const { result } = renderHook(() => usePetDomain());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    await act(async () => {
      await result.current.createPet('Guarded');
    });

    const saveCallsAfterCreate = vi.mocked(storage.savePetState).mock.calls
      .length;
    await act(async () => {
      await result.current.showPet();
      await result.current.expand();
    });
    expect(vi.mocked(storage.savePetState).mock.calls.length).toBe(
      saveCallsAfterCreate,
    );

    await act(async () => {
      await result.current.minimize();
    });
    expect(result.current.pet?.isMinimized).toBe(true);
    expect(vi.mocked(storage.savePetState).mock.calls.length).toBe(
      saveCallsAfterCreate + 1,
    );

    await act(async () => {
      await result.current.minimize();
    });
    expect(vi.mocked(storage.savePetState).mock.calls.length).toBe(
      saveCallsAfterCreate + 1,
    );
  });

  it('should run periodic decay and emit starvation/health warnings', async () => {
    vi.useFakeTimers();
    const savedPet = createPetState({
      id: 'warning-pet',
      hunger: 80,
      health: 30,
      happiness: 70,
    });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(calculateDecay)
      .mockReturnValueOnce({
        hunger: 80,
        happiness: 70,
        health: 30,
        lastDecayCalculatedAt: new Date('2026-02-01T10:00:00.000Z'),
      })
      .mockReturnValueOnce({
        hunger: 85,
        happiness: 65,
        health: 20,
        lastDecayCalculatedAt: new Date('2026-02-01T10:05:00.000Z'),
      });

    const { result, unmount } = renderHook(() => usePetDomain());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.hasPet).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(logger.warn).toHaveBeenCalledWith('PET', 'Pet is starving!', {
      hunger: 85,
    });
    expect(logger.warn).toHaveBeenCalledWith('PET', 'Pet health is low!', {
      health: 20,
    });

    unmount();
    vi.useRealTimers();
  });

  it('should skip decay persistence when there is no stat change and clear interval on unmount', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const savedPet = createPetState({
      id: 'no-change-pet',
      hunger: 55,
      happiness: 44,
      health: 88,
    });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(calculateDecay)
      .mockReturnValueOnce({
        hunger: 55,
        happiness: 44,
        health: 88,
        lastDecayCalculatedAt: new Date('2026-02-01T10:00:00.000Z'),
      })
      .mockReturnValueOnce({
        hunger: 55,
        happiness: 44,
        health: 88,
        lastDecayCalculatedAt: new Date('2026-02-01T10:05:00.000Z'),
      });

    const { unmount } = renderHook(() => usePetDomain());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(storage.savePetState).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();

    unmount();
    expect(clearSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should persist decay updates when only health changes and trigger health warning threshold crossing', async () => {
    vi.useFakeTimers();
    const savedPet = createPetState({
      id: 'health-only-pet',
      hunger: 40,
      happiness: 40,
      health: 35,
    });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(calculateDecay).mockReturnValue({
      hunger: 40,
      happiness: 40,
      health: 35,
      lastDecayCalculatedAt: new Date('2026-02-01T10:00:00.000Z'),
    });

    const { result } = renderHook(() => usePetDomain());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const initialPet = result.current.pet;
    expect(initialPet).not.toBeNull();

    vi.mocked(calculateDecay).mockReturnValueOnce({
      hunger: initialPet!.hunger,
      happiness: initialPet!.happiness,
      health: 20,
      lastDecayCalculatedAt: new Date('2026-02-01T10:05:00.000Z'),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current.pet?.health).toBe(20);
    expect(storage.savePetState).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith('PET', 'Pet health is low!', {
      health: 20,
    });
    expect(logger.warn).not.toHaveBeenCalledWith(
      'PET',
      'Pet is starving!',
      expect.anything(),
    );
  });

  it('should not emit threshold warnings when values stay on boundary without crossing', async () => {
    vi.useFakeTimers();
    const savedPet = createPetState({
      id: 'boundary-pet',
      hunger: 79,
      health: 31,
      happiness: 60,
    });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(calculateDecay)
      .mockReturnValueOnce({
        hunger: 79,
        happiness: 60,
        health: 31,
        lastDecayCalculatedAt: new Date('2026-02-01T10:00:00.000Z'),
      })
      .mockReturnValueOnce({
        hunger: 80,
        happiness: 60,
        health: 30,
        lastDecayCalculatedAt: new Date('2026-02-01T10:05:00.000Z'),
      });

    renderHook(() => usePetDomain());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(logger.warn).not.toHaveBeenCalledWith(
      'PET',
      'Pet is starving!',
      expect.anything(),
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      'PET',
      'Pet health is low!',
      expect.anything(),
    );
    vi.useRealTimers();
  });

  it('should avoid duplicate warnings when pet was already beyond warning thresholds', async () => {
    vi.useFakeTimers();
    const savedPet = createPetState({
      id: 'already-warning-pet',
      hunger: 90,
      happiness: 40,
      health: 20,
    });
    const storage = createLocalStorageMock({
      getPetState: vi.fn(async () => savedPet),
      savePetState: vi.fn(async () => undefined),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    vi.mocked(calculateDecay)
      .mockReturnValueOnce({
        hunger: 90,
        happiness: 40,
        health: 20,
        lastDecayCalculatedAt: new Date('2026-02-01T10:00:00.000Z'),
      })
      .mockReturnValueOnce({
        hunger: 95,
        happiness: 35,
        health: 15,
        lastDecayCalculatedAt: new Date('2026-02-01T10:05:00.000Z'),
      });

    renderHook(() => usePetDomain());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(logger.warn).not.toHaveBeenCalledWith(
      'PET',
      'Pet is starving!',
      expect.anything(),
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      'PET',
      'Pet health is low!',
      expect.anything(),
    );
  });
});

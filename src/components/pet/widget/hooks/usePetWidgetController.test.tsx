import { createTranslator } from '../../../../i18n/translate';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedResult, PetState } from '../../../../types/pet';
import { usePetWidgetController } from './usePetWidgetController';

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
}));

const hapticsMocks = vi.hoisted(() => ({
  notification: vi.fn(async () => true),
  impact: vi.fn(async () => true),
}));

vi.mock('../../../../utils/toast', () => ({
  toast: toastMocks,
}));

vi.mock('../../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({ haptics: hapticsMocks }),
}));

function createPet(overrides: Partial<PetState> = {}): PetState {
  const now = new Date('2026-02-06T10:00:00.000Z');
  return {
    id: 'pet-1',
    name: 'Momo',
    hunger: 40,
    happiness: 70,
    health: 80,
    level: 2,
    experience: 30,
    stage: 'baby',
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

function createParams(
  overrides: Partial<Parameters<typeof usePetWidgetController>[0]> = {},
): Parameters<typeof usePetWidgetController>[0] {
  const pet = overrides.pet === undefined ? createPet() : overrides.pet;
  return {
    pet,
    mood: 'happy',
    isLoading: false,
    hasPet: pet !== null,
    onCreatePet: vi.fn(async (name: string) => createPet({ name })),
    onFeedPet: vi.fn(async () => null),
    onUpdatePosition: vi.fn(async () => undefined),
    onUpdateMinimizedPosition: vi.fn(async () => undefined),
    onMinimize: vi.fn(async () => undefined),
    onExpand: vi.fn(async () => undefined),
    t: createTranslator('en'),
    ...overrides,
  };
}

function attachWidget(
  widgetRef: { current: HTMLDivElement | null },
  rect: Partial<DOMRect> = {},
) {
  const widget = document.createElement('div');
  vi.spyOn(widget, 'getBoundingClientRect').mockReturnValue({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    left: rect.left ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON: () => ({}),
  });
  widgetRef.current = widget;
  return widget;
}

describe('usePetWidgetController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens the creation dialog after 500ms and cancels the timer on unmount', () => {
    vi.useFakeTimers();
    const params = createParams({ pet: null, hasPet: false });
    const { result, unmount } = renderHook(() =>
      usePetWidgetController(params),
    );

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.showCreationDialog).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.showCreationDialog).toBe(true);

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('reports successful and no-op feeding outcomes through real controller logic', async () => {
    const onFeedPet = vi
      .fn<() => Promise<FeedResult | null>>()
      .mockResolvedValueOnce({
        hungerReduced: 12.6,
        newHunger: 27.4,
        happinessGained: 2,
      })
      .mockResolvedValueOnce({
        hungerReduced: 0,
        newHunger: 0,
        happinessGained: 0,
      });
    const { result } = renderHook(() =>
      usePetWidgetController(createParams({ onFeedPet })),
    );

    await act(async () => {
      await result.current.handleFeed();
    });
    expect(hapticsMocks.notification).toHaveBeenCalledWith('success');
    expect(toastMocks.success).toHaveBeenCalledWith('Fed! Fullness +13');

    await act(async () => {
      await result.current.handleFeed();
    });
    expect(toastMocks.info).toHaveBeenCalledWith('Pet is already full~');
  });

  it('prevents concurrent feeds and always clears the feeding state', async () => {
    let resolveFeed: ((value: FeedResult | null) => void) | undefined;
    const onFeedPet = vi.fn(
      () =>
        new Promise<FeedResult | null>((resolve) => {
          resolveFeed = resolve;
        }),
    );
    const { result } = renderHook(() =>
      usePetWidgetController(createParams({ onFeedPet })),
    );

    let firstFeed: Promise<void> | undefined;
    act(() => {
      firstFeed = result.current.handleFeed();
    });
    await waitFor(() => expect(result.current.isFeeding).toBe(true));

    await act(async () => {
      await result.current.handleFeed();
    });
    expect(onFeedPet).toHaveBeenCalledTimes(1);

    resolveFeed?.(null);
    await act(async () => {
      await firstFeed;
    });
    expect(result.current.isFeeding).toBe(false);
  });

  it('clears the feeding state when the feed operation rejects', async () => {
    const error = new Error('feed failed');
    const onFeedPet = vi.fn(async () => {
      throw error;
    });
    const { result } = renderHook(() =>
      usePetWidgetController(createParams({ onFeedPet })),
    );

    await act(async () => {
      await expect(result.current.handleFeed()).rejects.toBe(error);
    });

    expect(result.current.isFeeding).toBe(false);
  });

  it('creates, minimizes, and expands a pet through the supplied boundaries', async () => {
    const params = createParams();
    const { result } = renderHook(() => usePetWidgetController(params));

    act(() => result.current.setShowCreationDialog(true));
    await act(async () => {
      await result.current.handleCreatePet('Nova');
      await result.current.handleMinimize();
      await result.current.handleExpand();
    });

    expect(params.onCreatePet).toHaveBeenCalledWith('Nova');
    expect(toastMocks.success).toHaveBeenCalledWith('Welcome Nova! 🎀');
    expect(result.current.showCreationDialog).toBe(false);
    expect(params.onMinimize).toHaveBeenCalledTimes(1);
    expect(params.onExpand).toHaveBeenCalledTimes(1);
  });

  it('coalesces mouse movement into one frame, clamps it, and persists position', async () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 500);
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const params = createParams();
    const { result } = renderHook(() => usePetWidgetController(params));
    const widget = attachWidget(result.current.widgetRef, {
      left: 950,
      top: 450,
    });

    act(() => {
      result.current.handleMouseDown({
        button: 0,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
      } as never);
    });
    await waitFor(() => expect(result.current.isDragging).toBe(true));

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 2_000, clientY: 2_000 }),
      );
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 3_000, clientY: 3_000 }),
      );
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => frameCallbacks[0](16));
    expect(widget.style.left).toBe('95%');
    expect(widget.style.top).toBe('90%');
    expect(result.current.hasDraggedRef.current).toBe(true);

    await act(async () => {
      await result.current.handleMouseUp();
    });
    expect(params.onUpdatePosition).toHaveBeenCalledWith(95, 90);
    expect(result.current.isDragging).toBe(false);
  });

  it('handles touch drag using the minimized position and persists it', async () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 500);
    let frameCallback: FrameRequestCallback | undefined;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const params = createParams({ pet: createPet({ isMinimized: true }) });
    const { result } = renderHook(() => usePetWidgetController(params));
    const widget = attachWidget(result.current.widgetRef, {
      left: 200,
      top: 100,
    });

    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 100, clientY: 100 }],
      } as never);
    });
    await waitFor(() => expect(result.current.isDragging).toBe(true));
    expect(hapticsMocks.impact).toHaveBeenCalledWith('light');

    const moveEvent = new Event('touchmove', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(moveEvent, 'touches', {
      value: [{ clientX: 200, clientY: 200 }],
    });
    act(() => window.dispatchEvent(moveEvent));
    act(() => frameCallback?.(16));
    expect(widget.style.left).toBe('95%');
    expect(widget.style.top).toBe('22%');

    act(() => window.dispatchEvent(new Event('touchend')));
    await waitFor(() => {
      expect(params.onUpdateMinimizedPosition).toHaveBeenCalledWith(20, 20);
    });
  });

  it('removes active drag listeners when unmounted', async () => {
    const params = createParams();
    const { result, unmount } = renderHook(() =>
      usePetWidgetController(params),
    );
    attachWidget(result.current.widgetRef);

    act(() => {
      result.current.handleMouseDown({
        button: 0,
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
      } as never);
    });
    await waitFor(() => expect(result.current.isDragging).toBe(true));

    unmount();
    window.dispatchEvent(new MouseEvent('mouseup'));
    await Promise.resolve();

    expect(params.onUpdatePosition).not.toHaveBeenCalled();
    expect(params.onUpdateMinimizedPosition).not.toHaveBeenCalled();
  });
});

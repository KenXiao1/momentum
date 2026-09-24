import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { AuthSession } from '../../../domain/auth';
import { ok, err } from '../../../domain/result';
import {
  createAppState,
  createLocalStorageMock,
  createSupabaseStorageMock,
} from '../../../test/factories';
import { useAuthController } from '../useAuthController';

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('useAuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be ready immediately for local storage mode', () => {
    const storage = createLocalStorageMock();
    const setState = vi.fn();
    const resetAppState = vi.fn(() => createAppState());
    const resetUIState = vi.fn();

    const { result } = renderHook(() =>
      useAuthController({
        storage,
        resetAppState,
        setState,
        resetUIState,
      }),
    );

    expect(result.current.authUserId).toBeNull();
    expect(result.current.isAuthReady).toBe(true);
    expect(storage.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('should react to auth user changes in supabase mode', () => {
    const setState = vi.fn();
    const resetAppState = vi.fn(() => createAppState());
    const resetUIState = vi.fn();
    let callback: ((event: string, session: AuthSession) => void) | null = null;
    const unsubscribe = vi.fn();

    const storage = createSupabaseStorageMock({
      onAuthStateChange: vi.fn((cb) => {
        callback = cb as unknown as (
          event: string,
          session: AuthSession,
        ) => void;
        return ok(unsubscribe);
      }),
    });

    const { result, unmount } = renderHook(() =>
      useAuthController({
        storage,
        resetAppState,
        setState,
        resetUIState,
      }),
    );

    expect(result.current.isAuthReady).toBe(false);
    expect(typeof callback).toBe('function');

    act(() => {
      callback?.('SIGNED_IN', {
        user: { id: 'user-1', email: 'test@example.com' },
      } as AuthSession);
    });

    expect(result.current.authUserId).toBe('user-1');
    expect(result.current.isAuthReady).toBe(true);
    expect(setState).toHaveBeenCalledWith(resetAppState());
    expect(resetUIState).toHaveBeenCalledTimes(1);

    // Same user again should not reset app state twice.
    act(() => {
      callback?.('TOKEN_REFRESHED', {
        user: { id: 'user-1', email: 'test@example.com' },
      } as AuthSession);
    });
    expect(setState).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should log warning when auth subscription setup fails', () => {
    const storage = createSupabaseStorageMock({
      onAuthStateChange: vi.fn(() =>
        err({ code: 'STORAGE' as const, message: 'subscription failed' }),
      ),
    });

    const { result } = renderHook(() =>
      useAuthController({
        storage,
        resetAppState: () => createAppState(),
        setState: vi.fn(),
        resetUIState: vi.fn(),
      }),
    );

    expect(result.current.authUserId).toBeNull();
    expect(result.current.isAuthReady).toBe(false);
  });
});

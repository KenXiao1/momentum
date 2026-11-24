import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseStorage } from '../../../infra/storage/supabase/SupabaseStorage';
import { supabase } from '../../../lib/supabase';
import {
  createInitialNavigationState,
  navigationStore,
} from '../../../stores/navigationStore';
import { createAppState } from '../../../test/factories';
import {
  rejectSupabaseRequests,
  resetSupabaseMockState,
} from '../../../test/mocks/supabaseMocks';
import type { AppState } from '../../../types';
import { useAppDataLoad } from '../useAppDataLoad';

const storage = new SupabaseStorage();

describe('useAppDataLoad over the Supabase HTTP boundary', () => {
  beforeEach(async () => {
    if (!supabase)
      throw new Error('Supabase integration client was not created');
    localStorage.clear();
    resetSupabaseMockState();
    storage.clearCache();
    navigationStore.setState(createInitialNavigationState());
    const { error } = await supabase.auth.signInWithPassword({
      email: 'test@momentum.app',
      password: 'integration-password',
    });
    expect(error).toBeNull();
  });

  it.each(['active_sessions', 'scheduled_sessions'] as const)(
    'shows the load error instead of empty state when the %s read fails, then loads on retry',
    async (table) => {
      await storage.saveActiveSession({
        chainId: 'running',
        startedAt: new Date('2026-04-01T09:00:00.000Z'),
        duration: 25,
        isPaused: false,
        totalPausedTime: 0,
      });
      await storage.setScheduledSession({
        chainId: 'scheduled',
        scheduledAt: new Date('2026-04-01T08:00:00.000Z'),
        expiresAt: new Date('2026-04-01T09:00:00.000Z'),
        auxiliarySignal: 'ring-bell',
      });
      rejectSupabaseRequests('GET', table, {
        status: 401,
        code: 'PGRST301',
        message: 'JWT expired',
      });
      const setState = vi.fn();

      const { result } = renderHook(() =>
        useAppDataLoad({ storage, isInitialized: true, setState }),
      );

      await waitFor(() => {
        expect(result.current.loadError?.message).toContain('JWT expired');
      });
      expect(result.current.isLoadingData).toBe(false);
      expect(setState).not.toHaveBeenCalled();

      act(() => result.current.retryDataLoad());

      await waitFor(() => {
        expect(setState).toHaveBeenCalledTimes(1);
      });
      expect(result.current.loadError).toBeNull();
      const applyLoad = setState.mock.calls[0][0] as (
        previous: AppState,
      ) => AppState;
      const loaded = applyLoad(createAppState());
      expect(loaded.activeSession).toMatchObject({ chainId: 'running' });
      expect(
        loaded.scheduledSessions.map((session) => session.chainId),
      ).toEqual(['scheduled']);
      expect(navigationStore.getState().currentView).toBe('focus');
    },
  );
});

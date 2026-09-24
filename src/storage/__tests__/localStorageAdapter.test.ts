import { describe, expect, it, vi } from 'vitest';
import { localStorageAdapter } from '../localStorageAdapter';

describe('localStorageAdapter capabilities', () => {
  it('returns NOT_SUPPORTED for cloud-only operations', async () => {
    const results = await Promise.all([
      localStorageAdapter.signIn('user@example.com', 'password'),
      localStorageAdapter.signUp('user@example.com', 'password'),
      localStorageAdapter.signOut(),
      localStorageAdapter.getGamblingSettings(),
      localStorageAdapter.toggleGamblingMode(),
      localStorageAdapter.createBettingSession('chain-1', 1200),
      localStorageAdapter.deleteBettingSession('session-1'),
      localStorageAdapter.completeTaskWithBetting('session-1', true),
      localStorageAdapter.placeBet({
        session_id: 'session-1',
        bet_amount: 1,
      }),
      localStorageAdapter.getUserAvailablePoints(),
      localStorageAdapter.getTodayBetAmount(),
      localStorageAdapter.performDailyCheckin(),
      localStorageAdapter.getUserCheckinStats(),
    ]);

    expect(results).toHaveLength(13);
    for (const result of results) {
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'NOT_SUPPORTED' },
      });
    }
  });

  it('reports unauthenticated local-mode defaults', async () => {
    const listener = vi.fn();
    const subscriptionResult = localStorageAdapter.onAuthStateChange(listener);

    await expect(localStorageAdapter.getCurrentUser()).resolves.toEqual({
      ok: true,
      value: null,
    });
    await expect(localStorageAdapter.isUserAuthenticated()).resolves.toEqual({
      ok: true,
      value: false,
    });
    await expect(localStorageAdapter.waitForAuthentication()).resolves.toEqual({
      ok: true,
      value: { user: null, isAuthenticated: false },
    });
    await expect(localStorageAdapter.isGamblingModeEnabled()).resolves.toEqual({
      ok: true,
      value: false,
    });
    expect(subscriptionResult).toEqual({
      ok: true,
      value: expect.any(Function),
    });

    if (subscriptionResult.ok) subscriptionResult.value();
    expect(listener).not.toHaveBeenCalled();
  });
});

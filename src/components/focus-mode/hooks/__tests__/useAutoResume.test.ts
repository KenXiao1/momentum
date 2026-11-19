import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession } from '../../../../types';
import { localPreferences } from '../../../../utils/localPreferences';
import { useAutoResume } from '../useAutoResume';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function createSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    chainId: 'chain-1',
    startedAt: new Date('2026-03-01T09:30:00.000Z'),
    duration: 45,
    isPaused: false,
    totalPausedTime: 0,
    ...overrides,
  } as ActiveSession;
}

function renderAutoResume(session: ActiveSession, onResume = vi.fn()) {
  const view = renderHook(
    ({ current }) => useAutoResume({ session: current, onResume }),
    { initialProps: { current: session } },
  );
  return { ...view, onResume };
}

describe('useAutoResume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localPreferences.clearAutoResume();
  });

  afterEach(() => {
    vi.useRealTimers();
    localPreferences.clearAutoResume();
  });

  it('counts down a scheduled resume and resumes when it comes due', () => {
    const paused = createSession({ isPaused: true, pausedAt: NOW });
    const { result, onResume } = renderAutoResume(paused);

    act(() => result.current.scheduleAutoResume(1));

    expect(result.current.autoResumeAt).toBe(NOW.getTime() + 60_000);
    expect(result.current.resumeCountdown).toBe(60);
    expect(localPreferences.getAutoResume()?.chainId).toBe('chain-1');

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.resumeCountdown).toBe(59);

    act(() => vi.advanceTimersByTime(59_000));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(result.current.autoResumeAt).toBeNull();
    expect(result.current.resumeCountdown).toBe(0);
    expect(localPreferences.getAutoResume()).toBeNull();
  });

  it('restores a persisted schedule for the same paused session', () => {
    const paused = createSession({ isPaused: true, pausedAt: NOW });
    localPreferences.setAutoResume({
      chainId: paused.chainId,
      startedAt: paused.startedAt.toISOString(),
      resumeAt: new Date(NOW.getTime() + 30_000).toISOString(),
    });

    const { result, onResume } = renderAutoResume(paused);

    expect(result.current.autoResumeAt).toBe(NOW.getTime() + 30_000);
    expect(result.current.resumeCountdown).toBe(30);

    act(() => vi.advanceTimersByTime(30_000));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('ignores a persisted schedule that belongs to another session', () => {
    const paused = createSession({ isPaused: true, pausedAt: NOW });
    localPreferences.setAutoResume({
      chainId: 'other-chain',
      startedAt: paused.startedAt.toISOString(),
      resumeAt: new Date(NOW.getTime() + 30_000).toISOString(),
    });

    const { result } = renderAutoResume(paused);

    expect(result.current.autoResumeAt).toBeNull();
  });

  it('resumes at once when the restored schedule is already due', () => {
    const paused = createSession({ isPaused: true, pausedAt: NOW });
    localPreferences.setAutoResume({
      chainId: paused.chainId,
      startedAt: paused.startedAt.toISOString(),
      resumeAt: new Date(NOW.getTime() - 1000).toISOString(),
    });

    const { result, onResume } = renderAutoResume(paused);
    act(() => vi.advanceTimersByTime(0));

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(result.current.autoResumeAt).toBeNull();
    expect(localPreferences.getAutoResume()).toBeNull();
  });

  it('drops the schedule when the session is resumed by other means', () => {
    const paused = createSession({ isPaused: true, pausedAt: NOW });
    const { result, rerender, onResume } = renderAutoResume(paused);
    act(() => result.current.scheduleAutoResume(5));

    rerender({ current: { ...paused, isPaused: false, pausedAt: undefined } });

    expect(result.current.autoResumeAt).toBeNull();
    expect(result.current.resumeCountdown).toBe(0);
    expect(localPreferences.getAutoResume()).toBeNull();
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(onResume).not.toHaveBeenCalled();
  });

  it('counts elapsed pause time and resets it after resuming', () => {
    const paused = createSession({ isPaused: true, pausedAt: NOW });
    const { result, rerender } = renderAutoResume(paused);

    expect(result.current.elapsedPauseTime).toBe(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsedPauseTime).toBe(3);

    rerender({ current: { ...paused, isPaused: false, pausedAt: undefined } });
    expect(result.current.elapsedPauseTime).toBe(0);
  });

  it('cancels a schedule on request without resuming', () => {
    const paused = createSession({ isPaused: true, pausedAt: NOW });
    const { result, onResume } = renderAutoResume(paused);
    act(() => result.current.scheduleAutoResume(1));

    act(() => result.current.clearAutoResumeSchedule());
    act(() => vi.advanceTimersByTime(60_000));

    expect(onResume).not.toHaveBeenCalled();
    expect(result.current.autoResumeAt).toBeNull();
    expect(localPreferences.getAutoResume()).toBeNull();
  });
});

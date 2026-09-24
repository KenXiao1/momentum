import { createTranslator } from '../../../../i18n/translate';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRSIPTimers } from '../useRSIPTimers';

const requestPermissionMock = vi.hoisted(() => vi.fn(async () => true));
const notifyTimerCompletedMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: {
    requestPermission: requestPermissionMock,
    notifyTimerCompleted: notifyTimerCompletedMock,
  },
}));

describe('useRSIPTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('requests permission when a timer starts', () => {
    const { result } = renderHook(() => useRSIPTimers(createTranslator('en')));

    act(() => {
      result.current.handleStartTimer('node-1', 1);
    });

    expect(requestPermissionMock).toHaveBeenCalledWith('feature');
  });

  it('emits completion notification when timer expires', () => {
    const { result } = renderHook(() => useRSIPTimers(createTranslator('en')));

    act(() => {
      result.current.handleStartTimer('node-1', 1);
    });

    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1000);
    });

    expect(notifyTimerCompletedMock).toHaveBeenCalledWith(
      'Timer complete',
      'RSIP timer has ended',
    );
  });
});

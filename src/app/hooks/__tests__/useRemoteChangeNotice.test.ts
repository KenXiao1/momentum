import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestStorage } from '../../../test/factories';
import {
  MIN_BACKGROUND_MS,
  useRemoteChangeNotice,
} from '../useRemoteChangeNotice';

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

function storageWithFingerprints(...values: (string | null | Error)[]) {
  const getSyncFingerprint = vi.fn(async () => {
    const next = values.shift() ?? null;
    if (next instanceof Error) throw next;
    return next;
  });
  return {
    storage: createTestStorage({ getSyncFingerprint }),
    getSyncFingerprint,
  };
}

async function leaveAndReturn(awayMs: number) {
  await act(async () => setVisibility('hidden'));
  vi.setSystemTime(Date.now() + awayMs);
  await act(async () => setVisibility('visible'));
}

describe('useRemoteChangeNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a notice when the data changed while the app was away', async () => {
    const { storage } = storageWithFingerprints('before', 'after');
    const { result } = renderHook(() => useRemoteChangeNotice(storage, true));

    await leaveAndReturn(MIN_BACKGROUND_MS);

    await waitFor(() => expect(result.current.hasRemoteChanges).toBe(true));
    act(() => result.current.dismiss());
    expect(result.current.hasRemoteChanges).toBe(false);
  });

  it('stays quiet when nothing changed', async () => {
    const { storage, getSyncFingerprint } = storageWithFingerprints(
      'same',
      'same',
    );
    const { result } = renderHook(() => useRemoteChangeNotice(storage, true));

    await leaveAndReturn(MIN_BACKGROUND_MS);

    await waitFor(() => expect(getSyncFingerprint).toHaveBeenCalledTimes(2));
    expect(result.current.hasRemoteChanges).toBe(false);
  });

  it('skips the comparison after a short absence', async () => {
    const { storage, getSyncFingerprint } = storageWithFingerprints(
      'before',
      'after',
    );
    const { result } = renderHook(() => useRemoteChangeNotice(storage, true));

    await leaveAndReturn(MIN_BACKGROUND_MS - 1);

    expect(getSyncFingerprint).toHaveBeenCalledTimes(1);
    expect(result.current.hasRemoteChanges).toBe(false);
  });

  it('cannot compare when a read fails or there is no fingerprint', async () => {
    const { storage } = storageWithFingerprints(new Error('offline'), 'after');
    const { result } = renderHook(() => useRemoteChangeNotice(storage, true));
    await leaveAndReturn(MIN_BACKGROUND_MS);

    const local = storageWithFingerprints(null, null).storage;
    const { result: localResult } = renderHook(() =>
      useRemoteChangeNotice(local, true),
    );
    await leaveAndReturn(MIN_BACKGROUND_MS);

    expect(result.current.hasRemoteChanges).toBe(false);
    expect(localResult.current.hasRemoteChanges).toBe(false);
  });

  it('does not watch while data is loading or failed to load', async () => {
    const { storage, getSyncFingerprint } = storageWithFingerprints(
      'before',
      'after',
    );
    renderHook(() => useRemoteChangeNotice(storage, false));

    await leaveAndReturn(MIN_BACKGROUND_MS);

    expect(getSyncFingerprint).not.toHaveBeenCalled();
  });
});

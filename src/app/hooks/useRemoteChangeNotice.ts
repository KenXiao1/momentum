import { useEffect, useState } from 'react';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { fireAndForget } from '../../utils/fireAndForget';

/** Shorter trips to another tab or app are not worth a server round trip. */
export const MIN_BACKGROUND_MS = 30_000;

/**
 * Notices data another device changed while this app was in the background.
 * The fingerprint is read when the page is hidden and again when it returns;
 * a difference shows a notice. Nothing reloads by itself, so an edit in
 * progress is never replaced without the user's choice.
 */
export function useRemoteChangeNotice(
  storage: MomentumStorage,
  enabled: boolean,
) {
  const [noticeFor, setNoticeFor] = useState<MomentumStorage | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let hiddenAt: number | null = null;
    let before: Promise<string | null> | null = null;

    // best-effort: a failed read only means this trip cannot be compared.
    const read = () => storage.getSyncFingerprint().catch(() => null);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        before = read();
        return;
      }
      const leftAt = hiddenAt;
      const baseline = before;
      hiddenAt = null;
      before = null;
      if (leftAt === null || !baseline) return;
      if (Date.now() - leftAt < MIN_BACKGROUND_MS) return;
      fireAndForget(
        Promise.all([baseline, read()]).then(([previous, current]) => {
          if (cancelled || previous === null || current === null) return;
          if (previous !== current) setNoticeFor(storage);
        }),
        { label: 'remote-change-check' },
      );
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, storage]);

  return {
    hasRemoteChanges: noticeFor === storage,
    dismiss: () => setNoticeFor(null),
  };
}

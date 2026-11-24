import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { hasStorageCapability } from '../../storage/ports';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorMessage';

interface UseAuthControllerParams {
  storage: MomentumStorage;
  resetAppState: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  resetUIState?: () => void;
}

interface AuthControllerResult {
  authUserId: string | null;
  isAuthReady: boolean;
}

/**
 * Manages authentication state for Supabase storage.
 * Listens for auth state changes and resets app state when user changes.
 */
export function useAuthController({
  storage,
  resetAppState,
  setState,
  resetUIState,
}: UseAuthControllerParams): AuthControllerResult {
  // The user id is reported by the storage it came from; it is only current
  // while that storage is active and supports auth.
  const [authSnapshot, setAuthSnapshot] = useState<{
    storage: MomentumStorage;
    userId: string | null;
  } | null>(null);
  const prevAuthUserIdRef = useRef<string | null>(null);
  const canUseAuth = hasStorageCapability(storage, 'auth');
  const authUserId =
    canUseAuth && authSnapshot?.storage === storage
      ? authSnapshot.userId
      : null;

  useEffect(() => {
    if (!canUseAuth) {
      prevAuthUserIdRef.current = null;
      return;
    }

    const unsubscribeResult = storage.onAuthStateChange((event, session) => {
      const nextUserId = session.user?.id ?? null;
      setAuthSnapshot({ storage, userId: nextUserId });

      const prevUserId = prevAuthUserIdRef.current;
      if (prevUserId !== nextUserId) {
        prevAuthUserIdRef.current = nextUserId;
        logger.debug('AUTH_CONTROLLER', 'Auth user changed', {
          event,
          prevUserId,
          nextUserId,
        });
        setState(resetAppState());
        resetUIState?.();
      }
    });

    if (!unsubscribeResult.ok) {
      logger.warn(
        'AUTH_CONTROLLER',
        'Failed to subscribe to auth state changes',
        { message: unsubscribeResult.error.message },
        toError(unsubscribeResult.error),
      );
      return;
    }

    return () => unsubscribeResult.value();
  }, [canUseAuth, storage, resetAppState, resetUIState, setState]);

  const isAuthReady = !canUseAuth || Boolean(authUserId);

  return {
    authUserId,
    isAuthReady,
  };
}

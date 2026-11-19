import { useState, useEffect, useCallback, useRef } from 'react';
import { localPreferences, type CanvasState } from '../utils/localPreferences';

export type { CanvasState };

const DEBOUNCE_MS = 500;

export function useCanvasState() {
  // Read synchronously from localStorage on mount, so state is loaded at once.
  const [savedState, setSavedState] = useState<CanvasState | null>(
    () => localPreferences.getCanvasState() ?? null,
  );
  const isLoaded = true;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save state to localStorage with debounce
  const saveCanvasState = useCallback((state: CanvasState) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      localPreferences.setCanvasState(state);
      setSavedState(state);
    }, DEBOUNCE_MS);
  }, []);

  // Clear saved state
  const clearCanvasState = useCallback(() => {
    localPreferences.clearCanvasState();
    setSavedState(null);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    savedState,
    isLoaded,
    saveCanvasState,
    clearCanvasState,
  };
}

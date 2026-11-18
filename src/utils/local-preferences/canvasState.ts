import { LOCAL_STORAGE_KEYS } from './keys';
import type { CanvasState } from './types';

export function getCanvasState(): CanvasState | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.RSIP_CANVAS_STATE);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as CanvasState;
    if (
      typeof parsed.scale === 'number' &&
      typeof parsed.positionX === 'number' &&
      typeof parsed.positionY === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCanvasState(state: CanvasState): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.RSIP_CANVAS_STATE,
      JSON.stringify(state),
    );
  } catch {
    // best-effort: a lost canvas position only resets the RSIP view on next open
  }
}

export function clearCanvasState(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.RSIP_CANVAS_STATE);
  } catch {
    // best-effort: a lost canvas position only resets the RSIP view on next open
  }
}

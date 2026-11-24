export type Platform = 'web' | 'tauri-desktop' | 'tauri-mobile';

function hasTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  if ('__TAURI_INTERNALS__' in window) return true;
  if ('__TAURI__' in window) return true;
  if (window.location.protocol === 'tauri:') return true;
  return /\bTauri\b/i.test(navigator.userAgent);
}

function detectPlatform(): Platform {
  if (!hasTauriRuntime()) return 'web';

  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMobileUA ? 'tauri-mobile' : 'tauri-desktop';
}

export const platform: Platform = detectPlatform();
export const isTauri = platform !== 'web';
export const isTauriDesktop = platform === 'tauri-desktop';
export const isTauriMobile = platform === 'tauri-mobile';
export const isWeb = platform === 'web';

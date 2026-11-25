/**
 * What an email link from Supabase Auth asked the app to do when it opened:
 * continue a password reset, or report that the link failed (expired or
 * already used). Supabase's implicit flow puts both in the URL hash.
 */
export type AuthRedirect = 'none' | 'password-recovery' | 'invalid-link';

export function parseAuthRedirect(hash: string): AuthRedirect {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('type') === 'recovery' && params.has('access_token'))
    return 'password-recovery';
  if (params.has('error_code') || params.has('error')) return 'invalid-link';
  return 'none';
}

let initialRedirect: AuthRedirect = 'none';

/**
 * Records the redirect the app was opened with. main.tsx calls this before
 * rendering because the Supabase SDK, which loads later, consumes the hash of
 * a recovery link. A failed link's hash is removed here so a reload does not
 * report it again; the SDK has nothing to do with it.
 */
export function captureInitialAuthRedirect(
  win: Pick<Window, 'location' | 'history'> = window,
): void {
  initialRedirect = parseAuthRedirect(win.location.hash);
  if (initialRedirect === 'invalid-link')
    win.history.replaceState(
      win.history.state,
      '',
      `${win.location.pathname}${win.location.search}`,
    );
}

export function getInitialAuthRedirect(): AuthRedirect {
  return initialRedirect;
}

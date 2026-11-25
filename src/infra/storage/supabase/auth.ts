import type {
  AuthSession,
  AuthStateChangeEvent,
  AuthUser,
  AuthenticationResult,
} from '../../../domain/auth';
import type { AppError } from '../../../domain/errors';
import { toAppError } from '../../../domain/errors';
import { err, ok } from '../../../domain/result';
import { isTauri } from '../../../utils/platform';
import type { Result } from '../../../domain/result';
import type { User } from '@supabase/supabase-js';
import { purgeCachedApiResponses } from '../../../utils/apiResponseCache';
import { fireAndForget } from '../../../utils/fireAndForget';
import {
  getCurrentUser as supabaseGetCurrentUser,
  isUserAuthenticated as supabaseIsUserAuthenticated,
  signIn as supabaseSignIn,
  signOut as supabaseSignOut,
  signUp as supabaseSignUp,
  supabase,
  waitForAuthentication as supabaseWaitForAuthentication,
} from '../../../lib/supabase';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    userMetadata: user.user_metadata,
  };
}

function messageToAppError(message: string, cause?: unknown): AppError {
  const normalized = message.toLowerCase();
  if (normalized.includes('not configured'))
    return { code: 'NOT_CONFIGURED', message, cause };
  if (normalized.includes('network'))
    return { code: 'NETWORK', message, cause };
  if (normalized.includes('authenticated') || normalized.includes('auth'))
    return { code: 'NOT_AUTHENTICATED', message, cause };
  return { code: 'UNKNOWN', message, cause };
}

export async function getCurrentUser(): Promise<
  Result<AuthUser | null, AppError>
> {
  if (!supabase)
    return err({ code: 'NOT_CONFIGURED', message: 'Supabase not configured' });
  const user = await supabaseGetCurrentUser();
  return ok(user ? toAuthUser(user) : null);
}

export async function waitForAuthentication(
  maxWaitTime: number = 10000,
): Promise<Result<AuthenticationResult, AppError>> {
  if (!supabase)
    return err({ code: 'NOT_CONFIGURED', message: 'Supabase not configured' });
  const res = await supabaseWaitForAuthentication(maxWaitTime);
  return ok({
    user: res.user ? toAuthUser(res.user) : null,
    isAuthenticated: res.isAuthenticated,
  });
}

export async function isUserAuthenticated(): Promise<
  Result<boolean, AppError>
> {
  if (!supabase) return ok(false);
  const isAuth = await supabaseIsUserAuthenticated();
  return ok(isAuth);
}

export async function signUp(
  email: string,
  password: string,
): Promise<Result<void, AppError>> {
  const { error } = await supabaseSignUp(email, password);
  if (error) return err(messageToAppError(error.message, error));
  return ok(undefined);
}

export async function signIn(
  email: string,
  password: string,
): Promise<Result<void, AppError>> {
  const { error } = await supabaseSignIn(email, password);
  if (error) return err(messageToAppError(error.message, error));
  return ok(undefined);
}

export async function signOut(): Promise<Result<void, AppError>> {
  const { error } = await supabaseSignOut();
  if (error) return err(messageToAppError(error.message, error));
  fireAndForget(purgeCachedApiResponses(), { label: 'purge-api-cache' });
  return ok(undefined);
}

const NOT_CONFIGURED: AppError = {
  code: 'NOT_CONFIGURED',
  message: 'Supabase not configured',
};

/**
 * Where the reset email sends the browser. The web app handles the recovery
 * link itself; native builds have no deep link, so Supabase falls back to the
 * project's Site URL (the hosted web app) and the user signs in again here.
 */
function passwordResetRedirect(): string | undefined {
  if (isTauri || typeof window === 'undefined') return undefined;
  return window.location.origin;
}

function isInvalidCredentials(error: { code?: string; message: string }) {
  return (
    error.code === 'invalid_credentials' ||
    /invalid login credentials/i.test(error.message)
  );
}

export async function requestPasswordReset(
  email: string,
): Promise<Result<void, AppError>> {
  if (!supabase) return err(NOT_CONFIGURED);
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirect(),
    });
    if (error) return err(messageToAppError(error.message, error));
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, 'Password reset request failed'));
  }
}

export async function updatePassword(
  password: string,
): Promise<Result<void, AppError>> {
  if (!supabase) return err(NOT_CONFIGURED);
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return err(messageToAppError(error.message, error));
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, 'Password update failed'));
  }
}

export async function deleteAccount(
  currentPassword: string,
): Promise<Result<void, AppError>> {
  const client = supabase;
  if (!client) return err(NOT_CONFIGURED);
  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (userError || !user?.email)
      return err({
        code: 'NOT_AUTHENTICATED',
        message: userError?.message ?? 'User not authenticated',
        cause: userError,
      });

    // Re-check the password so an unattended signed-in device cannot be used
    // to delete the account.
    const { error: passwordError } = await client.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (passwordError) {
      if (isInvalidCredentials(passwordError))
        return err({
          code: 'INVALID_CREDENTIALS',
          message: passwordError.message,
          cause: passwordError,
        });
      return err(messageToAppError(passwordError.message, passwordError));
    }

    const { error: deleteError } = await client.rpc('delete_my_account');
    if (deleteError) {
      // PostgREST answers PGRST202 while the migration is not applied yet.
      if (deleteError.code === 'PGRST202')
        return err({
          code: 'NOT_SUPPORTED',
          message: 'Account deletion is not available on this server yet',
          cause: deleteError,
        });
      return err({
        code: 'STORAGE',
        message: deleteError.message || 'Account deletion failed',
        cause: deleteError,
      });
    }

    // The account is gone, so only this device's stored session is cleared;
    // a global sign-out would ask the server about a user that no longer exists.
    await client.auth.signOut({ scope: 'local' });
    fireAndForget(purgeCachedApiResponses(), { label: 'purge-api-cache' });
    return ok(undefined);
  } catch (error) {
    return err(toAppError(error, 'Account deletion failed'));
  }
}

export function onAuthStateChange(
  callback: (event: AuthStateChangeEvent, session: AuthSession) => void,
): Result<() => void, AppError> {
  if (!supabase)
    return err({ code: 'NOT_CONFIGURED', message: 'Supabase not configured' });

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, { user: session?.user ? toAuthUser(session.user) : null });
  });

  return ok(() => data.subscription.unsubscribe());
}

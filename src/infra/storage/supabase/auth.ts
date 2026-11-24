import type {
  AuthSession,
  AuthStateChangeEvent,
  AuthUser,
  AuthenticationResult,
} from '../../../domain/auth';
import type { AppError } from '../../../domain/errors';
import { err, ok } from '../../../domain/result';
import type { Result } from '../../../domain/result';
import type { User } from '@supabase/supabase-js';
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
  return ok(undefined);
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

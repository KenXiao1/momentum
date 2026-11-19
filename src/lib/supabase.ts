import { createClient, type User } from '@supabase/supabase-js';
import { Database } from './database.types';
import { logger } from '../utils/logger';
import { toError } from '../utils/errorMessage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 检查环境变量是否存在，如果不存在则创建一个模拟客户端
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        // Retries belong to infra/storage/supabase/retry.ts, which also waits
        // for authentication. supabase-js >=2.119 retries GET/HEAD by
        // default; leaving both on multiplies attempts and backoff delays.
        db: { retry: false },
      })
    : null;

interface AuthenticationResult {
  user: User | null;
  isAuthenticated: boolean;
}

// Auth helpers
export const getCurrentUser = async (): Promise<User | null> => {
  if (!supabase) return null;
  try {
    // Fast path: prefer the locally cached session user to avoid a network roundtrip.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (!sessionError && session?.user) {
      return session.user;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      const err =
        userError instanceof Error ? userError : new Error(String(userError));
      logger.warn('SUPABASE', 'Failed to get current user', undefined, err);
      return null;
    }

    return user;
  } catch (error) {
    logger.warn(
      'SUPABASE',
      'Failed to get current user',
      undefined,
      toError(error),
    );
    return null;
  }
};

/**
 * Wait for authentication to be ready with retry mechanism
 * This is crucial for import operations where authentication might still be initializing
 */
export const waitForAuthentication = async (
  maxWaitTime: number = 10000,
): Promise<AuthenticationResult> => {
  if (!supabase) {
    return { user: null, isAuthenticated: false };
  }

  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Check authentication session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        const err =
          sessionError instanceof Error
            ? sessionError
            : new Error(String(sessionError));
        logger.warn('SUPABASE', 'Session check error', undefined, err);
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        continue;
      }

      if (session?.user) {
        // Double-check with getUser to ensure RLS will work
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (user && !userError) {
          logger.debug('SUPABASE', 'Authentication confirmed', {
            userId: user.id,
          });
          return { user, isAuthenticated: true };
        }
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    } catch (error) {
      logger.warn(
        'SUPABASE',
        'Authentication check failed',
        undefined,
        toError(error),
      );
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
  }

  logger.warn('SUPABASE', 'Authentication wait timeout reached');
  return { user: null, isAuthenticated: false };
};

/**
 * Check if user is currently authenticated and ready for RLS operations
 */
export const isUserAuthenticated = async (): Promise<boolean> => {
  if (!supabase) return false;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return false;

    // Double-check with getUser to ensure RLS will work
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch (error) {
    logger.warn(
      'SUPABASE',
      'Authentication check failed',
      undefined,
      toError(error),
    );
    return false;
  }
};

export const signUp = async (email: string, password: string) => {
  if (!supabase) {
    return { data: null, error: { message: 'Supabase not configured' } };
  }
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  } catch {
    return {
      data: null,
      error: { message: 'Network error: Unable to connect to Supabase' },
    };
  }
};

export const signIn = async (email: string, password: string) => {
  if (!supabase) {
    return { data: null, error: { message: 'Supabase not configured' } };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  } catch {
    return {
      data: null,
      error: { message: 'Network error: Unable to connect to Supabase' },
    };
  }
};

export const signOut = async () => {
  if (!supabase) {
    return { error: { message: 'Supabase not configured' } };
  }
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch {
    return {
      error: { message: 'Network error: Unable to connect to Supabase' },
    };
  }
};

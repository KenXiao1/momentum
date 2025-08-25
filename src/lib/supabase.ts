import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 检查环境变量是否存在，如果不存在则创建一个模拟客户端
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export interface AuthenticationResult {
  user: any | null;
  isAuthenticated: boolean;
}

// Auth helpers
export const getCurrentUser = async () => {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.warn('Failed to get current user:', error);
    return null;
  }
};

/**
 * Wait for authentication to be ready with retry mechanism
 * This is crucial for import operations where authentication might still be initializing
 */
export const waitForAuthentication = async (maxWaitTime: number = 10000): Promise<AuthenticationResult> => {
  if (!supabase) {
    return { user: null, isAuthenticated: false };
  }

  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Check authentication session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn('Session check error:', sessionError);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }

      if (session?.user) {
        // Double-check with getUser to ensure RLS will work
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (user && !userError) {
          console.log('Authentication confirmed for user:', user.id);
          return { user, isAuthenticated: true };
        }
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      console.warn('Authentication check failed:', error);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  console.warn('Authentication wait timeout reached');
  return { user: null, isAuthenticated: false };
};

/**
 * Check if user is currently authenticated and ready for RLS operations
 */
export const isUserAuthenticated = async (): Promise<boolean> => {
  if (!supabase) return false;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;
    
    // Double-check with getUser to ensure RLS will work
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch (error) {
    console.warn('Authentication check failed:', error);
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
    return { data: null, error: { message: 'Network error: Unable to connect to Supabase' } };
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
    return { data: null, error: { message: 'Network error: Unable to connect to Supabase' } };
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
    return { error: { message: 'Network error: Unable to connect to Supabase' } };
  }
};
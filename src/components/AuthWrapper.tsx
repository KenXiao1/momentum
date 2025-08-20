import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { AuthForm } from './AuthForm';
import { Loader2 } from 'lucide-react';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Failed to get session:', error);
        }
        console.log('Initial session check:', session?.user ? 'Logged in' : 'Not logged in');
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Session initialization error:', error);
        setUser(null);
      } finally {
        setLoading(false);
        setAuthInitialized(true);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Authentication state changed:', event, session?.user ? 'Logged in' : 'Not logged in');
        setUser(session?.user ?? null);
        if (!authInitialized) {
          setLoading(false);
          setAuthInitialized(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [authInitialized]);

  if (loading || !authInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Loader2 className="text-white animate-spin" size={24} />
          </div>
          <h2 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-2">
            正在验证身份...
          </h2>
          <p className="text-gray-600 dark:text-slate-400 font-mono text-sm">
            AUTHENTICATING
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <>{children}</>;
};
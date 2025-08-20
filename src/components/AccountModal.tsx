import React, { useState, useEffect } from 'react';
import { X, User, LogOut, AlertCircle } from 'lucide-react';
import { getCurrentUser, signOut } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUser();
    }
  }, [isOpen]);

  const loadUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.error('Failed to get user info:', err);
      setError('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      const { error } = await signOut();
      if (error) {
        setError(error.message);
      } else {
        onClose();
        // 页面会自动重新加载到登录界面
      }
    } catch (err) {
      console.error('Sign out failed:', err);
      setError('退出登录失败，请重试');
    } finally {
      setSigningOut(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100">
            账号管理
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-600 dark:text-slate-400 font-chinese">
                正在获取账号信息...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-red-500 dark:text-red-400" size={24} />
              </div>
              <p className="text-red-600 dark:text-red-400 font-chinese mb-4">
                {error}
              </p>
              <button
                onClick={loadUser}
                className="text-primary-500 hover:text-primary-600 font-medium transition-colors font-chinese"
              >
                重试
              </button>
            </div>
          ) : user ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-slate-700 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
                  <User className="text-white" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium font-chinese text-gray-900 dark:text-slate-100 mb-1">
                    当前账号
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 text-sm truncate">
                    {user.email}
                  </p>
                  {user.user_metadata?.full_name && (
                    <p className="text-gray-500 dark:text-slate-500 text-xs">
                      {user.user_metadata.full_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Account Details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-chinese text-gray-600 dark:text-slate-400">
                    注册时间
                  </span>
                  <span className="text-sm text-gray-900 dark:text-slate-100">
                    {new Date(user.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-chinese text-gray-600 dark:text-slate-400">
                    最后登录
                  </span>
                  <span className="text-sm text-gray-900 dark:text-slate-100">
                    {user.last_sign_in_at 
                      ? new Date(user.last_sign_in_at).toLocaleDateString('zh-CN')
                      : '首次登录'
                    }
                  </span>
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-6 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-3 hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-chinese border border-red-200 dark:border-red-800"
              >
                {signingOut ? (
                  <>
                    <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                    <span>正在退出...</span>
                  </>
                ) : (
                  <>
                    <LogOut size={20} />
                    <span>退出登录</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                <User className="text-gray-400 dark:text-slate-500" size={24} />
              </div>
              <p className="text-gray-600 dark:text-slate-400 font-chinese">
                未找到用户信息
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
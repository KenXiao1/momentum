import React, { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle } from 'lucide-react';

export const AuthForm: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('发生未知错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <i className="fas fa-rocket text-white text-2xl"></i>
          </div>
          <h1 className="text-4xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-2">
            Momentum
          </h1>
          <p className="text-gray-600 dark:text-slate-400 font-mono text-sm tracking-wider">
            CTDP PROTOCOL
          </p>
        </div>

        {/* Auth Form */}
        <div className="bento-card">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-2">
              {isSignUp ? '创建账户' : '登录账户'}
            </h2>
            <p className="text-gray-600 dark:text-slate-400 text-sm">
              {isSignUp ? '开始你的专注之旅' : '继续你的专注之旅'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
                <AlertCircle size={20} />
                <span className="text-sm font-chinese">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-gray-700 dark:text-slate-300 text-sm font-medium mb-3 font-chinese">
                邮箱地址
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-gray-400" size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="输入你的邮箱地址"
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl pl-12 pr-4 py-4 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 font-chinese"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-700 dark:text-slate-300 text-sm font-medium mb-3 font-chinese">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="text-gray-400" size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? '创建一个强密码' : '输入你的密码'}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl pl-12 pr-12 py-4 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 font-chinese"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {isSignUp && (
                <p className="text-gray-500 dark:text-slate-400 text-xs mt-2 font-chinese">
                  密码至少需要6个字符
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary hover:shadow-xl text-white px-6 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-3 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-chinese"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{isSignUp ? '创建中...' : '登录中...'}</span>
                </>
              ) : (
                <>
                  {isSignUp ? <User size={20} /> : <i className="fas fa-sign-in-alt"></i>}
                  <span>{isSignUp ? '创建账户' : '登录'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Form */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 dark:text-slate-400 text-sm font-chinese">
              {isSignUp ? '已经有账户了？' : '还没有账户？'}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="ml-2 text-primary-500 hover:text-primary-600 font-medium transition-colors"
              >
                {isSignUp ? '立即登录' : '立即注册'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 dark:text-slate-400 text-xs font-chinese">
            基于链式时延协议理论的专注力训练工具
          </p>
        </div>
      </div>
    </div>
  );
};
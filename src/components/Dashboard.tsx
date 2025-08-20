import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Chain, ScheduledSession, CompletionHistory, ChainTreeNode } from '../types';
import { ChainCard } from './ChainCard';
import { GroupCard } from './GroupCard';
import { ThemeToggle } from './ThemeToggle';
import { ImportExportModal } from './ImportExportModal';
import { VirtualizedChainList } from './VirtualizedChainList';
import { buildChainTree, getTopLevelChains } from '../utils/chainTree';
import { queryOptimizer } from '../utils/queryOptimizer';
import { getNextUnitInGroup } from '../utils/chainTree';
import { Download, TreePine, Trash2 } from 'lucide-react';
import { NotificationToggle } from './NotificationToggle';
import { RecycleBinModal } from './RecycleBinModal';
import { RecycleBinService } from '../services/RecycleBinService';
import { AccountModal } from './AccountModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { User } from 'lucide-react';
import { PerformanceMonitor } from './PerformanceMonitor';

interface DashboardProps {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  isLoading?: boolean;
  onCreateChain: () => void;
  onCreateTaskGroup?: () => void;
  onOpenRSIP?: () => void;
  onStartChain: (chainId: string) => void;
  onScheduleChain: (chainId: string) => void;
  onViewChainDetail: (chainId: string) => void;
  onCancelScheduledSession?: (chainId: string) => void;
  onCompleteBooking?: (chainId: string) => void;
  onDeleteChain: (chainId: string) => void;
  onImportChains: (chains: Chain[], options?: { history?: CompletionHistory[]; rsipNodes?: any[]; rsipMeta?: any; exceptionRules?: any[] }) => void;
  onRestoreChains?: (chainIds: string[]) => void;
  onPermanentDeleteChains?: (chainIds: string[]) => void;
  history?: CompletionHistory[];
  rsipNodes?: any[];
  rsipMeta?: any;
}

// Performance optimized Dashboard component with React.memo and proper memoization
export const Dashboard: React.FC<DashboardProps> = React.memo(({
  chains,
  scheduledSessions,
  isLoading = false,
  onCreateChain,
  onCreateTaskGroup,
  onStartChain,
  onScheduleChain,
  onViewChainDetail,
  onCancelScheduledSession,
  onCompleteBooking,
  onDeleteChain,
  onImportChains,
  onRestoreChains,
  onPermanentDeleteChains,
  history,
  rsipNodes,
  rsipMeta,
  onOpenRSIP,
}) => {
  const [showImportExport, setShowImportExport] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(process.env.NODE_ENV === 'development');
  const [recycleBinCount, setRecycleBinCount] = useState(0);
  
  // Only log in development mode to improve production performance
  if (process.env.NODE_ENV === 'development') {
    console.log('Dashboard - Received chains:', chains.length, chains.map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId })));
  }
  
  // Optimize chain tree building with deep memoization
  const chainTree = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Dashboard - Rebuilding chainTree, chains count:', chains.length);
    }
    return queryOptimizer.memoizedBuildChainTree(chains);
  }, [chains]);
  
  // Memoize top level chains calculation
  const topLevelChains = useMemo(() => {
    const result = getTopLevelChains(chainTree);
    if (process.env.NODE_ENV === 'development') {
      console.log('Dashboard - Top-level chains:', result.length, result.map(c => ({ id: c.id, name: c.name, type: c.type })));
    }
    return result;
  }, [chainTree]);

  // Optimize recycle bin stats loading with useCallback and proper dependency management
  const loadRecycleBinStats = useCallback(async () => {
    try {
      const stats = await RecycleBinService.getRecycleBinStats();
      setRecycleBinCount(stats.totalDeleted);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load recycle bin statistics:', error);
      }
    }
  }, []);

  // Only reload stats when chains count changes, not on every chain mutation
  const chainsCount = chains.length;
  useEffect(() => {
    loadRecycleBinStats();
  }, [chainsCount, loadRecycleBinStats]);

  // Memoize event handlers to prevent child component re-renders
  const handleShowImportExport = useCallback(() => setShowImportExport(true), []);
  const handleHideImportExport = useCallback(() => setShowImportExport(false), []);
  const handleShowRecycleBin = useCallback(() => setShowRecycleBin(true), []);
  const handleHideRecycleBin = useCallback(() => setShowRecycleBin(false), []);
  const handleShowAccountModal = useCallback(() => setShowAccountModal(true), []);
  const handleHideAccountModal = useCallback(() => setShowAccountModal(false), []);
  
  // Memoize restore and delete handlers to prevent recreating functions
  const handleRestore = useCallback(async (chainIds: string[]) => {
    if (onRestoreChains) {
      await onRestoreChains(chainIds);
      await loadRecycleBinStats();
    }
  }, [onRestoreChains, loadRecycleBinStats]);
  
  const handlePermanentDelete = useCallback(async (chainIds: string[]) => {
    if (onPermanentDeleteChains) {
      await onPermanentDeleteChains(chainIds);
      await loadRecycleBinStats();
    }
  }, [onPermanentDeleteChains, loadRecycleBinStats]);
  
  const handleImport = useCallback((newChains: Chain[], options?: { history?: CompletionHistory[]; rsipNodes?: any[]; rsipMeta?: any; exceptionRules?: any[] }) => {
    onImportChains(newChains, options);
  }, [onImportChains]);
  
  // Memoize scheduled session lookup to prevent recalculation on every render
  const getScheduledSession = useCallback((chainId: string) => {
    return scheduledSessions.find(session => session.chainId === chainId);
  }, [scheduledSessions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Theme toggle in header */}
        <div className="flex justify-end items-center space-x-4 mb-6">
          {isSupabaseConfigured && (
            <button
              onClick={handleShowAccountModal}
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105"
              title="账号管理"
            >
              <User size={18} />
              <span className="font-chinese text-sm">账号</span>
            </button>
          )}
          <NotificationToggle />
          <ThemeToggle variant="dropdown" showLabel />
        </div>
        
        <header className="text-center mb-16 animate-fade-in">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-16 h-16 rounded-3xl gradient-primary flex items-center justify-center shadow-xl">
              <i className="fas fa-rocket text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-5xl md:text-6xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-2">
                Momentum
              </h1>
              <p className="text-sm font-mono text-gray-600 dark:text-slate-400 tracking-wider uppercase">
                CTDP Protocol
              </p>
            </div>
          </div>
          
          <p className="text-gray-700 dark:text-slate-300 max-w-3xl mx-auto text-lg leading-relaxed font-chinese">
            基于链式时延协议理论，通过<span className="font-semibold text-primary-500">神圣座位原理</span>、
            <span className="font-semibold text-primary-500">下必为例原理</span>和
            <span className="font-semibold text-primary-500">线性时延原理</span>，
            帮助你建立强大的习惯链条
          </p>
        </header>

        {isLoading ? (
          <div className="text-center py-20 animate-slide-up">
            <div className="bento-card max-w-lg mx-auto">
              <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
              <h2 className="text-3xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-4">
                正在加载任务链...
              </h2>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                正在从云端同步您的数据
              </p>
            </div>
          </div>
        ) : (
        chains.length === 0 ? (
          <div className="text-center py-20 animate-slide-up">
            <div className="bento-card max-w-lg mx-auto">
              <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <i className="fas fa-link text-white text-2xl"></i>
              </div>
              <h2 className="text-3xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-4">
                创建你的第一条链
              </h2>
              <p className="text-gray-700 dark:text-slate-300 mb-8 leading-relaxed">
                链代表你想要持续做的任务。每次成功完成，你的记录就会增长一点。
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={onCreateChain}
                  className="gradient-primary hover:shadow-2xl text-white px-8 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-3 hover:scale-105 shadow-xl"
                >
                  <i className="fas fa-plus text-lg"></i>
                  <span className="font-chinese font-semibold">创建第一条链</span>
                </button>
                <button
                  onClick={handleShowImportExport}
                  className="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 px-6 py-4 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg"
                >
                  <Download size={16} />
                  <span className="font-chinese font-medium">数据管理</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-3xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-2">
                  你的任务链
                </h2>
                <p className="text-gray-600 dark:text-slate-400 font-mono text-sm tracking-wide">
                  YOUR TASK CHAINS
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleShowRecycleBin}
                  className="relative bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 px-4 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg"
                  title="回收箱"
                >
                  <Trash2 size={16} />
                  <span className="font-chinese font-medium">回收箱</span>
                  {recycleBinCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {recycleBinCount > 99 ? '99+' : recycleBinCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleShowImportExport}
                  className="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 px-4 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg"
                >
                  <Download size={16} />
                  <span className="font-chinese font-medium">数据管理</span>
                </button>
                <button
                  onClick={onOpenRSIP}
                  className="bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg"
                  title="国策树（RSIP）"
                >
                  <TreePine size={16} />
                  <span className="font-chinese font-medium">国策树</span>
                </button>
                <button
                  onClick={onCreateChain}
                  className="gradient-dark hover:shadow-xl text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg"
                >
                  <i className="fas fa-plus"></i>
                  <span className="font-chinese font-medium">新建链</span>
                </button>
                {onCreateTaskGroup && (
                  <button
                    onClick={onCreateTaskGroup}
                    className="bg-green-500 hover:bg-green-600 hover:shadow-xl text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105 shadow-lg"
                  >
                    <i className="fas fa-layer-group"></i>
                    <span className="font-chinese font-medium">新建任务群</span>
                  </button>
                )}
              </div>
            </div>

            <VirtualizedChainList
              topLevelChains={topLevelChains}
              getScheduledSession={getScheduledSession}
              onStartChain={onStartChain}
              onScheduleChain={onScheduleChain}
              onViewDetail={onViewChainDetail}
              onCancelScheduledSession={onCancelScheduledSession}
              onCompleteBooking={onCompleteBooking}
              onDelete={onDeleteChain}
            />
          </div>
        ))}
      </div>
      
      {/* Import/Export Modal */}
      {showImportExport && (
        <ImportExportModal
          chains={chains}
          history={history}
          rsipNodes={rsipNodes}
          rsipMeta={rsipMeta}
          onImport={handleImport}
          onClose={handleHideImportExport}
        />
      )}

      {/* Recycle Bin Modal */}
      {showRecycleBin && (
        <RecycleBinModal
          isOpen={showRecycleBin}
          onClose={handleHideRecycleBin}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
        />
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <AccountModal
          isOpen={showAccountModal}
          onClose={handleHideAccountModal}
        />
      )}
      {/* Performance Monitor (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceMonitor
          isVisible={showPerformanceMonitor}
          onToggle={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
        />
      )}
    </div>
  );
});

// Add display name for better debugging
Dashboard.displayName = 'Dashboard';
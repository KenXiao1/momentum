import React from 'react';
import { Chain, ScheduledSession, CompletionHistory } from '../types';
import { ChainCard } from './ChainCard';
import { GroupCard } from './GroupCard';
import { ThemeToggle } from './ThemeToggle';
import { ImportExportModal } from './ImportExportModal';
import { buildChainTree, getTopLevelChains } from '../utils/chainTree';
import { getNextUnitInGroup } from '../utils/chainTree';
import { Download, TreePine, Trash2 } from 'lucide-react';
import { NotificationToggle } from './NotificationToggle';
import { RecycleBinModal } from './RecycleBinModal';
import { RecycleBinService } from '../services/RecycleBinService';
import { AccountModal } from './AccountModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { User } from 'lucide-react';

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
  onImportChains: (chains: Chain[], options?: { history?: CompletionHistory[] }) => void;
  onRestoreChains?: (chainIds: string[]) => void;
  onPermanentDeleteChains?: (chainIds: string[]) => void;
  history?: CompletionHistory[];
}

export const Dashboard: React.FC<DashboardProps> = ({
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
  onOpenRSIP,
}) => {
  const [showImportExport, setShowImportExport] = React.useState(false);
  const [showRecycleBin, setShowRecycleBin] = React.useState(false);
  const [showAccountModal, setShowAccountModal] = React.useState(false);
  const [recycleBinCount, setRecycleBinCount] = React.useState(0);
  
  console.log('Dashboard - 收到的chains:', chains.length, chains.map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId })));
  
  // 构建任务树并获取顶层任务
  const chainTree = buildChainTree(chains);
  console.log('Dashboard - 构建的chainTree:', chainTree.length, chainTree.map(c => ({ id: c.id, name: c.name, type: c.type })));
  
  const topLevelChains = getTopLevelChains(chainTree);
  console.log('Dashboard - 顶层链条:', topLevelChains.length, topLevelChains.map(c => ({ id: c.id, name: c.name, type: c.type })));

  // 加载回收箱统计信息
  React.useEffect(() => {
    const loadRecycleBinStats = async () => {
      try {
        const stats = await RecycleBinService.getRecycleBinStats();
        setRecycleBinCount(stats.totalDeleted);
      } catch (error) {
        console.error('加载回收箱统计信息失败:', error);
      }
    };

    loadRecycleBinStats();
  }, [chains]); // 当链条变化时重新加载统计信息

  const getScheduledSession = (chainId: string) => {
    return scheduledSessions.find(session => session.chainId === chainId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Theme toggle in header */}
        <div className="flex justify-end items-center space-x-4 mb-6">
          {isSupabaseConfigured && (
            <button
              onClick={() => setShowAccountModal(true)}
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
                  onClick={() => setShowImportExport(true)}
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
                  onClick={() => setShowRecycleBin(true)}
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
                  onClick={() => setShowImportExport(true)}
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {topLevelChains.map(chainNode => (
                chainNode.type === 'group' ? (
                  (() => {
                    const nextUnit = getNextUnitInGroup(chainNode);
                    const session = getScheduledSession(nextUnit ? nextUnit.id : chainNode.id);
                    return (
                      <GroupCard
                        key={chainNode.id}
                        group={chainNode}
                        scheduledSession={session}
                        onStartChain={onStartChain}
                        onScheduleChain={onScheduleChain}
                        onViewDetail={onViewChainDetail}
                        onCancelScheduledSession={onCancelScheduledSession}
                        onCompleteBooking={onCompleteBooking}
                        onDelete={onDeleteChain}
                      />
                    );
                  })()
                ) : (
                  <ChainCard
                    key={chainNode.id}
                    chain={chainNode}
                    scheduledSession={getScheduledSession(chainNode.id)}
                    onStartChain={onStartChain}
                    onScheduleChain={onScheduleChain}
                    onViewDetail={onViewChainDetail}
                    onCancelScheduledSession={onCancelScheduledSession}
                    onCompleteBooking={onCompleteBooking}
                    onDelete={onDeleteChain}
                  />
                )
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Import/Export Modal */}
      {showImportExport && (
        <ImportExportModal
          chains={chains}
          history={history}
          onImport={(newChains, options) => onImportChains(newChains, options)}
          onClose={() => setShowImportExport(false)}
        />
      )}

      {/* Recycle Bin Modal */}
      {showRecycleBin && (
        <RecycleBinModal
          isOpen={showRecycleBin}
          onClose={() => setShowRecycleBin(false)}
          onRestore={async (chainIds) => {
            if (onRestoreChains) {
              await onRestoreChains(chainIds);
              // 重新加载回收箱统计信息
              const stats = await RecycleBinService.getRecycleBinStats();
              setRecycleBinCount(stats.totalDeleted);
            }
          }}
          onPermanentDelete={async (chainIds) => {
            if (onPermanentDeleteChains) {
              await onPermanentDeleteChains(chainIds);
              // 重新加载回收箱统计信息
              const stats = await RecycleBinService.getRecycleBinStats();
              setRecycleBinCount(stats.totalDeleted);
            }
          }}
        />
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
        />
      )}
    </div>
  );
};
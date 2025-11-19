import React, { useState, useEffect } from 'react';
import { Chain, ScheduledSession, ChainTreeNode } from '../types';
import { Play, Clock } from 'lucide-react';
import { formatTime, getTimeRemaining, formatDuration } from '../utils/time';
import { getChainTypeConfig } from '../utils/chainTree';
import { notificationManager } from '../utils/notifications';

interface ChainCardProps {
  chain: Chain | ChainTreeNode;
  scheduledSession?: ScheduledSession;
  onStartChain: (chainId: string) => void;
  onScheduleChain: (chainId: string) => void;
  onViewDetail: (chainId: string) => void;
  onCancelScheduledSession?: (chainId: string) => void;
  onDelete: (chainId: string) => void;
}

export const ChainCard: React.FC<ChainCardProps> = ({
  chain,
  scheduledSession,
  onStartChain,
  onScheduleChain,
  onViewDetail,
  onCancelScheduledSession,
  onDelete,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  
  // 获取实际的链条数据，确保显示最新的时长信息
  const actualChain = React.useMemo(() => {
    // 如果传入的是 ChainTreeNode，需要确保数据是最新的
    return chain;
  }, [chain]);

  const typeConfig = getChainTypeConfig(chain.type);

  // 计算通知时机
  const getNotificationThreshold = (durationMinutes: number) => {
    if (durationMinutes <= 3) return null; // 小于等于3分钟不通知
    const thresholdMinutes = Math.floor(durationMinutes / 3);
    return Math.min(thresholdMinutes, 1) * 60; // 转换为秒，最多1分钟
  };
  useEffect(() => {
    if (!scheduledSession) return;

    const notificationThreshold = getNotificationThreshold(chain.auxiliaryDuration);

    const updateTimer = () => {
      const remaining = getTimeRemaining(scheduledSession.expiresAt);
      setTimeRemaining(remaining);
      
      // 根据新逻辑显示警告通知
      if (notificationThreshold && remaining <= notificationThreshold && remaining > 0 && !hasShownWarning) {
        setHasShownWarning(true);
        const minutes = Math.max(1, Math.ceil(remaining / 60));
        notificationManager.notifyScheduleWarning(
          chain.name, 
          `${minutes}分钟`
        );
      }
      
      if (remaining <= 0) {
        // 预约失败通知
        notificationManager.notifyScheduleFailed(chain.name);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [scheduledSession, hasShownWarning, chain.name, chain.auxiliaryDuration]);

  // 重置警告状态当预约会话改变时
  React.useEffect(() => {
    setHasShownWarning(false);
  }, [scheduledSession?.scheduledAt, scheduledSession?.chainId]);

  const isScheduled = scheduledSession && timeRemaining > 0;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(chain.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="relative">
      <div 
        className="bento-card cursor-pointer group animate-scale-in"
        onClick={() => onViewDetail(chain.id)}
      >
        {/* Menu button */}
        <div className="absolute top-6 right-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 text-gray-400 hover:text-[#161615] transition-colors rounded-lg hover:bg-gray-100"
          >
            <i className="fas fa-ellipsis-h"></i>
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-2xl border border-gray-200 dark:border-slate-600 py-2 z-10 min-w-[140px]">
              <button
                onClick={handleDeleteClick}
                className="w-full px-4 py-3 text-left text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3 transition-colors"
              >
                <i className="fas fa-trash text-sm"></i>
                <span className="font-chinese font-medium">删除链条</span>
              </button>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 pr-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-8 h-8 rounded-xl ${typeConfig.bgColor} flex items-center justify-center`}>
                <i className={`${typeConfig.icon} ${typeConfig.color} text-sm`}></i>
              </div>
              <div>
                <h3 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100 group-hover:text-primary-500 transition-colors">
                  {chain.name}
                </h3>
                {chain.type !== 'unit' && (
                  <p className="text-xs font-mono text-gray-500 tracking-wide">
                    {typeConfig.name}
                  </p>
                )}
              </div>
            </div>
            <p className="text-gray-600 dark:text-slate-400 text-sm mb-3 font-mono tracking-wide">
              {chain.trigger}
            </p>
            <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed">
              {chain.description}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-primary-500/10 to-primary-600/5 dark:from-primary-500/20 dark:to-primary-600/10 border border-primary-200/50 dark:border-primary-400/30">
            <div className="flex items-center justify-center space-x-2 text-primary-500 mb-2">
              <i className="fas fa-fire text-lg"></i>
              <span className="text-3xl font-bold font-mono">#{chain.currentStreak}</span>
            </div>
            <div className="text-xs font-chinese text-gray-600 dark:text-slate-400 font-medium">主链记录</div>
          </div>
          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border border-blue-200/50 dark:border-blue-400/30">
            <div className="flex items-center justify-center space-x-2 text-blue-500 mb-2">
              <i className="fas fa-calendar-alt text-lg"></i>
              <span className="text-3xl font-bold font-mono">#{chain.auxiliaryStreak}</span>
            </div>
            <div className="text-xs font-chinese text-gray-600 dark:text-slate-400 font-medium">预约链记录</div>
          </div>
        </div>

        {/* Duration and completions */}
        <div className="flex items-center justify-between mb-6 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50">
          <div className="flex items-center space-x-2 text-gray-700 dark:text-slate-300">
            <Clock size={16} />
            <span className="font-medium">{formatTime(actualChain.duration)}</span>
          </div>
          <div className="text-gray-600 dark:text-slate-400 text-sm font-mono">
            {actualChain.totalCompletions} completion{(actualChain.totalCompletions === 0 || actualChain.totalCompletions === 1) ? '' : 's'}
          </div>
        </div>

        {/* Scheduled session */}
        {isScheduled && (
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 rounded-2xl p-4 mb-6 border border-blue-200/50 dark:border-blue-400/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-blue-600">
                <i className="fas fa-bell text-sm"></i>
                <span className="text-sm font-chinese font-medium">预约信号: {scheduledSession.auxiliarySignal}</span>
              </div>
              <div className="text-blue-700 dark:text-blue-400 font-mono font-bold text-lg">
                {formatDuration(timeRemaining)}
              </div>
            </div>
            <div className="text-blue-600 dark:text-blue-400 text-xs mb-3 font-chinese">
              请在时间结束前完成: {chain.auxiliaryCompletionTrigger}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelScheduledSession?.(chain.id);
              }}
              className="w-full bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 px-3 py-3 rounded-xl text-sm transition-colors duration-200 flex items-center justify-center space-x-2 border border-red-200/50 dark:border-red-400/30"
            >
              <i className="fas fa-exclamation-triangle"></i>
              <span className="font-chinese font-medium">中断/规则判定</span>
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex space-x-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onStartChain(chain.id)}
            className="flex-1 gradient-primary hover:shadow-xl text-white px-4 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 hover:scale-105 shadow-lg"
          >
            <Play size={16} />
            <span className="font-chinese font-semibold">开始任务</span>
          </button>
          
          {!isScheduled && (
            <button
              onClick={() => onScheduleChain(chain.id)}
              className="flex-1 gradient-dark hover:shadow-xl text-white px-4 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 hover:scale-105 shadow-lg"
            >
              <i className="fas fa-clock"></i>
              <span className="font-chinese font-semibold">预约</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full border border-gray-200/60 dark:border-slate-600/60 shadow-2xl animate-scale-in">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-trash text-red-500 text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold font-chinese text-[#161615] dark:text-slate-100 mb-3">确认删除链条</h3>
              <p className="text-gray-600 dark:text-slate-300 mb-6">
                你确定要删除链条 "<span className="text-primary-500 font-semibold">{chain.name}</span>" 吗？
              </p>
            </div>
            
            <div className="bg-red-50/80 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200/60 dark:border-red-800/40 mb-8">
              <div className="text-center mb-6">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium font-chinese">
                  ⚠️ 此操作将永久删除以下数据：
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-red-600 dark:text-red-400 text-sm">
                <div className="bg-white/80 dark:bg-slate-700/50 rounded-xl p-4 border border-red-200/60 dark:border-red-800/40">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-fire mr-2"></i>
                    主链数据
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                    <div>记录: #{chain.currentStreak}</div>
                    <div>完成: {chain.totalCompletions}</div>
                    <div>失败: {chain.totalFailures}</div>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-slate-700/50 rounded-xl p-4 border border-red-200/60 dark:border-red-800/40">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-calendar mr-2"></i>
                    预约链数据
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                    <div>记录: #{chain.auxiliaryStreak}</div>
                    <div>失败: {chain.auxiliaryFailures}</div>
                    <div>例外: {chain.auxiliaryExceptions?.length || 0} 条</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-red-600 dark:text-red-400 text-sm mt-4">
                <div className="bg-white/80 dark:bg-slate-700/50 rounded-xl p-4 border border-red-200/60 dark:border-red-800/40">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-chart-line mr-2"></i>
                    历史记录
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                    <div>完成记录: {chain.totalCompletions} 次</div>
                    <div>失败记录: {chain.totalFailures} 次</div>
                    <div>成功率: {chain.totalCompletions > 0 ? Math.round((chain.totalCompletions / (chain.totalCompletions + chain.totalFailures)) * 100) : 0}%</div>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-slate-700/50 rounded-xl p-4 border border-red-200/60 dark:border-red-800/40">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-cog mr-2"></i>
                    规则设置
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                    <div>例外: {chain.exceptions.length} 条</div>
                    <div>预约例外: {chain.auxiliaryExceptions?.length || 0} 条</div>
                    <div>所有配置</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={handleCancelDelete}
                className="flex-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 px-6 py-4 rounded-2xl font-medium transition-all duration-300 hover:scale-105 font-chinese"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl font-medium transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl font-chinese"
              >
                <i className="fas fa-trash"></i>
                <span>确认删除</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

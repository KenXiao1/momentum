import React, { useState, useEffect } from 'react';
import { Chain, ScheduledSession } from '../types';
import { Play, Clock } from 'lucide-react';
import { formatTime, getTimeRemaining, formatDuration } from '../utils/time';

interface ChainCardProps {
  chain: Chain;
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

  useEffect(() => {
    if (!scheduledSession) return;

    const updateTimer = () => {
      const remaining = getTimeRemaining(scheduledSession.expiresAt);
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        // Session expired - this would be handled by parent component
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [scheduledSession]);

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
            <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-10 min-w-[140px]">
              <button
                onClick={handleDeleteClick}
                className="w-full px-4 py-3 text-left text-red-500 hover:bg-red-50 flex items-center space-x-3 transition-colors"
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
            <h3 className="text-2xl font-bold font-chinese text-[#161615] mb-2 group-hover:text-primary-500 transition-colors">
              {chain.name}
            </h3>
            <p className="text-gray-500 text-sm mb-3 font-mono tracking-wide">
              {chain.trigger}
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              {chain.description}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-primary-500/10 to-primary-600/5 border border-primary-200/50">
            <div className="flex items-center justify-center space-x-2 text-primary-500 mb-2">
              <i className="fas fa-fire text-lg"></i>
              <span className="text-3xl font-bold font-mono">#{chain.currentStreak}</span>
            </div>
            <div className="text-xs font-chinese text-gray-500 font-medium">主链记录</div>
          </div>
          <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-200/50">
            <div className="flex items-center justify-center space-x-2 text-blue-500 mb-2">
              <i className="fas fa-calendar-alt text-lg"></i>
              <span className="text-3xl font-bold font-mono">#{chain.auxiliaryStreak}</span>
            </div>
            <div className="text-xs font-chinese text-gray-500 font-medium">预约链记录</div>
          </div>
        </div>

        {/* Duration and completions */}
        <div className="flex items-center justify-between mb-6 p-3 rounded-xl bg-gray-50">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock size={16} />
            <span className="font-medium">{formatTime(chain.duration)}</span>
          </div>
          <div className="text-gray-500 text-sm font-mono">
            {chain.totalCompletions} completions
          </div>
        </div>

        {/* Scheduled session */}
        {isScheduled && (
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 rounded-2xl p-4 mb-6 border border-blue-200/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-blue-600">
                <i className="fas fa-bell text-sm"></i>
                <span className="text-sm font-chinese font-medium">预约信号: {scheduledSession.auxiliarySignal}</span>
              </div>
              <div className="text-blue-700 font-mono font-bold text-lg">
                {formatDuration(timeRemaining)}
              </div>
            </div>
            <div className="text-blue-600 text-xs mb-3 font-chinese">
              请在时间结束前完成: {chain.auxiliaryCompletionTrigger}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelScheduledSession?.(chain.id);
              }}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-600 px-3 py-3 rounded-xl text-sm transition-colors duration-200 flex items-center justify-center space-x-2 border border-red-200/50"
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
            className="flex-1 gradient-primary hover:shadow-lg text-white px-4 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 hover:scale-105"
          >
            <Play size={16} />
            <span className="font-chinese font-semibold">开始任务</span>
          </button>
          
          {!isScheduled && (
            <button
              onClick={() => onScheduleChain(chain.id)}
              className="flex-1 gradient-dark hover:shadow-lg text-white px-4 py-3 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 hover:scale-105"
            >
              <i className="fas fa-clock"></i>
              <span className="font-chinese font-semibold">预约</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full border border-gray-200 shadow-2xl animate-scale-in">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-trash text-red-500 text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold font-chinese text-[#161615] mb-2">确认删除链条</h3>
              <p className="text-gray-600 mb-4">
                你确定要删除链条 "<span className="text-primary-500 font-semibold">{chain.name}</span>" 吗？
              </p>
            </div>
            
            <div className="bg-red-50 rounded-2xl p-6 border border-red-200 mb-8">
              <div className="text-center mb-6">
                <p className="text-red-600 text-sm font-medium font-chinese">
                  ⚠️ 此操作将永久删除以下数据：
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-red-600 text-sm">
                <div className="bg-white rounded-xl p-4 border border-red-200">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-fire mr-2"></i>
                    主链数据
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>记录: #{chain.currentStreak}</div>
                    <div>完成: {chain.totalCompletions}</div>
                    <div>失败: {chain.totalFailures}</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-red-200">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-calendar mr-2"></i>
                    预约链数据
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>记录: #{chain.auxiliaryStreak}</div>
                    <div>失败: {chain.auxiliaryFailures}</div>
                    <div>预约设置</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-red-200">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-chart-line mr-2"></i>
                    历史记录
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>完成记录</div>
                    <div>失败记录</div>
                    <div>时间统计</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-red-200">
                  <div className="font-semibold mb-3 flex items-center font-chinese">
                    <i className="fas fa-cog mr-2"></i>
                    规则设置
                  </div>
                  <div className="space-y-1 text-xs">
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
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-4 rounded-2xl font-medium transition-colors duration-200 font-chinese"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl font-medium transition-colors duration-200 flex items-center justify-center space-x-2 font-chinese"
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
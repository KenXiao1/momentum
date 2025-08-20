import React, { useState, useEffect, useRef } from 'react';
import { ActiveSession, Chain, ExceptionRule, ExceptionRuleType, SessionContext, PauseOptions } from '../types';
import { CheckCircle, Settings, Maximize, Minimize, X, AlertTriangle } from 'lucide-react';
import { formatDuration, formatElapsedTime, formatTimeDescription, formatLastCompletionReference } from '../utils/time';
import { notificationManager } from '../utils/notifications';
import { forwardTimerManager } from '../utils/forwardTimer';
import { exceptionRuleManager } from '../services/ExceptionRuleManager';
import { RuleSelectionDialog } from './RuleSelectionDialog';
import { TaskCompletionDialog } from './TaskCompletionDialog';
import { UserFeedbackDisplay } from './UserFeedbackDisplay';
import { userFeedbackHandler } from '../services/UserFeedbackHandler';
import { errorRecoveryManager } from '../services/ErrorRecoveryManager';
import { EnhancedExceptionRuleException } from '../types';

interface FocusModeProps {
  session: ActiveSession;
  chain: Chain;
  storage: any;
  onComplete: (description?: string, notes?: string) => void;
  onInterrupt: (reason?: string) => void;
  onPause: (duration?: number) => void;
  onResume: () => void;
  onRuleUsed?: (rule: ExceptionRule, actionType: 'pause' | 'early_completion', pauseOptions?: PauseOptions) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  session,
  chain,
  storage,
  onComplete,
  onInterrupt,
  onPause,
  onResume,
  onRuleUsed,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  
  // 例外规则系统状态
  const [showRuleSelection, setShowRuleSelection] = useState(false);
  const [pendingActionType, setPendingActionType] = useState<'pause' | 'early_completion' | null>(null);
  
  // 任务完成对话框状态
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
  // 中断确认对话框状态
  const [showInterruptDialog, setShowInterruptDialog] = useState(false);
  // 暂停后自动恢复
  const AUTO_RESUME_STORAGE_KEY = 'momentum_auto_resume';
  const [autoResumeAt, setAutoResumeAt] = useState<number | null>(null);
  const [resumeCountdown, setResumeCountdown] = useState<number>(0);
  const [elapsedPauseTime, setElapsedPauseTime] = useState<number>(0);
  const resumeTimeoutRef = useRef<number | null>(null);
  
  // 正向计时相关状态
  const [forwardElapsedSeconds, setForwardElapsedSeconds] = useState(0);
  const [lastCompletionTime, setLastCompletionTime] = useState<number | null>(null);
  
  // 最小时长相关状态
  const [hasReachedMinimum, setHasReachedMinimum] = useState(false);
  const [minimumCountdown, setMinimumCountdown] = useState(0);
  
  // 全屏模式状态
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isDurationless = !!chain.isDurationless || session.duration === 0;

  // 初始化上次完成时间参考
  useEffect(() => {
    if (isDurationless) {
      const lastTime = storage.getLastCompletionTime(chain.id);
      setLastCompletionTime(lastTime);
    }
  }, [chain.id, isDurationless]);

  // 正向计时逻辑（无时长任务启用）
  useEffect(() => {
    if (!isDurationless) return;

    const sessionId = `${session.chainId}_${session.startedAt.getTime()}`;
    
    // 启动正向计时器
    if (!forwardTimerManager.hasTimer(sessionId)) {
      forwardTimerManager.startTimer(sessionId);
    }

    const updateForwardTimer = () => {
      if (session.isPaused && !forwardTimerManager.isPaused(sessionId)) {
        forwardTimerManager.pauseTimer(sessionId);
      } else if (!session.isPaused && forwardTimerManager.isPaused(sessionId)) {
        forwardTimerManager.resumeTimer(sessionId);
      }

      const elapsed = forwardTimerManager.getCurrentElapsed(sessionId);
      setForwardElapsedSeconds(elapsed);
      
      // 检查最小时长进度
      if (chain.minimumDuration && chain.minimumDuration > 0) {
        const minimumSeconds = chain.minimumDuration * 60;
        if (elapsed >= minimumSeconds) {
          setHasReachedMinimum(true);
          setMinimumCountdown(0);
        } else {
          setHasReachedMinimum(false);
          setMinimumCountdown(minimumSeconds - elapsed);
        }
      }
    };

    updateForwardTimer();
    const interval = setInterval(updateForwardTimer, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [session, isDurationless]);

  // 计时逻辑（有时长时启用）
  useEffect(() => {
    if (isDurationless) return;

    const getNotificationThreshold = (durationMinutes: number) => {
      if (durationMinutes <= 3) return null;
      const thresholdMinutes = Math.floor(durationMinutes / 3);
      return Math.min(thresholdMinutes, 1) * 60;
    };

    const notificationThreshold = getNotificationThreshold(session.duration);

    const calculateTimeRemaining = () => {
      const now = Date.now();
      const sessionDurationMs = session.duration * 60 * 1000;
      const elapsedTime = session.isPaused 
        ? (session.pausedAt?.getTime() || now) - session.startedAt.getTime()
        : now - session.startedAt.getTime();
      const adjustedElapsedTime = elapsedTime - session.totalPausedTime;
      const remaining = Math.max(0, sessionDurationMs - adjustedElapsedTime);
      return Math.ceil(remaining / 1000);
    };

    const updateTimer = () => {
      if (session.isPaused) return;
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (notificationThreshold && remaining <= notificationThreshold && remaining > 0 && !hasShownWarning) {
        setHasShownWarning(true);
        const minutes = Math.max(1, Math.ceil(remaining / 60));
        notificationManager.notifyTaskWarning(chain.name, `${minutes}分钟`);
      }

      if (remaining <= 0) {
        setShowCompletionDialog(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session, onComplete, hasShownWarning, chain.name, isDurationless]);

  // 重置警告状态当会话改变时
  useEffect(() => { 
    setHasShownWarning(false); 
  }, [session.startedAt, session.chainId]);

  const elapsedSeconds = isDurationless
    ? forwardElapsedSeconds
    : session.duration * 60 - timeRemaining;

  const progress = isDurationless
    ? 100
    : ((session.duration * 60 - timeRemaining) / (session.duration * 60)) * 100;

  // 创建会话上下文
  const createSessionContext = (): SessionContext => ({
    sessionId: `${session.chainId}_${session.startedAt.getTime()}`,
    chainId: session.chainId,
    chainName: chain.name,
    startedAt: session.startedAt,
    elapsedTime: isDurationless ? forwardElapsedSeconds : (session.duration * 60 - timeRemaining),
    remainingTime: isDurationless ? undefined : timeRemaining,
    isDurationless
  });

  // 处理中断操作
  const handleInterruptClick = () => {
    setShowInterruptDialog(true);
  };

  // 处理确认中断
  const handleConfirmInterrupt = () => {
    setShowInterruptDialog(false);
    onInterrupt('用户主动中断');
  };

  // 处理取消中断
  const handleCancelInterrupt = () => {
    setShowInterruptDialog(false);
  };
  // 处理暂停操作
  const handlePauseClick = () => {
    setPendingActionType('pause');
    setShowRuleSelection(true);
  };

  // 处理提前完成操作
  const handleEarlyCompleteClick = () => {
    // 对于无限时长任务，直接显示完成对话框
    if (isDurationless) {
      setShowCompletionDialog(true);
    } else {
      // 对于有时长任务，先显示规则选择对话框
      setPendingActionType('early_completion');
      setShowRuleSelection(true);
    }
  };

  // 处理直接完成任务（无需规则）
  const handleDirectComplete = (description?: string, notes?: string) => {
    setShowCompletionDialog(false);
    onComplete(description, notes);
  };

  // 处理规则选择后的完成
  const handleRuleBasedComplete = (description?: string, notes?: string) => {
    setShowCompletionDialog(false);
    // 这里我们已经有了规则选择，现在可以完成任务
    onComplete(description, notes);
  };

  // 处理规则选择（增强版本）
  const handleRuleSelected = async (rule: ExceptionRule, pauseOptions?: PauseOptions) => {
    console.log('🔧 handleRuleSelected called:', { rule, pendingActionType, ruleId: rule?.id, ruleType: typeof rule });
    
    if (!pendingActionType) return;

    try {
      // 验证规则对象
      if (!rule || !rule.id) {
        console.error('❌ Invalid rule object:', rule);
        userFeedbackHandler.showErrorMessage(
          new EnhancedExceptionRuleException(
            'RULE_NOT_FOUND' as any,
            '规则对象无效',
            { rule, pendingActionType }
          )
        );
        return;
      }

      // 显示操作进度
      userFeedbackHandler.showProgress(`正在${pendingActionType === 'pause' ? '暂停' : '完成'}任务...`);

      const sessionContext = createSessionContext();
      
      console.log('🔧 Preparing to use rule:', { ruleId: rule.id, sessionContext, actionType: pendingActionType });
      
      // 使用规则并记录统计
      const result = await exceptionRuleManager.useRule(rule.id, sessionContext, pendingActionType, pauseOptions);
      
      // 隐藏进度
      userFeedbackHandler.hideProgress();
      
      // 显示成功消息
      const actionName = pendingActionType === 'pause' ? '暂停' : '提前完成';
      userFeedbackHandler.showSuccess(
        '操作成功',
        `已使用规则 "${rule.name}" ${actionName}任务`
      );
      
      // 通知父组件规则被使用
      onRuleUsed?.(rule, pendingActionType, pauseOptions);
      
      // 执行相应操作
      if (pendingActionType === 'pause') {
        // 传递暂停时长给父组件
        onPause(pauseOptions?.duration);
        // 如果设置了自动恢复，安排自动恢复
        if (pauseOptions?.duration && pauseOptions.autoResume) {
          scheduleAutoResume(Math.floor(pauseOptions.duration / 60));
        }
      } else if (pendingActionType === 'early_completion') {
        clearAutoResumeSchedule();
        // 重置规则选择状态，然后显示完成对话框
        setShowRuleSelection(false);
        setPendingActionType(null);
        setShowCompletionDialog(true);
        return; // 早期返回，避免下面的状态重置
      }
      
      // 重置状态
      setShowRuleSelection(false);
      setPendingActionType(null);
      
    } catch (error) {
      // 隐藏进度
      userFeedbackHandler.hideProgress();
      
      console.error('Failed to use rule:', error);
      
      // 使用增强的错误处理
      await handleRuleError(error, 'use_rule', { rule, actionType: pendingActionType });
    }
  };

  // 处理创建新规则（增强版本）
  const handleCreateNewRule = async (name: string, type: ExceptionRuleType) => {
    console.log('🔧 handleCreateNewRule called:', { name, type, typeOf: typeof type });
    
    try {
      // 验证参数
      if (!name || !name.trim()) {
        userFeedbackHandler.showErrorMessage(
          new EnhancedExceptionRuleException(
            'VALIDATION_ERROR' as any,
            '规则名称不能为空',
            { name, type }
          )
        );
        return;
      }
      
      // 确保类型有效
      let validType = type;
      if (!validType || !Object.values(ExceptionRuleType).includes(validType)) {
        console.warn('⚠️ Invalid rule type, using default type');
        validType = pendingActionType === 'pause' 
          ? ExceptionRuleType.PAUSE_ONLY 
          : ExceptionRuleType.EARLY_COMPLETION_ONLY;
      }
      
      console.log('✅ 使用的规则类型:', validType);
      
      // 显示创建进度
      userFeedbackHandler.showProgress('正在创建规则...', 0);
      
      // 更新进度
      userFeedbackHandler.updateProgress(30, '验证规则信息...');
      
      // 首先检查重复
      const duplicateCheck = await exceptionRuleManager.checkRuleNameRealTime(name);
      
      let userChoice: 'use_existing' | 'modify_name' | 'create_anyway' | undefined;
      
      if (duplicateCheck.hasConflict) {
        // 隐藏进度，自动选择第一个建议
        userFeedbackHandler.hideProgress();
        
        if (duplicateCheck.suggestions && duplicateCheck.suggestions.length > 0) {
            userChoice = duplicateCheck.suggestions[0].type as any;
        }
        
        // 重新显示进度
        userFeedbackHandler.showProgress('正在创建规则...', 50);
      }
      
      // 更新进度
      userFeedbackHandler.updateProgress(70, '保存规则...');
      
      const result = await exceptionRuleManager.createRule(name, validType, undefined, userChoice);
      
      // 显示成功消息
      userFeedbackHandler.hideProgress();
      userFeedbackHandler.showSuccess(
        '规则创建成功',
        `规则 "${result.rule.name}" 已创建并应用`
      );
      
      // 显示警告信息（如果有）
      if (result.warnings && result.warnings.length > 0) {
        userFeedbackHandler.showWarning(
          '注意事项',
          result.warnings.join('\n')
        );
      }
      
      await handleRuleSelected(result.rule);
      
    } catch (error) {
      // 隐藏进度
      userFeedbackHandler.hideProgress();
      
      console.error('创建规则失败:', error);
      
      // 使用增强的错误处理
      await handleRuleError(error, 'create_rule', { name, type });
    }
  };

  // 增强的错误处理函数
  const handleRuleError = async (error: any, operation: string, context: any) => {
    try {
      if (error instanceof EnhancedExceptionRuleException) {
        // 显示用户友好的错误信息
        const messageId = userFeedbackHandler.showErrorMessage(error, context);
        
        // 尝试自动恢复
        const recoveryResult = await errorRecoveryManager.attemptRecovery(error, context, operation);
        
        if (recoveryResult.success) {
          // 恢复成功，移除错误消息
          userFeedbackHandler.removeMessage(messageId);
          userFeedbackHandler.showSuccess('问题已解决', recoveryResult.message);
          
          // 如果有恢复的数据，使用它
          if (recoveryResult.recoveredData) {
            if (operation === 'create_rule' && recoveryResult.recoveredData.name) {
              // 规则创建恢复
              await handleRuleSelected(recoveryResult.recoveredData);
            }
          }
        } else if (recoveryResult.requiresUserAction && recoveryResult.actions) {
          // 需要用户选择恢复操作 - 这里我们只记录错误，不显示弹窗
          console.error("需要用户操作的恢复失败:", recoveryResult);
        }
      } else {
        // 处理普通错误
        const enhancedError = new EnhancedExceptionRuleException(
          'STORAGE_ERROR' as any,
          error instanceof Error ? error.message : '未知错误',
          context,
          true,
          ['重试操作', '刷新页面'],
          'medium',
          '操作失败，请重试'
        );
        
        userFeedbackHandler.showErrorMessage(enhancedError, context);
      }
    } catch (handlingError) {
      // 错误处理本身失败了
      console.error('错误处理失败:', handlingError);
      userFeedbackHandler.showWarning(
        '系统错误',
        '处理错误时发生问题，请刷新页面重试'
      );
    }
  };

  // 处理规则选择取消
  const handleRuleSelectionCancel = () => {
    // 清理任何进度指示器
    userFeedbackHandler.hideProgress();
    
    // 重置状态
    setShowRuleSelection(false);
    setPendingActionType(null);
    
    // 显示取消信息
    userFeedbackHandler.showInfo('操作已取消', '您可以继续任务或重新选择操作');
  };

  // 处理完成对话框取消
  const handleCompletionDialogCancel = () => {
    setShowCompletionDialog(false);
    // 如果是因为计时器到期而显示的对话框，需要处理特殊情况
    // 对于有时长任务，可能需要继续倒计时或其他处理
  };

  // 自动恢复相关
  const clearAutoResumeSchedule = () => {
    try {
      const dataStr = localStorage.getItem(AUTO_RESUME_STORAGE_KEY);
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.chainId === session.chainId) {
          localStorage.removeItem(AUTO_RESUME_STORAGE_KEY);
        }
      }
    } catch {}
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setAutoResumeAt(null);
    setResumeCountdown(0);
  };

  const setupAutoResumeTimer = (resumeTime: number) => {
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current);
    }
    const delay = Math.max(0, resumeTime - Date.now());
    if (delay === 0) {
      clearAutoResumeSchedule();
      onResume();
      return;
    }
    resumeTimeoutRef.current = window.setTimeout(() => {
      onResume();
      clearAutoResumeSchedule();
    }, delay);
  };

  const scheduleAutoResume = (minutes: number) => {
    const resumeTime = Date.now() + minutes * 60 * 1000;
    setAutoResumeAt(resumeTime);
    try {
      localStorage.setItem(
        AUTO_RESUME_STORAGE_KEY,
        JSON.stringify({
          chainId: session.chainId,
          startedAt: session.startedAt.toISOString(),
          resumeAt: new Date(resumeTime).toISOString(),
        })
      );
    } catch {}
    setupAutoResumeTimer(resumeTime);
  };

  // 加载已有的自动恢复计划
  useEffect(() => {
    if (!session.isPaused) return;
    try {
      const dataStr = localStorage.getItem(AUTO_RESUME_STORAGE_KEY);
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.chainId === session.chainId && data.startedAt === session.startedAt.toISOString()) {
        const ts = new Date(data.resumeAt).getTime();
        if (ts > Date.now()) {
          setAutoResumeAt(ts);
          setupAutoResumeTimer(ts);
        } else {
          clearAutoResumeSchedule();
          onResume();
        }
      }
    } catch {}
  }, [session.isPaused, session.chainId, session.startedAt, onResume]);

  // 倒计时显示
  useEffect(() => {
    if (!session.isPaused) {
        setElapsedPauseTime(0);
        return;
    }

    if (autoResumeAt) {
        setResumeCountdown(Math.max(0, Math.ceil((autoResumeAt - Date.now()) / 1000)));
        const interval = window.setInterval(() => {
            const secs = Math.max(0, Math.ceil((autoResumeAt - Date.now()) / 1000));
            setResumeCountdown(secs);
            if (secs <= 0) {
                window.clearInterval(interval);
            }
        }, 1000);
        return () => window.clearInterval(interval);
    } else {
        const interval = window.setInterval(() => {
            if (session.pausedAt) {
                const now = new Date().getTime();
                const pausedAt = new Date(session.pausedAt).getTime();
                setElapsedPauseTime(Math.floor((now - pausedAt) / 1000));
            }
        }, 1000);
        return () => window.clearInterval(interval);
    }
  }, [session.isPaused, session.pausedAt, autoResumeAt]);

  // 清理自动恢复计划
  useEffect(() => {
    if (!session.isPaused) {
      clearAutoResumeSchedule();
    }
  }, [session.isPaused]);

  // 全屏模式处理
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isFullscreen]);

  // 全屏模式函数
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-[#161615] dark:via-black dark:to-[#161615] flex items-center justify-center relative overflow-hidden">
      {/* Fullscreen Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
        {!isFullscreen ? (
          <button
            onClick={enterFullscreen}
            className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/20 text-gray-600 dark:text-gray-300 transition-all duration-300 border border-white/20"
            title="进入全屏 (F11)"
          >
            <Maximize size={20} />
          </button>
        ) : (
          <button
            onClick={exitFullscreen}
            className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/20 text-gray-600 dark:text-gray-300 transition-all duration-300 border border-white/20"
            title="退出全屏 (ESC)"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-primary-500/5 dark:from-primary-500/5 dark:via-transparent dark:to-primary-500/5"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 dark:bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-500/5 dark:bg-primary-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      
      {/* Main content */}
      <div className="relative z-10 text-center animate-fade-in">
        <div className="mb-12">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-16 h-16 rounded-3xl bg-primary-500/20 backdrop-blur-sm flex items-center justify-center border border-primary-500/30 dark:bg-primary-500/20 dark:border-primary-500/30">
              <i className="fas fa-fire text-primary-500 text-2xl"></i>
            </div>
            <div className="text-left">
              <h1 className="text-5xl md:text-6xl font-light font-chinese text-gray-900 dark:text-white mb-2">{chain.name}</h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg font-mono tracking-wider">{chain.trigger}</p>
            </div>
          </div>
        </div>
        
        {/* Timer display */}
        <div className="mb-16">
          <div className="text-8xl md:text-9xl font-mono font-light text-gray-900 dark:text-white mb-8 tracking-wider">
            {isDurationless ? formatElapsedTime(elapsedSeconds) : formatDuration(timeRemaining)}
          </div>
          
          {/* Progress bar */}
          <div className="w-96 max-w-full h-3 bg-gray-200 dark:bg-white/10 backdrop-blur-sm rounded-full mx-auto mb-6 border border-gray-300 dark:border-white/20">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-center space-x-6 text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <i className="fas fa-clock text-primary-500"></i>
              <span className="font-mono">
                {isDurationless
                  ? `已用时 ${formatTimeDescription(Math.ceil(elapsedSeconds / 60))}`
                  : `${Math.floor((session.duration * 60 - timeRemaining) / 60)}分钟 / ${session.duration}分钟`}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-fire text-primary-500"></i>
              <span className="font-mono">#{chain.currentStreak}</span>
            </div>
          </div>
          
          {/* 上次用时参考 */}
          {isDurationless && lastCompletionTime !== null && (
            <div className="mt-4 text-gray-500 dark:text-gray-400 text-sm font-chinese">
              {formatLastCompletionReference(lastCompletionTime)}
            </div>
          )}
          
          {/* 最小时长倒计时 */}
          {isDurationless && chain.minimumDuration && chain.minimumDuration > 0 && !hasReachedMinimum && (
            <div className="mt-4 text-indigo-600 dark:text-indigo-400 text-lg font-chinese">
              <div className="flex items-center justify-center space-x-2">
                <i className="fas fa-hourglass-half text-indigo-500"></i>
                <span>还需 {Math.floor(minimumCountdown / 60)}分{minimumCountdown % 60}秒 达到最小时长</span>
              </div>
            </div>
          )}
          
          {/* 已达到最小时长提示 */}
          {isDurationless && chain.minimumDuration && chain.minimumDuration > 0 && hasReachedMinimum && (
            <div className="mt-4 text-green-600 dark:text-green-400 text-lg font-chinese">
              <div className="flex items-center justify-center space-x-2">
                <i className="fas fa-check-circle text-green-500"></i>
                <span>已达到最小时长 {chain.minimumDuration} 分钟，可以完成任务</span>
              </div>
            </div>
          )}
        </div>

        {!session.isPaused && (
          <div className="flex items-center justify-center space-x-4">
            {isDurationless ? (
              <>
                <button 
                  onClick={handlePauseClick} 
                  className="px-6 py-3 rounded-2xl bg-yellow-500/90 hover:bg-yellow-500 text-white font-chinese transition-all duration-300 flex items-center space-x-2"
                >
                  <Settings size={16} />
                  <span>暂停</span>
                </button>
                {/* 如果没有设置最小时长，显示完成任务按钮 */}
                {(!chain.minimumDuration || chain.minimumDuration === 0) && (
                  <button 
                    onClick={handleEarlyCompleteClick} 
                    className="px-8 py-4 rounded-3xl bg-green-600 hover:bg-green-700 text-white font-chinese transition-all duration-300 shadow-lg flex items-center space-x-2"
                  >
                    <CheckCircle size={20} />
                    <span>完成任务</span>
                  </button>
                )}
                
                {/* 如果设置了最小时长，根据是否达到显示不同按钮 */}
                {chain.minimumDuration && chain.minimumDuration > 0 && (
                  <>
                    {!hasReachedMinimum ? (
                      <button 
                        onClick={handleEarlyCompleteClick} 
                        className="px-6 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-chinese transition-all duration-300 flex items-center space-x-2"
                      >
                        <CheckCircle size={16} />
                        <span>提前完成</span>
                      </button>
                    ) : (
                      <button 
                        onClick={handleEarlyCompleteClick} 
                        className="px-8 py-4 rounded-3xl bg-green-600 hover:bg-green-700 text-white font-chinese transition-all duration-300 shadow-lg flex items-center space-x-2"
                      >
                        <CheckCircle size={20} />
                        <span>完成任务</span>
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <button 
                  onClick={handlePauseClick} 
                  className="px-6 py-3 rounded-2xl bg-yellow-500/90 hover:bg-yellow-500 text-white font-chinese transition-all duration-300 flex items-center space-x-2"
                >
                  <Settings size={16} />
                  <span>暂停</span>
                </button>
                <button 
                  onClick={handleEarlyCompleteClick} 
                  className="px-6 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-chinese transition-all duration-300 flex items-center space-x-2"
                >
                  <CheckCircle size={16} />
                  <span>提前完成</span>
                </button>
              </>
            )}
          </div>
        )}

        {session.isPaused && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="text-gray-700 dark:text-gray-300 font-chinese">
              {autoResumeAt
                ? `已暂停，将于 ${Math.floor(resumeCountdown / 60)}分${resumeCountdown % 60}秒 内自动继续`
                : `已暂停 ${Math.floor(elapsedPauseTime / 60)}分${elapsedPauseTime % 60}秒`}
            </div>
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => {
                  clearAutoResumeSchedule();
                  onResume();
                }}
                className="px-6 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-chinese transition-all duration-300"
              >
                继续
              </button>
              {autoResumeAt && (
                <button
                  onClick={clearAutoResumeSchedule}
                  className="px-6 py-3 rounded-2xl bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-chinese transition-all duration-300"
                >
                  取消自动继续
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Red Interrupt Button - Bottom Right Corner */}
      {!session.isPaused && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            onClick={handleInterruptClick}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center border-2 border-red-400"
            title="中断任务"
          >
            <AlertTriangle size={24} />
          </button>
        </div>
      )}
      {/* Rule Selection Dialog */}
      {showRuleSelection && pendingActionType && (
        <RuleSelectionDialog
          isOpen={showRuleSelection}
          actionType={pendingActionType}
          sessionContext={createSessionContext()}
          onRuleSelected={handleRuleSelected}
          onCreateNewRule={handleCreateNewRule}
          onCancel={handleRuleSelectionCancel}
        />
      )}

      {/* Task Completion Dialog */}
      {showCompletionDialog && (
        <TaskCompletionDialog
          isOpen={showCompletionDialog}
          chainName={chain.name}
          chainId={chain.id}
          isDurationless={isDurationless}
          storage={storage}
          onComplete={handleDirectComplete}
          onCancel={handleCompletionDialogCancel}
        />
      )}

      {/* Interrupt Confirmation Dialog */}
      {showInterruptDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-red-200 dark:border-red-800">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 font-chinese">
                确认中断任务
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 mb-8 font-chinese leading-relaxed">
                中断任务将导致任务失败，主链记录将清空为零。你确定要中断当前任务吗？
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleCancelInterrupt}
                  className="flex-1 px-6 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-chinese transition-all duration-300"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmInterrupt}
                  className="flex-1 px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-chinese transition-all duration-300 shadow-lg"
                >
                  确认中断
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* User Feedback Display */}
      <UserFeedbackDisplay />
    </div>
  );
};
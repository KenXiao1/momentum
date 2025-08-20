import React, { useState, useEffect } from 'react';
import { AppState, Chain, ScheduledSession, ActiveSession, CompletionHistory, RSIPNode, RSIPMeta } from './types';
import { Dashboard } from './components/Dashboard';
import { RSIPView } from './components/RSIPView';
import { AuthWrapper } from './components/AuthWrapper';
import { ChainEditor } from './components/ChainEditor';
import { FocusMode } from './components/FocusMode';
import { ChainDetail } from './components/ChainDetail';
import { GroupView } from './components/GroupView';
import { TaskGroupEditor } from './components/TaskGroupEditor';
import { AuxiliaryJudgment } from './components/AuxiliaryJudgment';
import { storage as localStorageUtils } from './utils/storage';
import { supabaseStorage } from './utils/supabaseStorage';
import { isSupabaseConfigured } from './lib/supabase';
import { isSessionExpired } from './utils/time';
import { buildChainTree, getNextUnitInGroup, updateGroupCompletions, isGroupFullyCompleted, incrementGroupCompletionCount, resetGroupCompletionCount } from './utils/chainTree';
import { queryOptimizer } from './utils/queryOptimizer';
import { notificationManager } from './utils/notifications';
import { performanceDashboard } from './utils/performanceDashboard';
import { startGroupTimer, isGroupExpired, resetGroupProgress } from './utils/timeLimit';
import { forwardTimerManager } from './utils/forwardTimer';
import { initializeRuleSystem } from './utils/initializeRuleSystem';
import { runMigration } from './utils/migration';
import { realTimeSyncService } from './services/RealTimeSyncService';

function App() {
  const [state, setState] = useState<AppState>({
    chains: [],
    scheduledSessions: [],
    activeSession: null,
    currentView: 'dashboard',
    editingChain: null,
    viewingChainId: null,
    completionHistory: [],
    rsipNodes: [],
    rsipMeta: {},
    taskTimeStats: [],
  });

  const [showAuxiliaryJudgment, setShowAuxiliaryJudgment] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Determine storage source immediately based on Supabase configuration
  const storage = isSupabaseConfigured ? supabaseStorage : localStorageUtils;
  
  useEffect(() => {
    // Storage source determined based on Supabase configuration
    
    // 初始化规则系统
    initializeRuleSystem().then(result => {
      if (!result.success) {
        console.error('Rule system initialization failed:', result.message);
      }
    }).catch(error => {
      console.error('Rule system initialization error:', error);
    });

    // 运行迁移脚本
    runMigration();
    
    setIsInitialized(true);
    
    // Initialize performance monitoring for development
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        performanceDashboard.displayConsoleReport();
      }, 5000);
    }
  }, []);

  const renderContent = () => {
    if (!isSupabaseConfigured) {
      // 没有 Supabase 配置时，直接渲染内容，不需要认证
      return renderCurrentView();
    }
    
    // 有 Supabase 配置时，使用认证包装
    return (
      <AuthWrapper>
        {renderCurrentView()}
      </AuthWrapper>
    );
  };

  const renderCurrentView = () => {
    // 如果还没有初始化完成，显示加载状态
    if (!isInitialized) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-xl">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold font-chinese text-gray-900 dark:text-slate-100 mb-2">
              正在初始化...
            </h2>
            <p className="text-gray-600 dark:text-slate-400 font-mono text-sm">
              INITIALIZING APPLICATION
            </p>
          </div>
        </div>
      );
    }

    switch (state.currentView) {
      case 'editor':
        return (
          <>
            <ChainEditor
              chain={state.editingChain || undefined}
              isEditing={!!state.editingChain}
              initialParentId={state.viewingChainId || undefined}
              onSave={handleSaveChain}
              onCancel={handleBackToDashboard}
            />
            {showAuxiliaryJudgment && (
              <AuxiliaryJudgment
                chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
                onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment!)}
                onJudgmentAllow={(exceptionRule) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, exceptionRule)}
                onCancel={() => setShowAuxiliaryJudgment(null)}
              />
            )}
          </>
        );

      case 'taskgroup-editor':
        return (
          <>
            <TaskGroupEditor
              chain={state.editingChain || undefined}
              isEditing={!!state.editingChain}
              initialParentId={state.viewingChainId || undefined}
              onSave={handleSaveChain}
              onCancel={handleBackToDashboard}
            />
          </>
        );

      case 'focus': {
        const activeChain = state.chains.find(c => c.id === state.activeSession?.chainId);
        if (!state.activeSession || !activeChain) {
          handleBackToDashboard();
          return null;
        }
        return (
          <>
            <FocusMode
              session={state.activeSession}
              chain={activeChain}
              storage={storage}
              onComplete={handleCompleteSession}
              onInterrupt={handleInterruptSession}
              onAddException={handleAddException}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
            />
            {showAuxiliaryJudgment && (
              <AuxiliaryJudgment
                chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
                onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment!)}
                onJudgmentAllow={(exceptionRule) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, exceptionRule)}
                onCancel={() => setShowAuxiliaryJudgment(null)}
              />
            )}
          </>
        );
      }

      case 'detail': {
        const viewingChain = state.chains.find(c => c.id === state.viewingChainId);
        if (!viewingChain) {
          handleBackToDashboard();
          return null;
        }
        return (
          <>
            <ChainDetail
              chain={viewingChain}
              history={state.completionHistory}
              onBack={handleBackToDashboard}
              onEdit={() => handleEditChain(viewingChain.id)}
              onDelete={() => handleDeleteChain(viewingChain.id)}
            />
            {showAuxiliaryJudgment && (
              <AuxiliaryJudgment
                chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
                onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment!)}
                onJudgmentAllow={(exceptionRule) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, exceptionRule)}
                onCancel={() => setShowAuxiliaryJudgment(null)}
              />
            )}
          </>
        );
      }

      case 'group': {
        const viewingGroup = state.chains.find(c => c.id === state.viewingChainId);
        if (!viewingGroup) {
          handleBackToDashboard();
          return null;
        }
        
        // 构建任务树并找到对应的群组节点
        const chainTree = queryOptimizer.memoizedBuildChainTree(state.chains);
        const groupNode = chainTree.find(node => node.id === state.viewingChainId);
        if (!groupNode) {
          handleBackToDashboard();
          return null;
        }
        
        return (
          <>
            <GroupView
              group={groupNode}
              scheduledSessions={state.scheduledSessions}
             availableUnits={state.chains}
              onBack={handleBackToDashboard}
              onStartChain={handleStartChain}
              onScheduleChain={handleScheduleChain}
              onEditChain={(chainId) => handleEditChain(chainId)}
              onDeleteChain={handleDeleteChain}
              onAddUnit={() => handleCreateChain(state.viewingChainId!)}
             onImportUnits={handleImportUnits}
              onUpdateTaskRepeatCount={handleUpdateTaskRepeatCount}
            />
            {showAuxiliaryJudgment && (
              <AuxiliaryJudgment
                chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
                onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment!)}
                onJudgmentAllow={(exceptionRule) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, exceptionRule)}
                onCancel={() => setShowAuxiliaryJudgment(null)}
              />
            )}
          </>
        );
      }

      case 'rsip':
        return (
          <RSIPView
            nodes={state.rsipNodes}
            meta={state.rsipMeta}
            onBack={handleBackToDashboard}
            onSaveNodes={async (nodes) => {
              await storage.saveRSIPNodes(nodes);
              setState(prev => ({ ...prev, rsipNodes: nodes }));
            }}
            onSaveMeta={async (meta) => {
              await storage.saveRSIPMeta(meta);
              setState(prev => ({ ...prev, rsipMeta: meta }));
            }}
          />
        );

      default:
        return (
          <>
            <Dashboard
              chains={state.chains}
              scheduledSessions={state.scheduledSessions}
              isLoading={isLoadingData}
              onCreateChain={handleCreateChain}
              onCreateTaskGroup={handleCreateTaskGroup}
              onOpenRSIP={() => setState(prev => ({ ...prev, currentView: 'rsip' }))}
              onStartChain={handleStartChain}
              onScheduleChain={handleScheduleChain}
              onViewChainDetail={handleViewChainDetail}
              onCancelScheduledSession={handleCancelScheduledSession}
              onCompleteBooking={handleCompleteBooking}
              onDeleteChain={handleDeleteChain}
              onImportChains={handleImportChains}
              onRestoreChains={handleRestoreChains}
              onPermanentDeleteChains={handlePermanentDeleteChains}
              history={state.completionHistory}
              rsipNodes={state.rsipNodes}
              rsipMeta={state.rsipMeta}
            />
            {showAuxiliaryJudgment && (
              <AuxiliaryJudgment
                chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
                onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment!)}
                onJudgmentAllow={(exceptionRule) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, exceptionRule)}
                onCancel={() => setShowAuxiliaryJudgment(null)}
              />
            )}
          </>
        );
    }
  };

  // Load data from storage on mount
  useEffect(() => {
    const loadData = async () => {
      console.log('Starting data load, using storage type:', isSupabaseConfigured ? 'Supabase' : 'LocalStorage');
      setIsLoadingData(true);
      try {
        // 在加载数据前先执行自动清理
        try {
          const cleanedCount = await storage.cleanupExpiredDeletedChains(30);
          if (cleanedCount > 0) {
            console.log(`Auto-cleaned ${cleanedCount} expired deleted chains`);
          }
        } catch (cleanupError) {
          console.error('Auto cleanup failed:', cleanupError);
        }
        const chains = await storage.getActiveChains();
        
        // 检查并修复循环引用的数据
        const hasCircularReferences = chains.some(chain => chain.parentId === chain.id);
        if (hasCircularReferences) {
          console.log('Detected circular reference data, fixing...');
          const fixedChains = chains.map(chain => {
            if (chain.parentId === chain.id) {
              console.log(`Fixed circular reference for chain ${chain.name}`);
              return { ...chain, parentId: undefined };
            }
            return chain;
          });
          
          // 将修复后的数据保存回数据库
          await storage.saveChains(fixedChains);
          console.log('Circular reference data fix completed and saved');
          
          // 使用修复后的数据
          setState(prev => ({
            ...prev,
            chains: fixedChains,
            scheduledSessions: [],
            activeSession: null,
            completionHistory: [],
            currentView: 'dashboard',
          }));
          return;
        }
        
        console.log('Loaded chain data:', chains.length, 'items');
        console.log('Chain data details:', chains.map(c => ({ id: c.id, name: c.name })));
        const allScheduledSessions = await storage.getScheduledSessions();
        const scheduledSessions = allScheduledSessions.filter(
          session => !isSessionExpired(session.expiresAt)
        );
        const activeSession = await storage.getActiveSession();
        const completionHistory = await storage.getCompletionHistory();
        const rsipNodes = await storage.getRSIPNodes();
        const rsipMeta = await storage.getRSIPMeta();
        const taskTimeStats = await storage.getTaskTimeStats();

        // 执行数据迁移以确保历史记录包含用时信息
        storage.migrateCompletionHistoryForTiming();
        
        // 执行完整的数据迁移（仅在开发环境中记录详细信息）
        if (process.env.NODE_ENV === 'development') {
          try {
            const { dataMigrationManager } = await import('./utils/dataMigration');
            const migrationResult = await dataMigrationManager.migrateAll();
            if (!migrationResult.success || migrationResult.errors.length > 0) {
              console.warn('Data migration completed with warnings:', migrationResult);
            } else {
              console.log('Data migration completed successfully');
            }
          } catch (migrationError) {
            console.warn('Error occurred during data migration:', migrationError);
          }
        }

        console.log('Setting app state, chain count:', chains.length);
        setState(prev => ({
          ...prev,
          chains,
          scheduledSessions,
          activeSession,
          completionHistory,
          rsipNodes,
          rsipMeta,
          taskTimeStats,
          currentView: activeSession ? 'focus' : 'dashboard',
        }));

        // Clean up expired sessions
        if (scheduledSessions.length !== allScheduledSessions.length) {
          await storage.saveScheduledSessions(scheduledSessions);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (isInitialized) {
      console.log('Application initialization complete, starting data load');
      loadData();
    } else {
      setIsLoadingData(false);
    }
  }, [storage, isInitialized]);

  // 定期检查任务群过期状态
  useEffect(() => {
    if (!isInitialized) return;
    
    const checkExpiredGroups = () => {
      setState(prev => {
        let hasChanges = false;
        const updatedChains = prev.chains.map(chain => {
          if (chain.type === 'group' && isGroupExpired(chain)) {
            hasChanges = true;
            return resetGroupProgress(chain);
          }
          return chain;
        });

        if (hasChanges) {
          storage.saveChains(updatedChains);
          return { ...prev, chains: updatedChains };
        }
        return prev;
      });
    };

    // 每分钟检查一次
    const interval = setInterval(checkExpiredGroups, 60000);
    return () => clearInterval(interval);
  }, [storage, isInitialized]);

  // Clean up expired scheduled sessions periodically
  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(() => {
      setState(prev => {
        const expiredSessions = prev.scheduledSessions.filter(
          session => isSessionExpired(session.expiresAt)
        );
        const activeScheduledSessions = prev.scheduledSessions.filter(
          session => !isSessionExpired(session.expiresAt)
        );
        
        if (expiredSessions.length > 0) {
          // 为每个过期的会话显示失败通知
          expiredSessions.forEach(session => {
            const chain = prev.chains.find(c => c.id === session.chainId);
            if (chain) {
              notificationManager.notifyScheduleFailed(chain.name);
            }
          });
          
          // Show auxiliary judgment for the first expired session
          if (expiredSessions.length > 0) {
            setShowAuxiliaryJudgment(expiredSessions[0].chainId);
          }
          storage.saveScheduledSessions(activeScheduledSessions);
          return { ...prev, scheduledSessions: activeScheduledSessions };
        }
        
        return prev;
      });
    }, 10000); // Check every 10 seconds for better responsiveness

    return () => clearInterval(interval);
  }, [storage, isInitialized]);

  const handleCreateChain = () => {
    setState(prev => ({
      ...prev,
      currentView: 'editor',
      editingChain: null,
    }));
  };

  const handleCreateTaskGroup = () => {
    setState(prev => ({
      ...prev,
      currentView: 'taskgroup-editor',
      editingChain: null,
    }));
  };

  // 辅助函数：安全保存链条数据，保持回收箱完整
  const safelySaveChains = async (updatedActiveChains: Chain[]) => {
    try {
      // 获取所有现有链条（包括已删除的）
      const allExistingChains = await storage.getChains();
      const deletedChains = allExistingChains.filter(chain => chain.deletedAt != null);
      
      // 合并活跃链条和已删除链条
      const allUpdatedChains = [...updatedActiveChains, ...deletedChains];
      
      // 保存合并后的数据
      await storage.saveChains(allUpdatedChains);
      
      // CRITICAL FIX: Clear cache immediately after save operation
      queryOptimizer.onDataChange('chains');
      
      console.log('✅ Safe save completed, recycle bin data preserved');
    } catch (error) {
      console.error('❌ Safe save failed:', error);
      throw error;
    }
  };

  const handleEditChain = (chainId: string) => {
    const chain = state.chains.find(c => c.id === chainId);
    if (chain) {
      // 区分任务群和普通链条的编辑
      const isTaskGroup = chain.type === 'group' || chain.isTaskGroup;
      setState(prev => ({
        ...prev,
        currentView: isTaskGroup ? 'taskgroup-editor' : 'editor',
        editingChain: chain,
      }));
    }
  };

  const handleSaveChain = async (chainData: Omit<Chain, 'id' | 'currentStreak' | 'auxiliaryStreak' | 'totalCompletions' | 'totalFailures' | 'auxiliaryFailures' | 'createdAt' | 'lastCompletedAt'>) => {
    console.log('Starting to save chain data...', chainData);
    console.log('Currently editing chain:', state.editingChain);
    console.log('当前所有链条:', state.chains.map(c => ({ id: c.id, name: c.name })));
    
    try {
      // CRITICAL FIX: 获取所有链条（包括已删除的）以避免覆盖回收箱数据
      const allExistingChains = await storage.getChains();
      console.log('获取到所有现有链条（包括已删除的）:', allExistingChains.length);
      
      // 分离活跃链条和已删除链条
      const activeChains = allExistingChains.filter(chain => chain.deletedAt == null);
      const deletedChains = allExistingChains.filter(chain => chain.deletedAt != null);
      console.log('活跃链条数量:', activeChains.length, '已删除链条数量:', deletedChains.length);
      
      let updatedActiveChains: Chain[];
      
      if (state.editingChain) {
        // Editing existing chain
        console.log('编辑模式 - 原始链条数据:', state.editingChain);
        console.log('新的链条数据:', chainData);
        
        updatedActiveChains = state.chains.map(chain =>
          chain.id === state.editingChain!.id
            ? { ...chain, ...chainData }
            : chain
        );
        console.log('编辑现有链，更新后的活跃链数组长度:', updatedActiveChains.length);
        const editedChain = updatedActiveChains.find(c => c.id === state.editingChain!.id);
        console.log('编辑后的链数据:', editedChain);
      } else {
        // Creating new chain
        const newChain: Chain = {
          id: crypto.randomUUID(),
          ...chainData,
          currentStreak: 0,
          auxiliaryStreak: 0,
          totalCompletions: 0,
          totalFailures: 0,
          auxiliaryFailures: 0,
          createdAt: new Date(),
        };
        console.log('创建新链:', newChain);
        updatedActiveChains = [...state.chains, newChain];
        console.log('添加新链后的活跃链数组长度:', updatedActiveChains.length);
      }
      
      // 确保所有活跃链都有必需的字段
      updatedActiveChains = updatedActiveChains.map(chain => ({
        ...chain,
        type: chain.type || 'unit',
        sortOrder: chain.sortOrder || Math.floor(Date.now() / 1000),
        parentId: chain.parentId || undefined,
      }));
      
      console.log('准备安全保存到存储（包含回收箱数据）...');
      // 使用安全保存方法
      await safelySaveChains(updatedActiveChains);
      queryOptimizer.onDataChange('chains');
      console.log('数据保存成功（包含回收箱数据），更新UI状态');
      
      // Only update state after successful save (only with active chains)
      setState(prev => ({
        ...prev,
        chains: updatedActiveChains,
        currentView: 'dashboard',
        editingChain: null,
      }));
      console.log('UI状态更新完成');
    } catch (error) {
      console.error('Failed to save chain:', error);
      // 提供更详细的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`保存失败: ${errorMessage}\n\n请查看控制台了解详细信息，然后重试`);
      
      // 如果保存失败，重新加载数据以确保状态一致性
      try {
        const currentChains = await storage.getActiveChains();
        setState(prev => ({
          ...prev,
          chains: currentChains,
        }));
      } catch (reloadError) {
        console.error('重新加载数据也失败了:', reloadError);
      }
    }
  };

  const handleScheduleChain = (chainId: string) => {
    // 检查是否已有该链的预约
    const existingSchedule = state.scheduledSessions.find(s => s.chainId === chainId);
    if (existingSchedule) return;

    const chain = state.chains.find(c => c.id === chainId);
    if (!chain) return;

    const scheduledSession: ScheduledSession = {
      chainId,
      scheduledAt: new Date(),
      expiresAt: new Date(Date.now() + chain.auxiliaryDuration * 60 * 1000), // Use chain's auxiliary duration
      auxiliarySignal: chain.auxiliarySignal,
    };

    const updateStateAndSave = async () => {
      try {
        const updatedSessions = [...state.scheduledSessions, scheduledSession];
        
        // 增加辅助链记录
        const updatedChains = state.chains.map(chain =>
          chain.id === chainId
            ? { ...chain, auxiliaryStreak: chain.auxiliaryStreak + 1 }
            : chain
        );
        
        // Save to storage first
        await Promise.all([
          storage.saveScheduledSessions(updatedSessions),
          safelySaveChains(updatedChains)
        ]);
        queryOptimizer.onDataChange('chains');
        
        // Update state after successful save
        setState(prev => ({ 
          ...prev,
          scheduledSessions: updatedSessions,
          chains: updatedChains
        }));
      } catch (error) {
        console.error('Failed to schedule chain:', error);
        alert('预约失败，请重试');
      }
    };

    updateStateAndSave();
  };

  const handleStartChain = (chainId: string) => {
    const chain = state.chains.find(c => c.id === chainId);
    if (!chain) return;

    // 检查是否存在对该链的预约会话
    const existingScheduledSession = state.scheduledSessions.find(
      session => session.chainId === chainId
    );

    // 如果是任务群，检查时间限定
    if (chain.type === 'group') {
      // 检查是否已过期
      if (isGroupExpired(chain)) {
        // 清空任务群进度
        const updatedChains = state.chains.map(c =>
          c.id === chainId ? resetGroupProgress(c) : c
        );
        
        setState(prev => ({
          ...prev,
          chains: updatedChains,
        }));
        
        // 显示过期通知
        notificationManager.notifyTaskFailed(chain.name, '任务群已超时');
        return;
      }

      // 如果任务群还没有开始计时，启动计时器
      if (chain.timeLimitHours && !chain.groupStartedAt) {
        const updatedChains = state.chains.map(c =>
          c.id === chainId ? startGroupTimer(c) : c
        );
        
        setState(prev => ({
          ...prev,
          chains: updatedChains,
        }));
      }

      const chainTree = queryOptimizer.memoizedBuildChainTree(state.chains);
      const groupNode = chainTree.find(node => node.id === chainId);
      if (groupNode) {
        const nextUnit = getNextUnitInGroup(groupNode);
        if (nextUnit) {
          console.log(`任务群 ${chain.name} 开始下一个任务: ${nextUnit.name}`);
          handleStartChain(nextUnit.id);
          return;
        } else {
          // No next unit available - all tasks completed or no tasks in group
          console.log(`任务群 ${chain.name} 没有可用的下一个任务`);
          notificationManager.notifyTaskCompleted(chain.name, 0, '所有任务已完成');
          return;
        }
      } else {
        console.error(`无法找到任务群节点: ${chainId}`);
        return;
      }
    }

    const activeSession: ActiveSession = {
      chainId,
      startedAt: new Date(),
      duration: chain.isDurationless ? 0 : chain.duration,
      isPaused: false,
      totalPausedTime: 0,
    };

    // Remove any scheduled session for this chain and update auxiliary streak if there was a booking
    const updatedScheduledSessions = state.scheduledSessions.filter(
      session => session.chainId !== chainId
    );

    // 如果存在预约，增加辅助链记录（相当于自动完成预约）
    let updatedChains = state.chains;
    if (existingScheduledSession) {
      updatedChains = state.chains.map(c =>
        c.id === chainId
          ? { ...c, auxiliaryStreak: c.auxiliaryStreak + 1 }
          : c
      );
      
      // 显示预约完成通知
      notificationManager.notifyTaskCompleted(`${chain.name} (预约)`, chain.auxiliaryStreak + 1, '预约已完成');
    }

    setState(prev => {
      storage.saveActiveSession(activeSession);
      storage.saveScheduledSessions(updatedScheduledSessions);
      
      // 如果有预约完成，保存更新的链条数据
      if (existingScheduledSession) {
        safelySaveChains(updatedChains).catch(error => {
      queryOptimizer.onDataChange('chains');
          console.error('开始任务时保存链条数据失败:', error);
        });
      }
      
      return {
        ...prev,
        activeSession,
        scheduledSessions: updatedScheduledSessions,
        chains: updatedChains,
        currentView: 'focus',
      };
    });
  };

  const handleCompleteSession = (description?: string, notes?: string) => {
    if (!state.activeSession) return;

    const chain = state.chains.find(c => c.id === state.activeSession!.chainId);
    if (!chain) return;

    // 计算实际用时
    let actualDuration = state.activeSession.duration; // 默认使用计划时长
    
    if (chain.isDurationless) {
      // 对于无时长任务，从正向计时器获取实际用时
      const sessionId = `${state.activeSession.chainId}_${state.activeSession.startedAt.getTime()}`;
      const elapsedSeconds = forwardTimerManager.stopTimer(sessionId);
      actualDuration = Math.ceil(elapsedSeconds / 60); // 转换为分钟并向上取整
    }

    // 显示任务完成通知
    const newStreak = chain.currentStreak + 1;
    notificationManager.notifyTaskCompleted(chain.name, newStreak);

    const completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt: new Date(),
      duration: state.activeSession.duration,
      wasSuccessful: true,
      actualDuration: actualDuration,
      isForwardTimed: !!chain.isDurationless,
      description: description,
      notes: notes,
    };

    setState(prev => {
      let updatedChains = prev.chains.map(c =>
        c.id === chain.id
          ? {
              ...c,
              currentStreak: c.currentStreak + 1,
              totalCompletions: c.totalCompletions + 1,
              lastCompletedAt: new Date(),
            }
          : c
      );
      
      // 如果完成的是单元任务，且该单元属于某个任务群，检查任务群是否完成
      if (chain.parentId && chain.type !== 'group') {
        // 构建任务树来检查任务群状态
        const chainTree = queryOptimizer.memoizedBuildChainTree(updatedChains);
        const groupNode = chainTree.find(node => node.id === chain.parentId);
        
        if (groupNode && groupNode.type === 'group') {
          // 检查任务群中的所有任务是否都已完成其重复次数
          if (isGroupFullyCompleted(groupNode)) {
            console.log(`任务群 ${groupNode.name} 已完成所有任务，增加完成计数`);
            
            // 增加任务群的完成计数并重置子任务进度
            updatedChains = incrementGroupCompletionCount(updatedChains, chain.parentId);
            
            // 显示任务群完成通知
            const parentChain = updatedChains.find(c => c.id === chain.parentId);
            if (parentChain) {
              notificationManager.notifyTaskCompleted(
                `${parentChain.name} (任务群)`, 
                parentChain.currentStreak, 
                '任务群完成一轮'
              );
            }
          }
        }
      }

      const updatedHistory = [...prev.completionHistory, completionRecord];
      
      // 使用安全保存方法保持回收箱数据完整
      safelySaveChains(updatedChains).catch(error => {
      queryOptimizer.onDataChange('chains');
        console.error('完成任务时保存链条数据失败:', error);
      });
      storage.saveActiveSession(null);
      storage.saveCompletionHistory(updatedHistory);
      
      // 更新用时统计（仅对成功完成的任务）
      if (completionRecord.actualDuration) {
        storage.updateTaskTimeStats(chain.id, completionRecord.actualDuration);
      }

      return {
        ...prev,
        chains: updatedChains,
        activeSession: null,
        completionHistory: updatedHistory,
        currentView: 'dashboard',
      };
    });
  };

  const handleInterruptSession = (reason?: string) => {
    if (!state.activeSession) return;

    const chain = state.chains.find(c => c.id === state.activeSession!.chainId);
    if (!chain) return;

    // 清理正向计时器（如果是无时长任务）
    if (chain.isDurationless) {
      const sessionId = `${state.activeSession.chainId}_${state.activeSession.startedAt.getTime()}`;
      forwardTimerManager.clearTimer(sessionId);
    }

    const completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt: new Date(),
      duration: state.activeSession.duration,
      wasSuccessful: false,
      reasonForFailure: reason || '用户主动中断',
      actualDuration: state.activeSession.duration, // 中断时使用计划时长
      isForwardTimed: !!chain.isDurationless,
    };

    setState(prev => {
      let updatedChains = prev.chains.map(c =>
        c.id === chain.id
          ? {
              ...c,
              currentStreak: 0, // Reset streak
              totalFailures: c.totalFailures + 1,
            }
          : c
      );

      // 如果中断的是单元任务，且该单元属于某个任务群，重置任务群的完成计数
      if (chain.parentId && chain.type !== 'group') {
        console.log(`任务 ${chain.name} 失败/中断，重置任务群完成计数`);
        updatedChains = resetGroupCompletionCount(updatedChains, chain.parentId);
      }

      const updatedHistory = [...prev.completionHistory, completionRecord];
      
      // 使用安全保存方法保持回收箱数据完整
      safelySaveChains(updatedChains).catch(error => {
      queryOptimizer.onDataChange('chains');
        console.error('中断任务时保存链条数据失败:', error);
      });
      storage.saveActiveSession(null);
      storage.saveCompletionHistory(updatedHistory);

      return {
        ...prev,
        chains: updatedChains,
        activeSession: null,
        completionHistory: updatedHistory,
        currentView: 'dashboard',
      };
    });
  };

  const handlePauseSession = () => {
    if (!state.activeSession) return;

    setState(prev => {
      const updatedSession = {
        ...prev.activeSession!,
        isPaused: true,
        pausedAt: new Date(),
      };
      
      storage.saveActiveSession(updatedSession);
      
      return {
        ...prev,
        activeSession: updatedSession,
      };
    });
  };

  const handleResumeSession = () => {
    if (!state.activeSession || !state.activeSession.pausedAt) return;

    setState(prev => {
      const pauseDuration = Date.now() - prev.activeSession!.pausedAt!.getTime();
      const updatedSession = {
        ...prev.activeSession!,
        isPaused: false,
        pausedAt: undefined,
        totalPausedTime: prev.activeSession!.totalPausedTime + pauseDuration,
      };
      
      storage.saveActiveSession(updatedSession);
      
      return {
        ...prev,
        activeSession: updatedSession,
      };
    });
  };

  const handleAuxiliaryJudgmentFailure = (chainId: string) => {
    setState(prev => {
      // Remove the scheduled session
      const updatedScheduledSessions = prev.scheduledSessions.filter(
        session => session.chainId !== chainId
      );
      
      const updatedChains = prev.chains.map(chain =>
        chain.id === chainId
          ? {
              ...chain,
              auxiliaryStreak: 0, // Reset auxiliary streak
              auxiliaryFailures: chain.auxiliaryFailures + 1
            }
          : chain
      );
      
      // 使用安全保存方法保持回收箱数据完整
      safelySaveChains(updatedChains).catch(error => {
      queryOptimizer.onDataChange('chains');
        console.error('辅助判断失败时保存链条数据失败:', error);
      });
      storage.saveScheduledSessions(updatedScheduledSessions);
      
      return {
        ...prev,
        chains: updatedChains,
        scheduledSessions: updatedScheduledSessions,
      };
    });
    
    setShowAuxiliaryJudgment(null);
  };

  const handleAuxiliaryJudgmentAllow = (chainId: string, exceptionRule: string) => {
    setState(prev => {
      // Remove the scheduled session
      const updatedScheduledSessions = prev.scheduledSessions.filter(
        session => session.chainId !== chainId
      );
      
      const updatedChains = prev.chains.map(chain =>
        chain.id === chainId
          ? {
              ...chain,
              auxiliaryExceptions: [...(chain.auxiliaryExceptions || []), exceptionRule]
            }
          : chain
      );
      
      // 使用安全保存方法保持回收箱数据完整
      safelySaveChains(updatedChains).catch(error => {
      queryOptimizer.onDataChange('chains');
        console.error('辅助判断允许时保存链条数据失败:', error);
      });
      storage.saveScheduledSessions(updatedScheduledSessions);
      
      return {
        ...prev,
        chains: updatedChains,
        scheduledSessions: updatedScheduledSessions,
      };
    });
    
    setShowAuxiliaryJudgment(null);
  };

  const handleCancelScheduledSession = (chainId: string) => {
    setShowAuxiliaryJudgment(chainId);
  };

  const handleCompleteBooking = (chainId: string) => {
    setState(prev => {
      // 移除对应的预约会话
      const updatedScheduledSessions = prev.scheduledSessions.filter(
        session => session.chainId !== chainId
      );
      
      // 找到对应的链条并增加辅助链记录
      const updatedChains = prev.chains.map(chain =>
        chain.id === chainId
          ? { ...chain, auxiliaryStreak: chain.auxiliaryStreak + 1 }
          : chain
      );
      
      // 保存更新的数据
      storage.saveScheduledSessions(updatedScheduledSessions);
      safelySaveChains(updatedChains).catch(error => {
      queryOptimizer.onDataChange('chains');
        console.error('完成预约时保存链条数据失败:', error);
      });
      
      return {
        ...prev,
        scheduledSessions: updatedScheduledSessions,
        chains: updatedChains
      };
    });
    
    // 显示完成通知
    const chain = state.chains.find(c => c.id === chainId);
    if (chain) {
      notificationManager.notifyTaskCompleted(`${chain.name} (预约)`, chain.auxiliaryStreak + 1, '预约已完成');
    }
  };

  const handleAddException = (exceptionRule: string) => {
    if (!state.activeSession) return;

    setState(prev => {
      const updatedChains = prev.chains.map(chain =>
        chain.id === prev.activeSession!.chainId
          ? {
              ...chain,
              exceptions: [...(chain.exceptions || []), exceptionRule]
            }
          : chain
      );
      
      // 使用安全保存方法保持回收箱数据完整
      safelySaveChains(updatedChains).catch(error => {
      queryOptimizer.onDataChange('chains');
        console.error('添加异常时保存链条数据失败:', error);
      });
      
      return {
        ...prev,
        chains: updatedChains,
      };
    });
  };

  const handleViewChainDetail = (chainId: string) => {
    const chain = state.chains.find(c => c.id === chainId);
    if (!chain) return;
    
    const viewType = chain.type === 'group' ? 'group' : 'detail';
    
    setState(prev => ({
      ...prev,
      currentView: viewType,
      viewingChainId: chainId,
    }));
  };

  const handleBackToDashboard = () => {
    setState(prev => ({
      ...prev,
      currentView: 'dashboard',
      editingChain: null,
      viewingChainId: null,
    }));
  };

  const handleDeleteChain = async (chainId: string) => {
    try {
      // ENHANCED: Use real-time sync service for immediate and reliable updates
      const updatedChains = await realTimeSyncService.deleteWithSync(storage, chainId);
      
      setState(prev => {
        // Remove any scheduled sessions for this chain
        const updatedScheduledSessions = prev.scheduledSessions.filter(
          session => session.chainId !== chainId
        );
        
        // If currently active session belongs to this chain, clear it
        const updatedActiveSession = prev.activeSession?.chainId === chainId 
          ? null 
          : prev.activeSession;
        
        // Save updated sessions to storage
        storage.saveScheduledSessions(updatedScheduledSessions);
        if (!updatedActiveSession) {
          storage.saveActiveSession(null);
        }
        
        return {
          ...prev,
          chains: updatedChains,
          scheduledSessions: updatedScheduledSessions,
          activeSession: updatedActiveSession,
          currentView: updatedActiveSession ? prev.currentView : 'dashboard',
          viewingChainId: prev.viewingChainId === chainId ? null : prev.viewingChainId,
        };
      });
      
      console.log(`链条 ${chainId} 已移动到回收箱`);
    } catch (error) {
      console.error('删除链条失败:', error);
      alert('删除失败，请重试');
    }
  };

  const handleRestoreChains = async (chainIds: string[]) => {
    try {
      console.log('恢复链条:', chainIds);
      
      // ENHANCED: Use real-time sync service for immediate and reliable updates
      const updatedChains = await realTimeSyncService.restoreWithSync(storage, chainIds);
      
      setState(prev => ({
        ...prev,
        chains: updatedChains,
      }));
      
      console.log(`成功恢复 ${chainIds.length} 条链条`);
    } catch (error) {
      console.error('恢复链条失败:', error);
      alert('恢复失败，请重试');
    }
  };

  const handlePermanentDeleteChains = async (chainIds: string[]) => {
    try {
      console.log('永久删除链条:', chainIds);
      
      // 批量永久删除链条
      for (const chainId of chainIds) {
        await storage.permanentlyDeleteChain(chainId);
      }
      
      // CRITICAL FIX: Clear cache after database operations
      queryOptimizer.onDataChange('chains');
      
      console.log(`成功永久删除 ${chainIds.length} 条链条`);
    } catch (error) {
      console.error('永久删除链条失败:', error);
      alert('永久删除失败，请重试');
    }
  };

  const handleImportChains = async (importedChains: Chain[], options?: { 
    history?: CompletionHistory[];
    rsipNodes?: RSIPNode[];
    rsipMeta?: RSIPMeta;
    exceptionRules?: any[];
  }) => {
    console.log('开始导入数据...', { chains: importedChains.length, options });
    
    try {
      // 合并导入的链条到现有链条中
      const updatedChains = [...state.chains, ...importedChains];
      const importedHistory = options?.history || [];
      const importedRsipNodes = options?.rsipNodes || [];
      const importedRsipMeta = options?.rsipMeta;
      
      console.log('准备保存导入的数据到存储...');
      
      // 保存链条数据
      await safelySaveChains(updatedChains);
      queryOptimizer.onDataChange('chains');
      
      // 保存完成历史
      if (Array.isArray(importedHistory) && importedHistory.length > 0) {
        const existing = await storage.getCompletionHistory();
        const merged = [...existing, ...importedHistory];
        await storage.saveCompletionHistory(merged);
      }
      
      // 保存 RSIP 节点数据
      if (Array.isArray(importedRsipNodes) && importedRsipNodes.length > 0) {
        const existingNodes = await storage.getRSIPNodes();
        const mergedNodes = [...existingNodes, ...importedRsipNodes];
        await storage.saveRSIPNodes(mergedNodes);
      }
      
      // 保存 RSIP 元数据
      if (importedRsipMeta) {
        const existingMeta = await storage.getRSIPMeta();
        const mergedMeta = { ...existingMeta, ...importedRsipMeta };
        await storage.saveRSIPMeta(mergedMeta);
      }
      
      console.log('导入数据保存成功，更新UI状态');
      
      // 更新状态
      setState(prev => ({
        ...prev,
        chains: updatedChains,
        completionHistory: Array.isArray(importedHistory) && importedHistory.length > 0
          ? [...prev.completionHistory, ...importedHistory]
          : prev.completionHistory,
        rsipNodes: Array.isArray(importedRsipNodes) && importedRsipNodes.length > 0
          ? [...prev.rsipNodes, ...importedRsipNodes]
          : prev.rsipNodes,
        rsipMeta: importedRsipMeta ? { ...prev.rsipMeta, ...importedRsipMeta } : prev.rsipMeta,
      }));
      
      console.log('导入完成，UI状态更新完成');
    } catch (error) {
      console.error('Failed to import data:', error);
      // 提供更详细的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`导入失败: ${errorMessage}\n\n请查看控制台了解详细信息，然后重试`);
      
      // 如果导入失败，重新加载数据以确保状态一致性
      try {
        const currentChains = await storage.getChains();
        const currentRsipNodes = await storage.getRSIPNodes();
        const currentRsipMeta = await storage.getRSIPMeta();
        setState(prev => ({
          ...prev,
          chains: currentChains,
          rsipNodes: currentRsipNodes,
          rsipMeta: currentRsipMeta,
        }));
      } catch (reloadError) {
        console.error('重新加载数据也失败了:', reloadError);
      }
    }
  };

  const handleImportUnits = async (unitIds: string[], groupId: string, mode: 'move' | 'copy' = 'copy') => {
    console.log('开始导入单元到任务群...', { unitIds, groupId, mode });
    
    try {
      let updatedChains: Chain[];
      
      if (mode === 'copy') {
        // 复制模式：创建副本并加入任务群，原单元保持独立
        const copiesToAdd: Chain[] = [];
        
        state.chains.forEach(chain => {
          if (unitIds.includes(chain.id)) {
            const copy: Chain = {
              ...chain,
              id: crypto.randomUUID(), // 生成新的ID
              name: `${chain.name} (副本)`, // 添加副本标识
              parentId: groupId,
              currentStreak: 0, // 重置记录
              auxiliaryStreak: 0,
              totalCompletions: 0,
              totalFailures: 0,
              auxiliaryFailures: 0,
              createdAt: new Date(),
              lastCompletedAt: undefined,
            };
            copiesToAdd.push(copy);
          }
        });
        
        updatedChains = [...state.chains, ...copiesToAdd];
      } else {
        // 移动模式：更新选中单元的 parentId 为目标任务群的 ID
        updatedChains = state.chains.map(chain => {
          if (unitIds.includes(chain.id)) {
            return { ...chain, parentId: groupId };
          }
          return chain;
        });
      }
      
      console.log('准备保存导入后的数据到存储...');
      // Wait for data to be saved before updating UI - 使用安全保存方法
      await safelySaveChains(updatedChains);
      queryOptimizer.onDataChange('chains');
      console.log('导入数据保存成功，更新UI状态');
      
      // Only update state after successful save
      setState(prev => ({
        ...prev,
        chains: updatedChains,
      }));
      console.log('导入完成，UI状态更新完成');
    } catch (error) {
      console.error('Failed to import units:', error);
      // 提供更详细的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`导入失败: ${errorMessage}\n\n请查看控制台了解详细信息，然后重试`);
      
      // 如果导入失败，重新加载数据以确保状态一致性
      try {
        const currentChains = await storage.getChains();
        setState(prev => ({
          ...prev,
          chains: currentChains,
        }));
      } catch (reloadError) {
        console.error('重新加载数据也失败了:', reloadError);
      }
    }
  };

  const handleUpdateTaskRepeatCount = async (chainId: string, repeatCount: number) => {
    console.log('开始更新任务重复次数...', { chainId, repeatCount });
    
    try {
      // 找到要更新的链条
      const updatedChains = state.chains.map(chain => {
        if (chain.id === chainId) {
          return { ...chain, taskRepeatCount: repeatCount };
        }
        return chain;
      });

      console.log('准备保存重复次数更新到存储...');
      // Wait for data to be saved before updating UI - 使用安全保存方法
      await safelySaveChains(updatedChains);
      queryOptimizer.onDataChange('chains');
      console.log('重复次数更新保存成功，更新UI状态');

      // Only update state after successful save
      setState(prev => ({
        ...prev,
        chains: updatedChains,
      }));
      console.log('重复次数更新完成，UI状态更新完成');
    } catch (error) {
      console.error('Failed to update task repeat count:', error);
      // 提供更详细的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`重复次数更新失败: ${errorMessage}\n\n请查看控制台了解详细信息，然后重试`);
      
      // 如果更新失败，重新加载数据以确保状态一致性
      try {
        const currentChains = await storage.getChains();
        setState(prev => ({
          ...prev,
          chains: currentChains,
        }));
      } catch (reloadError) {
        console.error('重新加载数据也失败了:', reloadError);
      }
    }
  };

  return renderContent();
}

export default App;
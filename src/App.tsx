import React, { useState, useEffect } from 'react';
import { AppState, Chain, ScheduledSession, ActiveSession, CompletionHistory, ExceptionRule } from './types';
import { Dashboard } from './components/Dashboard';
import { ChainEditor } from './components/ChainEditor';
import { FocusMode } from './components/FocusMode';
import { ChainDetail } from './components/ChainDetail';
import { AuxiliaryJudgment } from './components/AuxiliaryJudgment';
import { storage } from './utils/storage';
import { isSessionExpired } from './utils/time';

function App() {
  const [state, setState] = useState<AppState>({
    chains: [],
    scheduledSessions: [],
    activeSession: null,
    currentView: 'dashboard',
    editingChain: null,
    viewingChainId: null,
    completionHistory: [],
  });

  const [showAuxiliaryJudgment, setShowAuxiliaryJudgment] = useState<string | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const chains = storage.getChains();
    const scheduledSessions = storage.getScheduledSessions().filter(
      session => !isSessionExpired(session.expiresAt)
    );
    const activeSession = storage.getActiveSession();
    const completionHistory = storage.getCompletionHistory();

    setState(prev => ({
      ...prev,
      chains,
      scheduledSessions,
      activeSession,
      completionHistory,
      currentView: activeSession ? 'focus' : 'dashboard',
    }));

    // Clean up expired sessions
    if (scheduledSessions.length !== storage.getScheduledSessions().length) {
      storage.saveScheduledSessions(scheduledSessions);
    }
  }, []);

  // Clean up expired scheduled sessions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const expiredSessions = prev.scheduledSessions.filter(
          session => isSessionExpired(session.expiresAt)
        );
        const activeScheduledSessions = prev.scheduledSessions.filter(
          session => !isSessionExpired(session.expiresAt)
        );
        
        if (expiredSessions.length > 0) {
          // Show auxiliary judgment for the first expired session
          setShowAuxiliaryJudgment(expiredSessions[0].chainId);
          storage.saveScheduledSessions(activeScheduledSessions);
          return { ...prev, scheduledSessions: activeScheduledSessions };
        }
        
        return prev;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleCreateChain = () => {
    setState(prev => ({
      ...prev,
      currentView: 'editor',
      editingChain: null,
    }));
  };

  const handleEditChain = (chainId: string) => {
    const chain = state.chains.find(c => c.id === chainId);
    if (chain) {
      setState(prev => ({
        ...prev,
        currentView: 'editor',
        editingChain: chain,
      }));
    }
  };

  const handleSaveChain = (chainData: Omit<Chain, 'id' | 'currentStreak' | 'totalCompletions' | 'totalFailures' | 'createdAt' | 'lastCompletedAt' | 'auxiliaryStreak' | 'auxiliaryFailures'>) => {
    setState(prev => {
      let updatedChains: Chain[];
      
      if (prev.editingChain) {
        // Editing existing chain
        updatedChains = prev.chains.map(chain =>
          chain.id === prev.editingChain!.id
            ? { ...chain, ...chainData }
            : chain
        );
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
        updatedChains = [...prev.chains, newChain];
      }
      
      storage.saveChains(updatedChains);
      
      return {
        ...prev,
        chains: updatedChains,
        currentView: 'dashboard',
        editingChain: null,
      };
    });
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

    setState(prev => {
      const updatedSessions = [...prev.scheduledSessions, scheduledSession];
      storage.saveScheduledSessions(updatedSessions);
      
      // 增加辅助链记录
      const updatedChains = prev.chains.map(chain =>
        chain.id === chainId
          ? { ...chain, auxiliaryStreak: chain.auxiliaryStreak + 1 }
          : chain
      );
      storage.saveChains(updatedChains);
      
      return { 
        ...prev, 
        scheduledSessions: updatedSessions,
        chains: updatedChains
      };
    });
  };

  const handleStartChain = (chainId: string) => {
    const chain = state.chains.find(c => c.id === chainId);
    if (!chain) return;

    const activeSession: ActiveSession = {
      chainId,
      startedAt: new Date(),
      duration: chain.duration,
      isPaused: false,
      totalPausedTime: 0,
    };

    // Remove any scheduled session for this chain
    const updatedScheduledSessions = state.scheduledSessions.filter(
      session => session.chainId !== chainId
    );

    setState(prev => {
      storage.saveActiveSession(activeSession);
      storage.saveScheduledSessions(updatedScheduledSessions);
      
      return {
        ...prev,
        activeSession,
        scheduledSessions: updatedScheduledSessions,
        currentView: 'focus',
      };
    });
  };

  const handleCompleteSession = (session: ActiveSession) => {
    const chain = state.chains.find(c => c.id === session.chainId);
    if (!chain) return;

    const actualDuration = session.learnedDuration || Math.floor(
      (Date.now() - session.startedAt.getTime() - session.totalPausedTime) / 60000
    );
    
    const completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt: new Date(),
      plannedDuration: chain.duration,
      extraDuration: Math.max(0, actualDuration - chain.duration),
      actualDuration: actualDuration,
      wasSuccessful: true,
    };

    setState(prev => {
      const updatedChains = prev.chains.map(c =>
        c.id === chain.id
          ? {
              ...c,
              currentStreak: c.currentStreak + 1,
              totalCompletions: c.totalCompletions + 1,
              lastCompletedAt: new Date(),
            }
          : c
      );

      const updatedHistory = [...prev.completionHistory, completionRecord];
      
      storage.saveChains(updatedChains);
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

  const handleInterruptSession = (reason: string, session: ActiveSession) => {
    const chain = state.chains.find(c => c.id === session.chainId);
    if (!chain) return;

    const actualDuration = session.learnedDuration || Math.floor(
      (Date.now() - session.startedAt.getTime() - session.totalPausedTime) / 60000
    );
    
    const completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt: new Date(),
      plannedDuration: chain.duration,
      extraDuration: Math.max(0, actualDuration - chain.duration),
      actualDuration: actualDuration,
      wasSuccessful: false,
      reasonForFailure: reason || '用户主动中断',
    };

    setState(prev => {
      const updatedChains = prev.chains.map(c =>
        c.id === chain.id
          ? {
              ...c,
              currentStreak: 0, // Reset streak
              totalFailures: c.totalFailures + 1,
            }
          : c
      );

      const updatedHistory = [...prev.completionHistory, completionRecord];
      
      storage.saveChains(updatedChains);
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
      
      storage.saveChains(updatedChains);
      storage.saveScheduledSessions(updatedScheduledSessions);
      
      return {
        ...prev,
        chains: updatedChains,
        scheduledSessions: updatedScheduledSessions,
      };
    });
    
    setShowAuxiliaryJudgment(null);
  };

  const handleAuxiliaryJudgmentAllow = (chainId: string, exceptionRule: ExceptionRule) => {
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
      
      storage.saveChains(updatedChains);
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

  const handleAddException = (exceptionRule: ExceptionRule) => {
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
      
      storage.saveChains(updatedChains);
      
      return {
        ...prev,
        chains: updatedChains,
      };
    });
  };
  const handleViewChainDetail = (chainId: string) => {
    setState(prev => ({
      ...prev,
      currentView: 'detail',
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

  const handleDeleteChain = (chainId: string) => {
    setState(prev => {
      // Remove the chain
      const updatedChains = prev.chains.filter(chain => chain.id !== chainId);
      
      // Remove any scheduled sessions for this chain
      const updatedScheduledSessions = prev.scheduledSessions.filter(
        session => session.chainId !== chainId
      );
      
      // Remove completion history for this chain
      const updatedHistory = prev.completionHistory.filter(
        history => history.chainId !== chainId
      );
      
      // If currently active session belongs to this chain, clear it
      const updatedActiveSession = prev.activeSession?.chainId === chainId 
        ? null 
        : prev.activeSession;
      
      // Save to storage
      storage.saveChains(updatedChains);
      storage.saveScheduledSessions(updatedScheduledSessions);
      storage.saveCompletionHistory(updatedHistory);
      if (!updatedActiveSession) {
        storage.saveActiveSession(null);
      }
      
      return {
        ...prev,
        chains: updatedChains,
        scheduledSessions: updatedScheduledSessions,
        completionHistory: updatedHistory,
        activeSession: updatedActiveSession,
        currentView: updatedActiveSession ? prev.currentView : 'dashboard',
        viewingChainId: prev.viewingChainId === chainId ? null : prev.viewingChainId,
      };
    });
  };

  // Render current view
  switch (state.currentView) {
    case 'editor':
      return (
        <>
          <ChainEditor
            chain={state.editingChain || undefined}
            isEditing={!!state.editingChain}
            onSave={handleSaveChain}
            onCancel={handleBackToDashboard}
          />
          {showAuxiliaryJudgment && (
          <AuxiliaryJudgment
            chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
            onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment)}
            onJudgmentAllow={(exceptionRule: string) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, {
              id: crypto.randomUUID(),
              name: '自定义例外',
              condition: exceptionRule,
              editable: true
            })}
            onCancel={() => setShowAuxiliaryJudgment(null)}
          />
          )}
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
            onComplete={handleCompleteSession}
            onInterrupt={handleInterruptSession}
            onAddException={handleAddException}
            onPause={handlePauseSession}
            onResume={handleResumeSession}
          />
          {showAuxiliaryJudgment && (
            <AuxiliaryJudgment
              chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
            onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment)}
            onJudgmentAllow={(exceptionRule: string) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, {
              id: crypto.randomUUID(),
              name: '自定义例外',
              condition: exceptionRule,
              editable: true
            })}
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
            onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment)}
            onJudgmentAllow={(exceptionRule: string) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, {
              id: crypto.randomUUID(),
              name: '自定义例外',
              condition: exceptionRule,
              editable: true
            })}
              onCancel={() => setShowAuxiliaryJudgment(null)}
            />
          )}
        </>
      );
    }

    default:
      return (
        <>
          <Dashboard
            chains={state.chains}
            scheduledSessions={state.scheduledSessions}
            onCreateChain={handleCreateChain}
            onStartChain={handleStartChain}
            onScheduleChain={handleScheduleChain}
            onViewChainDetail={handleViewChainDetail}
            onCancelScheduledSession={handleCancelScheduledSession}
            onDeleteChain={handleDeleteChain}
          />
          {showAuxiliaryJudgment && (
            <AuxiliaryJudgment
              chain={state.chains.find(c => c.id === showAuxiliaryJudgment)!}
            onJudgmentFailure={() => handleAuxiliaryJudgmentFailure(showAuxiliaryJudgment)}
            onJudgmentAllow={(exceptionRule: string) => handleAuxiliaryJudgmentAllow(showAuxiliaryJudgment, {
              id: crypto.randomUUID(),
              name: '自定义例外',
              condition: exceptionRule,
              editable: true
            })}
              onCancel={() => setShowAuxiliaryJudgment(null)}
            />
          )}
        </>
      );
  }
}

export default App;

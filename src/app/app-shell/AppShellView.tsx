import { Suspense } from 'react';
import { Dashboard } from '../../components/Dashboard';
import { MobileBottomNav } from '../../components/mobile/MobileBottomNav';
import { useI18n } from '../../i18n';
import { fireAndForget as runAsync } from '../../utils/fireAndForget';
import { isTauriMobile } from '../../utils/platform';
import { AppShellProfiler } from './AppShellProfiler';
import { LoadingFallback } from './LoadingFallback';
import type { AppShellViewProps } from './types';
import {
  AuxiliaryJudgment,
  BettingModal,
  ChainDetail,
  ChainEditor,
  FocusMode,
  GroupView,
  PetWidget,
  RSIPView,
  TaskGroupEditor,
} from './lazyViews';

export function AppShellView({
  app,
  dashboard,
  rsip,
  session,
  pet,
}: AppShellViewProps) {
  const { tr } = useI18n();
  const shouldShowPetWidget =
    app.isInitialized && app.currentView === 'dashboard';

  const renderAuxiliaryJudgment = () => {
    const auxiliaryJudgmentChain = session.auxiliaryJudgmentChain;
    if (!auxiliaryJudgmentChain) return null;

    return (
      <Suspense fallback={null}>
        <AuxiliaryJudgment
          chain={auxiliaryJudgmentChain}
          onJudgmentFailure={() =>
            session.handleAuxiliaryJudgmentFailure(auxiliaryJudgmentChain.id)
          }
          onJudgmentAllow={(exceptionRule) =>
            session.handleAuxiliaryJudgmentAllow(
              auxiliaryJudgmentChain.id,
              exceptionRule,
            )
          }
          onCancel={session.clearAuxiliaryJudgment}
        />
      </Suspense>
    );
  };

  const renderCurrentView = () => {
    if (!app.isInitialized) {
      return (
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="gradient-primary mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl shadow-xl">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
            </div>
            <h2 className="mb-2 font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100">
              {tr('正在初始化…', 'Initializing…')}
            </h2>
            <p className="font-mono text-sm text-gray-600 dark:text-slate-400">
              {tr('正在初始化应用', 'INITIALIZING APPLICATION')}
            </p>
          </div>
        </div>
      );
    }

    const editorProps = {
      chain: dashboard.editingChain ?? undefined,
      isEditing: !!dashboard.editingChain,
      initialParentId: dashboard.editorParentId ?? undefined,
      onSave: dashboard.handleSaveChain,
      onCancel: dashboard.handleBackToDashboard,
      rsipNodes: rsip.nodes,
      rsipTaskLinks: rsip.taskLinks,
      onUpsertRSIPTaskLinks: rsip.upsertTaskLinks,
    };

    switch (app.currentView) {
      case 'editor':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ChainEditor {...editorProps} />
            {renderAuxiliaryJudgment()}
          </Suspense>
        );

      case 'taskgroup-editor':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <TaskGroupEditor {...editorProps} />
          </Suspense>
        );

      case 'focus':
        if (!session.activeSession || !session.activeChain) return null;

        return (
          <Suspense fallback={<LoadingFallback />}>
            <AppShellProfiler id="focus-view">
              <FocusMode
                session={session.activeSession}
                chain={session.activeChain}
                onComplete={session.handleCompleteSession}
                onInterrupt={session.handleInterruptSession}
                onPause={session.handlePauseSession}
                onResume={session.handleResumeSession}
              />
            </AppShellProfiler>
            {renderAuxiliaryJudgment()}
          </Suspense>
        );

      case 'detail': {
        if (!dashboard.viewingChain) return null;
        const { viewingChain, handleDeleteChain } = dashboard;

        return (
          <Suspense fallback={<LoadingFallback />}>
            <ChainDetail
              chain={viewingChain}
              history={dashboard.completionHistory}
              onBack={dashboard.handleBackToDashboard}
              onEdit={() => dashboard.handleEditChain(viewingChain.id)}
              onDelete={() => runAsync(handleDeleteChain(viewingChain.id))}
            />
            {renderAuxiliaryJudgment()}
          </Suspense>
        );
      }

      case 'group': {
        if (!dashboard.viewingGroupNode) return null;

        const viewingGroupNode = dashboard.viewingGroupNode;

        return (
          <Suspense fallback={<LoadingFallback />}>
            <GroupView
              group={viewingGroupNode}
              scheduledSessions={dashboard.scheduledSessions}
              availableUnits={dashboard.chains}
              onBack={dashboard.handleBackToDashboard}
              onStartChain={dashboard.handleStartChain}
              onScheduleChain={dashboard.handleScheduleChain}
              onViewDetail={dashboard.handleViewChainDetail}
              onEditChain={dashboard.handleEditChain}
              onDeleteChain={dashboard.handleDeleteChain}
              onAddUnit={() => dashboard.handleCreateChain(viewingGroupNode.id)}
              onImportUnits={dashboard.handleImportUnits}
              onUpdateTaskRepeatCount={dashboard.handleUpdateTaskRepeatCount}
              onReorderUnit={dashboard.handleReorderUnit}
            />
            {renderAuxiliaryJudgment()}
          </Suspense>
        );
      }

      case 'rsip':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AppShellProfiler id="rsip-view">
              <RSIPView
                nodes={rsip.nodes}
                meta={rsip.meta}
                groups={rsip.groups}
                policyLibrary={rsip.policyLibrary}
                runHistory={rsip.runHistory}
                executionRecords={rsip.executionRecords}
                taskLinks={rsip.taskLinks}
                chains={rsip.chains}
                onBack={rsip.onBack}
                onSaveNodes={rsip.saveNodes}
                onSaveMeta={rsip.saveMeta}
                onSaveGroups={rsip.saveGroups}
                onSaveTaskLinks={rsip.saveTaskLinks}
                onMarkExecuted={rsip.markExecuted}
                onMarkViolated={rsip.markViolated}
                onReinforceNode={rsip.reinforceNode}
                onRestoreFromLibrary={rsip.restoreFromLibrary}
                onCreateGroup={rsip.createGroup}
                onUpsertTaskLinks={rsip.upsertTaskLinks}
                onGetTaskActions={rsip.getTaskActions}
                onStartChain={rsip.handleStartChain}
                onScheduleChain={rsip.handleScheduleChain}
              />
            </AppShellProfiler>
          </Suspense>
        );

      default:
        return (
          <>
            <AppShellProfiler id="dashboard-view">
              <Dashboard
                chains={dashboard.chains}
                scheduledSessions={dashboard.scheduledSessions}
                isLoading={app.isLoadingData}
                onCreateChain={dashboard.handleCreateChain}
                onCreateTaskGroup={dashboard.handleCreateTaskGroup}
                onOpenRSIP={dashboard.openRSIP}
                onStartChain={dashboard.handleStartChain}
                onScheduleChain={dashboard.handleScheduleChain}
                onViewChainDetail={dashboard.handleViewChainDetail}
                onCancelScheduledSession={
                  dashboard.handleCancelScheduledSession
                }
                onCompleteBooking={dashboard.handleCompleteBooking}
                onDeleteChain={dashboard.handleDeleteChain}
                onImportChains={dashboard.handleImportChains}
                onRestoreChains={dashboard.handleRestoreChains}
                onPermanentDeleteChains={dashboard.handlePermanentDeleteChains}
                history={dashboard.completionHistory}
                rsipNodes={rsip.nodes}
                rsipMeta={rsip.meta}
                rsipGroups={rsip.groups}
                rsipPolicyLibrary={rsip.policyLibrary}
                rsipRunHistory={rsip.runHistory}
                rsipExecutionRecords={rsip.executionRecords}
                rsipTaskLinks={rsip.taskLinks}
                petState={pet.pet}
              />
            </AppShellProfiler>
            {renderAuxiliaryJudgment()}
          </>
        );
    }
  };

  return (
    <div
      style={
        isTauriMobile
          ? {
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }
          : undefined
      }
    >
      <a
        href="#main"
        onClick={() => document.getElementById('main')?.focus()}
        className="focus-ring sr-only z-[200] rounded-xl bg-white/95 px-4 py-2 text-sm font-medium text-gray-900 shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 dark:bg-slate-900/90 dark:text-slate-100"
      >
        {tr('跳转到主要内容', 'Skip to main content')}
      </a>

      <main id="main" tabIndex={-1}>
        {renderCurrentView()}
      </main>

      {shouldShowPetWidget && (
        <Suspense fallback={null}>
          <AppShellProfiler id="pet-widget">
            <PetWidget
              pet={pet.pet}
              mood={pet.mood}
              isLoading={pet.isLoading}
              hasPet={pet.hasPet}
              onCreatePet={pet.createPet}
              onFeedPet={pet.feedPet}
              onUpdatePosition={pet.updatePosition}
              onUpdateMinimizedPosition={pet.updateMinimizedPosition}
              onToggleVisibility={pet.toggleVisibility}
              onMinimize={pet.minimize}
              onExpand={pet.expand}
            />
          </AppShellProfiler>
        </Suspense>
      )}

      {session.bettingModal.isOpen && session.bettingModal.sessionId && (
        <Suspense fallback={null}>
          <BettingModal
            isOpen={session.bettingModal.isOpen}
            onClose={session.handleBetCancelled}
            onBetPlaced={session.handleBetPlaced}
            sessionId={session.bettingModal.sessionId}
            chainName={
              session.bettingModal.chainName ?? tr('未知任务', 'Unknown Task')
            }
            taskDuration={session.bettingModal.taskDuration}
          />
        </Suspense>
      )}

      {isTauriMobile && (
        <MobileBottomNav
          currentView={app.currentView}
          hasActiveSession={app.hasActiveSession}
          onNavigate={app.onNavigateToView}
          onOpenSettings={() => undefined}
        />
      )}
    </div>
  );
}

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createGroupChain,
  createPetState,
  createUnitChain,
} from '../../../test/factories';
import {
  buildAppViewModel,
  buildDashboardViewModel,
  buildPetViewModel,
  buildRsipViewModel,
  buildSessionViewModel,
} from '../viewModelBuilders';

describe('viewModelBuilders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the app view model from shell state', () => {
    const onNavigateToView = vi.fn();

    const app = buildAppViewModel({
      isInitialized: true,
      isLoadingData: false,
      currentView: 'dashboard',
      hasActiveSession: false,
      onNavigateToView,
    });

    expect(app).toEqual({
      isInitialized: true,
      isLoadingData: false,
      currentView: 'dashboard',
      hasActiveSession: false,
      onNavigateToView,
    });
  });

  it('builds the dashboard model and derives the viewing chain and passes through the memoized group node', () => {
    const unit = createUnitChain({ id: 'unit-1' });
    const group = createGroupChain({ id: 'group-1' });
    const groupNode = {
      ...group,
      children: [],
      depth: 0,
    };

    const dashboard = buildDashboardViewModel({
      viewingGroupNode: groupNode,
      chains: [unit, group],
      scheduledSessions: [],
      editingChainId: null,
      viewingChainId: 'group-1',
      completionHistory: [],
      handleCreateChain: vi.fn(),
      handleCreateTaskGroup: vi.fn(),
      handleEditChain: vi.fn(),
      handleSaveChain: vi.fn(),
      handleViewChainDetail: vi.fn(),
      handleBackToDashboard: vi.fn(),
      openRSIP: vi.fn(),
      handleScheduleChain: vi.fn(),
      handleStartChain: vi.fn(async () => undefined),
      handleCancelScheduledSession: vi.fn(),
      handleCompleteBooking: vi.fn(),
      handleDeleteChain: vi.fn(async () => undefined),
      handleRestoreChains: vi.fn(async () => undefined),
      handlePermanentDeleteChains: vi.fn(async () => undefined),
      handleImportChains: vi.fn(async () => undefined),
      handleImportUnits: vi.fn(async () => undefined),
      handleUpdateTaskRepeatCount: vi.fn(async () => undefined),
      handleReorderUnit: vi.fn(async () => undefined),
    });

    expect(dashboard.viewingChain).toBe(group);
    expect(dashboard.viewingGroupNode).toEqual(groupNode);
  });

  it('keeps the group node absent outside the group view', () => {
    const unit = createUnitChain({ id: 'unit-1' });

    const dashboard = buildDashboardViewModel({
      viewingGroupNode: null,
      chains: [unit],
      scheduledSessions: [],
      editingChainId: null,
      viewingChainId: unit.id,
      completionHistory: [],
      handleCreateChain: vi.fn(),
      handleCreateTaskGroup: vi.fn(),
      handleEditChain: vi.fn(),
      handleSaveChain: vi.fn(),
      handleViewChainDetail: vi.fn(),
      handleBackToDashboard: vi.fn(),
      openRSIP: vi.fn(),
      handleScheduleChain: vi.fn(),
      handleStartChain: vi.fn(async () => undefined),
      handleCancelScheduledSession: vi.fn(),
      handleCompleteBooking: vi.fn(),
      handleDeleteChain: vi.fn(async () => undefined),
      handleRestoreChains: vi.fn(async () => undefined),
      handlePermanentDeleteChains: vi.fn(async () => undefined),
      handleImportChains: vi.fn(async () => undefined),
      handleImportUnits: vi.fn(async () => undefined),
      handleUpdateTaskRepeatCount: vi.fn(async () => undefined),
      handleReorderUnit: vi.fn(async () => undefined),
    });

    expect(dashboard.viewingChain).toBe(unit);
    expect(dashboard.viewingGroupNode).toBeNull();
  });

  it('builds the rsip model and preserves shared session handlers', () => {
    const handleStartChain = vi.fn(async () => undefined);
    const handleScheduleChain = vi.fn();
    const saveNodes = vi.fn();
    const getTaskActions = vi.fn(() => []);

    const rsip = buildRsipViewModel({
      nodes: [],
      meta: {},
      groups: [],
      policyLibrary: [],
      runHistory: [],
      executionRecords: [],
      taskLinks: [],
      chains: [createUnitChain({ id: 'unit-1' })],
      onBack: vi.fn(),
      saveNodes,
      saveMeta: vi.fn(),
      saveGroups: vi.fn(),
      saveTaskLinks: vi.fn(),
      markExecuted: vi.fn(async () => []),
      markViolated: vi.fn(async () => []),
      reinforceNode: vi.fn(async () => []),
      restoreFromLibrary: vi.fn(async () => null),
      createGroup: vi.fn(async () => ({
        id: 'group',
        title: 'Group',
        emoji: 'A',
        faultTolerance: 1,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      })),
      upsertTaskLinks: vi.fn(async () => []),
      getTaskActions,
      handleStartChain,
      handleScheduleChain,
    });

    expect(rsip.saveNodes).toBe(saveNodes);
    expect(rsip.getTaskActions).toBe(getTaskActions);
    expect(rsip.handleStartChain).toBe(handleStartChain);
    expect(rsip.handleScheduleChain).toBe(handleScheduleChain);
  });

  it('builds the session model and derives chain-backed modal data', () => {
    const unit = createUnitChain({
      id: 'unit-1',
      name: 'Focus Chain',
      duration: 45,
    });
    const auxChain = createUnitChain({ id: 'unit-2', name: 'Aux Chain' });
    const clearAuxiliaryJudgment = vi.fn();

    const session = buildSessionViewModel({
      chains: [unit, auxChain],
      activeSession: {
        chainId: unit.id,
        startedAt: new Date('2026-02-01T10:00:00.000Z'),
        duration: 45,
        isPaused: false,
        totalPausedTime: 0,
      },
      showAuxiliaryJudgment: auxChain.id,
      clearAuxiliaryJudgment,
      showBettingModal: true,
      pendingChainId: unit.id,
      currentSessionId: 'session-1',
      handleCompleteSession: vi.fn(),
      handleInterruptSession: vi.fn(),
      handlePauseSession: vi.fn(),
      handleResumeSession: vi.fn(),
      handleBetPlaced: vi.fn(async () => undefined),
      handleBetCancelled: vi.fn(async () => undefined),
      handleAuxiliaryJudgmentFailure: vi.fn(),
      handleAuxiliaryJudgmentAllow: vi.fn(),
    });

    expect(session.activeChain).toBe(unit);
    expect(session.auxiliaryJudgmentChain).toBe(auxChain);
    expect(session.clearAuxiliaryJudgment).toBe(clearAuxiliaryJudgment);
    expect(session.bettingModal).toEqual({
      isOpen: true,
      sessionId: 'session-1',
      chainName: 'Focus Chain',
      taskDuration: 45,
    });
  });

  it('reuses the pet domain object as the pet view model', () => {
    const pet = createPetState({ name: 'Momo' });
    const petDomain = {
      pet,
      mood: 'happy' as const,
      isLoading: false,
      hasPet: true,
      createPet: vi.fn(async () => pet),
      feedPet: vi.fn(async () => null),
      onTaskCompleted: vi.fn(async () => null),
      updatePosition: vi.fn(async () => undefined),
      updateMinimizedPosition: vi.fn(async () => undefined),
      toggleVisibility: vi.fn(async () => undefined),
      showPet: vi.fn(async () => undefined),
      minimize: vi.fn(async () => undefined),
      expand: vi.fn(async () => undefined),
    };

    expect(buildPetViewModel(petDomain)).toBe(petDomain);
  });
});

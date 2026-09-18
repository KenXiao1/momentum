import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppShellContainer from '../AppShellContainer';
import { createGroupChain, createUnitChain } from '../../test/factories';
import type { AppShellViewProps } from '../app-shell/types';
import {
  appShellStore,
  createInitialAppState,
} from '../../stores/appShellStore';
import {
  navigationStore,
  createInitialNavigationState,
} from '../../stores/navigationStore';

const useStorageMock = vi.hoisted(() => vi.fn());
const useSafeSaveChainsMock = vi.hoisted(() => vi.fn());
const useChainsDomainMock = vi.hoisted(() => vi.fn());
const useSessionsDomainMock = vi.hoisted(() => vi.fn());
const useBettingDomainMock = vi.hoisted(() => vi.fn());
const useRulesDomainMock = vi.hoisted(() => vi.fn());
const useRecycleBinDomainMock = vi.hoisted(() => vi.fn());
const useRsipDomainMock = vi.hoisted(() => vi.fn());
const useImportExportDomainMock = vi.hoisted(() => vi.fn());
const useGroupDomainMock = vi.hoisted(() => vi.fn());
const usePetDomainMock = vi.hoisted(() => vi.fn());

const useAppDataLoadMock = vi.hoisted(() => vi.fn());
const useAuthControllerMock = vi.hoisted(() => vi.fn());
const useServiceLifecycleMock = vi.hoisted(() => vi.fn());
const useViewValidationMock = vi.hoisted(() => vi.fn());
const useViewUrlSyncMock = vi.hoisted(() => vi.fn());
const usePeriodicCleanupMock = vi.hoisted(() => vi.fn());

const handlers = vi.hoisted(() => ({
  handleCreateChain: vi.fn(),
  handleCreateTaskGroup: vi.fn(),
  handleEditChain: vi.fn(),
  handleSaveChain: vi.fn(),
  handleScheduleChain: vi.fn(),
  handleStartChain: vi.fn(),
  handleCompleteSession: vi.fn(),
  handleInterruptSession: vi.fn(),
  handlePauseSession: vi.fn(),
  handleResumeSession: vi.fn(),
  handleCancelScheduledSession: vi.fn(),
  handleCompleteBooking: vi.fn(),
  handleBetPlaced: vi.fn(),
  handleBetCancelled: vi.fn(),
  handleAuxiliaryJudgmentFailure: vi.fn(),
  handleAuxiliaryJudgmentAllow: vi.fn(),
  handleDeleteChain: vi.fn(),
  handleRestoreChains: vi.fn(),
  handlePermanentDeleteChains: vi.fn(),
  openRSIP: vi.fn(),
  saveRSIPNodes: vi.fn(),
  saveRSIPMeta: vi.fn(),
  saveRSIPGroups: vi.fn(),
  saveRSIPTaskLinks: vi.fn(),
  markRSIPExecuted: vi.fn(),
  markRSIPViolated: vi.fn(),
  reinforceRSIPNode: vi.fn(),
  restoreRSIPFromLibrary: vi.fn(),
  createRSIPGroup: vi.fn(),
  upsertRSIPTaskLinks: vi.fn(),
  getRsipTaskActions: vi.fn(),
  handleTaskEventIntegration: vi.fn(),
  handleImportChains: vi.fn(),
  handleImportUnits: vi.fn(),
  handleUpdateTaskRepeatCount: vi.fn(),
  handleReorderUnit: vi.fn(),
}));

vi.mock('../../storage/useStorage', () => ({
  useStorage: useStorageMock,
}));

vi.mock('../../hooks/domains/useSafeSaveChains', () => ({
  useSafeSaveChains: useSafeSaveChainsMock,
}));

vi.mock('../../hooks/domains/useChainsDomain', () => ({
  useChainsDomain: useChainsDomainMock,
}));

vi.mock('../../hooks/domains/useSessionsDomain', () => ({
  useSessionsDomain: useSessionsDomainMock,
}));

vi.mock('../../hooks/domains/useBettingDomain', () => ({
  useBettingDomain: useBettingDomainMock,
}));

vi.mock('../../hooks/domains/useRulesDomain', () => ({
  useRulesDomain: useRulesDomainMock,
}));

vi.mock('../../hooks/domains/useRecycleBinDomain', () => ({
  useRecycleBinDomain: useRecycleBinDomainMock,
}));

vi.mock('../../hooks/domains/useRsipDomain', () => ({
  useRsipDomain: useRsipDomainMock,
}));

vi.mock('../../hooks/domains/useImportExportDomain', () => ({
  useImportExportDomain: useImportExportDomainMock,
}));

vi.mock('../../hooks/domains/useGroupDomain', () => ({
  useGroupDomain: useGroupDomainMock,
}));

vi.mock('../../hooks/domains/usePetDomain', () => ({
  usePetDomain: usePetDomainMock,
}));

vi.mock('../hooks/useAppDataLoad', () => ({
  useAppDataLoad: useAppDataLoadMock,
}));

vi.mock('../hooks/useAuthController', () => ({
  useAuthController: useAuthControllerMock,
}));

vi.mock('../hooks/useServiceLifecycle', () => ({
  useServiceLifecycle: useServiceLifecycleMock,
}));

vi.mock('../hooks/useViewValidation', () => ({
  useViewValidation: useViewValidationMock,
}));

vi.mock('../hooks/useViewUrlSync', () => ({
  useViewUrlSync: useViewUrlSyncMock,
}));

vi.mock('../hooks/usePeriodicCleanup', () => ({
  usePeriodicCleanup: usePeriodicCleanupMock,
}));

vi.mock('../AppShellView', () => ({
  AppShellView: (props: AppShellViewProps) => (
    <div>
      <div data-testid="initialized">{String(props.app.isInitialized)}</div>
      <div data-testid="loading">{String(props.app.isLoadingData)}</div>
      <div data-testid="view">{props.app.currentView}</div>
      <div data-testid="chain-context">
        {JSON.stringify({
          editing: props.dashboard.editingChain?.name ?? null,
          viewing: props.dashboard.viewingChain?.name ?? null,
          active: props.session.activeChain?.name ?? null,
          auxiliary: props.session.auxiliaryJudgmentChain?.name ?? null,
          betting: props.session.bettingModal,
        })}
      </div>
      <button onClick={props.session.clearAuxiliaryJudgment}>
        clear-auxiliary
      </button>
      <div data-testid="group-progress">
        {props.dashboard.viewingGroupNode?.children
          .map(
            (child) =>
              `${child.name}:${child.currentStreak}/${child.taskRepeatCount}`,
          )
          .join(',')}
      </div>
      <button onClick={props.dashboard.handleCreateChain}>create-chain</button>
      <button onClick={() => props.dashboard.handleDeleteChain('chain-1')}>
        delete-chain
      </button>
      <button onClick={props.dashboard.openRSIP}>open-rsip</button>
    </div>
  ),
}));

describe('AppShellContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appShellStore.getState().resetAppState();
    navigationStore.setState(createInitialNavigationState());

    useStorageMock.mockReturnValue({ kind: 'local' });
    useSafeSaveChainsMock.mockReturnValue(vi.fn(async () => undefined));
    usePetDomainMock.mockReturnValue({
      pet: null,
      mood: 'neutral',
      isLoading: false,
      hasPet: false,
      createPet: vi.fn(),
      feedPet: vi.fn(),
      onTaskCompleted: vi.fn(),
      updatePosition: vi.fn(),
      updateMinimizedPosition: vi.fn(),
      toggleVisibility: vi.fn(),
      showPet: vi.fn(),
      minimize: vi.fn(),
      expand: vi.fn(),
    });

    useChainsDomainMock.mockReturnValue({
      handleCreateChain: handlers.handleCreateChain,
      handleCreateTaskGroup: handlers.handleCreateTaskGroup,
      handleEditChain: handlers.handleEditChain,
      handleSaveChain: handlers.handleSaveChain,
    });
    useSessionsDomainMock.mockReturnValue({
      handleScheduleChain: handlers.handleScheduleChain,
      handleStartChain: handlers.handleStartChain,
      handleCompleteSession: handlers.handleCompleteSession,
      handleInterruptSession: handlers.handleInterruptSession,
      handlePauseSession: handlers.handlePauseSession,
      handleResumeSession: handlers.handleResumeSession,
      handleCancelScheduledSession: handlers.handleCancelScheduledSession,
      handleCompleteBooking: handlers.handleCompleteBooking,
    });
    useBettingDomainMock.mockReturnValue({
      handleBetPlaced: handlers.handleBetPlaced,
      handleBetCancelled: handlers.handleBetCancelled,
    });
    useRulesDomainMock.mockReturnValue({
      handleAuxiliaryJudgmentFailure: handlers.handleAuxiliaryJudgmentFailure,
      handleAuxiliaryJudgmentAllow: handlers.handleAuxiliaryJudgmentAllow,
    });
    useRecycleBinDomainMock.mockReturnValue({
      handleDeleteChain: handlers.handleDeleteChain,
      handleRestoreChains: handlers.handleRestoreChains,
      handlePermanentDeleteChains: handlers.handlePermanentDeleteChains,
    });
    useRsipDomainMock.mockReturnValue({
      openRSIP: handlers.openRSIP,
      saveNodes: handlers.saveRSIPNodes,
      saveMeta: handlers.saveRSIPMeta,
      saveGroups: handlers.saveRSIPGroups,
      saveTaskLinks: handlers.saveRSIPTaskLinks,
      markExecuted: handlers.markRSIPExecuted,
      markViolated: handlers.markRSIPViolated,
      reinforceNode: handlers.reinforceRSIPNode,
      restoreFromLibrary: handlers.restoreRSIPFromLibrary,
      createGroup: handlers.createRSIPGroup,
      upsertTaskLinks: handlers.upsertRSIPTaskLinks,
      getRsipTaskActions: handlers.getRsipTaskActions,
      handleTaskEventIntegration: handlers.handleTaskEventIntegration,
    });
    useImportExportDomainMock.mockReturnValue({
      handleImportChains: handlers.handleImportChains,
    });
    useGroupDomainMock.mockReturnValue({
      handleImportUnits: handlers.handleImportUnits,
      handleUpdateTaskRepeatCount: handlers.handleUpdateTaskRepeatCount,
      handleReorderUnit: handlers.handleReorderUnit,
    });

    useServiceLifecycleMock.mockReturnValue({ isInitialized: true });
    useAppDataLoadMock.mockReturnValue({ isLoadingData: false });
  });

  it('composes domain hooks into grouped AppShellView models', () => {
    render(<AppShellContainer />);

    expect(screen.getByTestId('initialized').textContent).toBe('true');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('view').textContent).toBe('dashboard');

    fireEvent.click(screen.getByText('create-chain'));
    fireEvent.click(screen.getByText('delete-chain'));
    fireEvent.click(screen.getByText('open-rsip'));

    expect(handlers.handleCreateChain).toHaveBeenCalledTimes(1);
    expect(handlers.handleDeleteChain).toHaveBeenCalledWith('chain-1');
    expect(handlers.openRSIP).toHaveBeenCalledTimes(1);
    expect(useAuthControllerMock).toHaveBeenCalledTimes(1);
    expect(useViewValidationMock).toHaveBeenCalledTimes(1);
    expect(usePeriodicCleanupMock).toHaveBeenCalledTimes(1);
  });

  it('reads navigation state from the navigation store', () => {
    navigationStore.setState({ currentView: 'rsip' });

    render(<AppShellContainer />);

    expect(screen.getByTestId('view').textContent).toBe('rsip');
  });

  it('renders fresh group progress and replacement data without cache invalidation', () => {
    const group = createGroupChain({ id: 'group' });
    const unit = createUnitChain({
      id: 'unit',
      parentId: group.id,
      name: 'Local task',
      taskRepeatCount: 2,
      currentStreak: 0,
    });
    appShellStore.getState().updateAppState({
      ...createInitialAppState(),
      chains: [group, unit],
    });
    navigationStore.setState({
      currentView: 'group',
      viewingChainId: group.id,
    });
    render(<AppShellContainer />);
    expect(screen.getByTestId('group-progress')).toHaveTextContent(
      'Local task:0/2',
    );

    act(() =>
      appShellStore.getState().updateAppState((state) => ({
        ...state,
        chains: [group, { ...unit, currentStreak: 1 }],
      })),
    );
    expect(screen.getByTestId('group-progress')).toHaveTextContent(
      'Local task:1/2',
    );

    act(() =>
      appShellStore.getState().replaceAppState({
        ...createInitialAppState(),
        chains: [group, { ...unit, name: 'Cloud task', taskRepeatCount: 3 }],
      }),
    );
    expect(screen.getByTestId('group-progress')).toHaveTextContent(
      'Cloud task:0/3',
    );
  });

  it('derives chain context and modal details from current app and navigation data', () => {
    const focus = createUnitChain({
      id: 'focus',
      name: 'Focus Chain',
      duration: 45,
    });
    const aux = createUnitChain({ id: 'aux', name: 'Auxiliary Chain' });
    appShellStore.getState().updateAppState({
      chains: [focus, aux],
      activeSession: {
        chainId: focus.id,
        startedAt: new Date(),
        duration: 45,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    navigationStore.setState({
      editingChainId: focus.id,
      viewingChainId: aux.id,
      showAuxiliaryJudgment: aux.id,
      showBettingModal: true,
      pendingChainId: focus.id,
      currentSessionId: 'session-1',
    });
    render(<AppShellContainer />);
    expect(
      JSON.parse(screen.getByTestId('chain-context').textContent!),
    ).toEqual({
      editing: 'Focus Chain',
      viewing: 'Auxiliary Chain',
      active: 'Focus Chain',
      auxiliary: 'Auxiliary Chain',
      betting: {
        isOpen: true,
        sessionId: 'session-1',
        chainName: 'Focus Chain',
        taskDuration: 45,
      },
    });
    expect(screen.getByTestId('group-progress')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByText('clear-auxiliary'));
    expect(navigationStore.getState().showAuxiliaryJudgment).toBeNull();

    act(() => appShellStore.getState().updateAppState({ chains: [] }));
    expect(
      JSON.parse(screen.getByTestId('chain-context').textContent!),
    ).toEqual({
      editing: null,
      viewing: null,
      active: null,
      auxiliary: null,
      betting: {
        isOpen: true,
        sessionId: 'session-1',
        chainName: null,
        taskDuration: 0,
      },
    });
  });

  it.each([
    {
      showBettingModal: true,
      pendingChainId: null,
      currentSessionId: 'session-1',
    },
    {
      showBettingModal: true,
      pendingChainId: 'chain-1',
      currentSessionId: null,
    },
    {
      showBettingModal: false,
      pendingChainId: 'chain-1',
      currentSessionId: 'session-1',
    },
  ])('keeps incomplete or closed betting flow hidden: %j', (navigation) => {
    navigationStore.setState(navigation);
    render(<AppShellContainer />);
    expect(
      JSON.parse(screen.getByTestId('chain-context').textContent!).betting
        .isOpen,
    ).toBe(false);
  });

  it('connects the session callback to RSIP task integration', async () => {
    render(<AppShellContainer />);
    const listener = useSessionsDomainMock.mock.calls[0]?.[0]
      .onTaskLifecycleEvent as (event: {
      type: 'task_completed';
      chainId: string;
      chainKind: 'unit';
      occurredAt: Date;
    }) => Promise<void>;
    const occurredAt = new Date('2026-07-11T10:00:00.000Z');

    await act(() =>
      listener({
        type: 'task_completed',
        chainId: 'chain-1',
        chainKind: 'unit',
        occurredAt,
      }),
    );

    expect(handlers.handleTaskEventIntegration).toHaveBeenCalledWith({
      event: 'task_completed',
      chainId: 'chain-1',
      chainKind: 'unit',
      occurredAt,
    });
  });
});

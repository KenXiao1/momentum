import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AppShellAppViewModel,
  AppShellDashboardViewModel,
  AppShellPetViewModel,
  AppShellRsipViewModel,
  AppShellSessionViewModel,
  AppShellViewProps,
} from '../types';
import { AppShellView } from '../AppShellView';
import {
  createGroupChain,
  createPetState,
  createUnitChain,
} from '../../../test/factories';

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    tr: (_zh: string, en: string) => en,
  }),
}));

vi.mock('../../../components/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard">dashboard</div>,
}));

vi.mock('../../../components/RSIPView', () => ({
  RSIPView: () => <div data-testid="rsip-view">rsip</div>,
}));

vi.mock('../../../components/ChainEditor', () => ({
  ChainEditor: () => <div data-testid="chain-editor">editor</div>,
}));

vi.mock('../../../components/FocusMode', () => ({
  FocusMode: () => <div data-testid="focus-mode">focus</div>,
}));

vi.mock('../../../components/ChainDetail', () => ({
  ChainDetail: () => <div data-testid="chain-detail">detail</div>,
}));

vi.mock('../../../components/GroupView', () => ({
  GroupView: () => <div data-testid="group-view">group</div>,
}));

vi.mock('../../../components/TaskGroupEditor', () => ({
  TaskGroupEditor: () => (
    <div data-testid="taskgroup-editor">taskgroup-editor</div>
  ),
}));

vi.mock('../../../components/AuxiliaryJudgment', () => ({
  AuxiliaryJudgment: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="aux-judgment">
      auxiliary
      <button onClick={onCancel}>cancel-aux</button>
    </div>
  ),
}));

vi.mock('../../../components/BettingModal', () => ({
  BettingModal: ({
    chainName,
    taskDuration,
  }: {
    chainName: string;
    taskDuration: number;
  }) => (
    <div data-testid="betting-modal">
      {chainName}:{taskDuration}
    </div>
  ),
}));

vi.mock('../../../components/pet/PetWidget', () => ({
  PetWidget: ({ pet }: { pet: { name: string } | null }) => (
    <div data-testid="pet-widget">{pet?.name ?? 'no-pet'}</div>
  ),
}));

interface AppShellViewOverrides {
  app?: Partial<AppShellAppViewModel>;
  dashboard?: Partial<AppShellDashboardViewModel>;
  rsip?: Partial<AppShellRsipViewModel>;
  session?: Partial<AppShellSessionViewModel>;
  pet?: Partial<AppShellPetViewModel>;
}

function createProps(overrides: AppShellViewOverrides = {}): AppShellViewProps {
  const chain = createUnitChain({
    id: 'chain-1',
    name: 'Chain One',
    duration: 25,
  });
  const groupChain = createGroupChain({
    id: 'group-1',
    name: 'Group One',
  });

  const app: AppShellAppViewModel = {
    isInitialized: true,
    isLoadingData: false,
    currentView: 'dashboard',
    hasActiveSession: true,
    onNavigateToView: vi.fn(),
    ...overrides.app,
  };

  const dashboard: AppShellDashboardViewModel = {
    chains: [chain, groupChain],
    scheduledSessions: [],
    editingChain: null,
    editorParentId: chain.id,
    viewingChain: chain,
    viewingGroupNode: null,
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
    ...overrides.dashboard,
  };

  const rsip: AppShellRsipViewModel = {
    nodes: [],
    meta: {},
    groups: [],
    policyLibrary: [],
    runHistory: [],
    executionRecords: [],
    taskLinks: [],
    chains: dashboard.chains,
    onBack: dashboard.handleBackToDashboard,
    saveNodes: vi.fn(),
    saveMeta: vi.fn(),
    saveGroups: vi.fn(),
    saveTaskLinks: vi.fn(),
    markExecuted: vi.fn(async () => []),
    markViolated: vi.fn(async () => []),
    reinforceNode: vi.fn(async () => []),
    restoreFromLibrary: vi.fn(async () => null),
    createGroup: vi.fn(async () => ({
      id: 'rsip-group-1',
      title: 'Group',
      emoji: 'A',
      faultTolerance: 1,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    })),
    upsertTaskLinks: vi.fn(async () => []),
    getTaskActions: vi.fn(() => []),
    handleStartChain: dashboard.handleStartChain,
    handleScheduleChain: dashboard.handleScheduleChain,
    ...overrides.rsip,
  };

  const session: AppShellSessionViewModel = {
    activeSession: {
      chainId: chain.id,
      startedAt: new Date('2026-02-01T10:00:00.000Z'),
      duration: 25,
      isPaused: false,
      totalPausedTime: 0,
    },
    activeChain: chain,
    auxiliaryJudgmentChain: null,
    clearAuxiliaryJudgment: vi.fn(),
    bettingModal: {
      isOpen: false,
      sessionId: null,
      chainName: null,
      taskDuration: 0,
    },
    handleCompleteSession: vi.fn(),
    handleInterruptSession: vi.fn(),
    handlePauseSession: vi.fn(),
    handleResumeSession: vi.fn(),
    handleBetPlaced: vi.fn(async () => undefined),
    handleBetCancelled: vi.fn(async () => undefined),
    handleAuxiliaryJudgmentFailure: vi.fn(),
    handleAuxiliaryJudgmentAllow: vi.fn(),
    ...overrides.session,
  };

  const pet: AppShellPetViewModel = {
    pet: createPetState({ name: 'Momo' }),
    mood: 'happy',
    isLoading: false,
    hasPet: true,
    createPet: vi.fn(async () => createPetState()),
    feedPet: vi.fn(async () => null),
    onTaskCompleted: vi.fn(async () => null),
    updatePosition: vi.fn(async () => undefined),
    updateMinimizedPosition: vi.fn(async () => undefined),
    toggleVisibility: vi.fn(async () => undefined),
    showPet: vi.fn(async () => undefined),
    minimize: vi.fn(async () => undefined),
    expand: vi.fn(async () => undefined),
    ...overrides.pet,
  };

  return {
    app,
    dashboard,
    rsip,
    session,
    pet,
  };
}

describe('AppShellView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initialization screen when app is not initialized', () => {
    render(
      <AppShellView {...createProps({ app: { isInitialized: false } })} />,
    );
    expect(screen.getByText('INITIALIZING APPLICATION')).toBeInTheDocument();
  });

  it('renders dashboard and supports skip-to-content focus', async () => {
    render(<AppShellView {...createProps()} />);

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
    expect(await screen.findByTestId('pet-widget')).toBeInTheDocument();

    const link = screen.getByText('Skip to main content');
    const main = document.getElementById('main');
    expect(main).toBeInTheDocument();

    fireEvent.click(link);
    expect(main).toHaveFocus();
  });

  it('renders auxiliary judgment and betting modal branches', async () => {
    const clearAuxiliaryJudgment = vi.fn();
    render(
      <AppShellView
        {...createProps({
          session: {
            auxiliaryJudgmentChain: createUnitChain({
              id: 'chain-1',
              name: 'Chain One',
              duration: 25,
            }),
            clearAuxiliaryJudgment,
            bettingModal: {
              isOpen: true,
              sessionId: 'session-1',
              chainName: 'Chain One',
              taskDuration: 25,
            },
          },
        })}
      />,
    );

    expect(await screen.findByTestId('aux-judgment')).toBeInTheDocument();
    expect(await screen.findByTestId('betting-modal')).toHaveTextContent(
      'Chain One:25',
    );

    fireEvent.click(screen.getByText('cancel-aux'));
    expect(clearAuxiliaryJudgment).toHaveBeenCalledTimes(1);
  });

  it('renders editor and taskgroup-editor views', async () => {
    const editorProps = createProps({
      app: { currentView: 'editor' },
      dashboard: { editorParentId: 'chain-1' },
    });

    const { rerender } = render(<AppShellView {...editorProps} />);
    expect(await screen.findByTestId('chain-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('pet-widget')).not.toBeInTheDocument();

    rerender(
      <AppShellView
        {...createProps({
          app: { currentView: 'taskgroup-editor' },
          dashboard: { editorParentId: 'chain-1' },
        })}
      />,
    );
    expect(await screen.findByTestId('taskgroup-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('pet-widget')).not.toBeInTheDocument();
  });

  it('renders focus/detail/group/rsip views when required state is available', async () => {
    const chain = createUnitChain({ id: 'chain-1', parentId: undefined });
    const groupChain = createGroupChain({ id: 'group-1' });
    const groupNode = {
      ...groupChain,
      children: [],
      depth: 0,
    };

    const { rerender } = render(
      <AppShellView
        {...createProps({
          app: { currentView: 'focus' },
          dashboard: { chains: [chain] },
          session: {
            activeSession: {
              chainId: chain.id,
              startedAt: new Date(),
              duration: 10,
              isPaused: false,
              totalPausedTime: 0,
            },
            activeChain: chain,
          },
        })}
      />,
    );
    expect(await screen.findByTestId('focus-mode')).toBeInTheDocument();
    expect(screen.queryByTestId('pet-widget')).not.toBeInTheDocument();

    rerender(
      <AppShellView
        {...createProps({
          app: { currentView: 'detail' },
          dashboard: {
            chains: [chain],
            viewingChain: chain,
          },
        })}
      />,
    );
    expect(await screen.findByTestId('chain-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('pet-widget')).not.toBeInTheDocument();

    rerender(
      <AppShellView
        {...createProps({
          app: { currentView: 'group' },
          dashboard: {
            chains: [groupChain],
            viewingGroupNode: groupNode,
          },
        })}
      />,
    );
    expect(await screen.findByTestId('group-view')).toBeInTheDocument();
    expect(screen.queryByTestId('pet-widget')).not.toBeInTheDocument();

    rerender(
      <AppShellView
        {...createProps({
          app: { currentView: 'rsip' },
          dashboard: { chains: [chain] },
        })}
      />,
    );
    expect(await screen.findByTestId('rsip-view')).toBeInTheDocument();
    expect(screen.queryByTestId('pet-widget')).not.toBeInTheDocument();
  });

  it('returns null main content for focus/detail/group when prerequisites are missing', () => {
    const { rerender, container } = render(
      <AppShellView
        {...createProps({
          app: { currentView: 'focus' },
          session: {
            activeSession: null,
            activeChain: null,
          },
        })}
      />,
    );
    expect(container.querySelector('[data-testid="focus-mode"]')).toBeNull();

    rerender(
      <AppShellView
        {...createProps({
          app: { currentView: 'detail' },
          dashboard: {
            viewingChain: null,
          },
        })}
      />,
    );
    expect(container.querySelector('[data-testid="chain-detail"]')).toBeNull();

    rerender(
      <AppShellView
        {...createProps({
          app: { currentView: 'group' },
          dashboard: {
            viewingGroupNode: null,
          },
        })}
      />,
    );
    expect(container.querySelector('[data-testid="group-view"]')).toBeNull();
  });
});

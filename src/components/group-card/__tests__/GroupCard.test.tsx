import { createTranslator } from '../../../i18n/translate';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainTreeNode, ScheduledSession } from '../../../types';
import { GroupCard } from '../GroupCard';

const chainTreeMock = vi.hoisted(() => ({
  getGroupProgress: vi.fn(() => ({ completed: 1, total: 3 })),
  getNextUnitInGroup: vi.fn(() => ({ id: 'next-unit', name: 'Next unit' })),
  getChainTypeConfig: vi.fn(() => ({
    icon: 'link',
    bgColor: 'bg-blue-50',
    color: 'text-blue-500',
    name: 'Group',
  })),
}));

const countdownMock = vi.hoisted(() => ({
  useGroupCardScheduleCountdown: vi.fn(() => ({ timeRemaining: 0 })),
}));

vi.mock('../../../utils/chainTree', () => chainTreeMock);
vi.mock('../hooks/useGroupCardScheduleCountdown', () => countdownMock);
vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: createTranslator('en'),
  }),
}));
vi.mock('../components/GroupDeleteConfirmDialog', () => ({
  GroupDeleteConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    if (!isOpen) return null;
    return (
      <div>
        <button type="button" onClick={onConfirm}>
          Confirm delete
        </button>
        <button type="button" onClick={onCancel}>
          Cancel delete
        </button>
      </div>
    );
  },
}));

function createGroup(overrides: Partial<ChainTreeNode> = {}): ChainTreeNode {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? 'Focus Group',
    parentId: overrides.parentId,
    type: 'group',
    sortOrder: overrides.sortOrder ?? 1,
    trigger: overrides.trigger ?? 'trigger',
    duration: overrides.duration ?? 30,
    description: overrides.description ?? 'Group description',
    currentStreak: overrides.currentStreak ?? 3,
    auxiliaryStreak: overrides.auxiliaryStreak ?? 0,
    totalCompletions: overrides.totalCompletions ?? 1,
    totalFailures: overrides.totalFailures ?? 0,
    auxiliaryFailures: overrides.auxiliaryFailures ?? 0,
    exceptions: overrides.exceptions ?? [],
    auxiliaryExceptions: overrides.auxiliaryExceptions ?? [],
    auxiliarySignal: overrides.auxiliarySignal ?? 'signal',
    auxiliaryDuration: overrides.auxiliaryDuration ?? 15,
    auxiliaryCompletionTrigger: overrides.auxiliaryCompletionTrigger ?? 'done',
    timeLimitExceptions: overrides.timeLimitExceptions ?? [],
    isTaskGroup: overrides.isTaskGroup ?? true,
    isDurationless: overrides.isDurationless ?? false,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    children: overrides.children ?? [],
    depth: overrides.depth ?? 0,
  } as ChainTreeNode;
}

describe('GroupCard', () => {
  const handlers = {
    onStartChain: vi.fn(),
    onScheduleChain: vi.fn(),
    onViewDetail: vi.fn(),
    onCancelScheduledSession: vi.fn(),
    onCompleteBooking: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    countdownMock.useGroupCardScheduleCountdown.mockReturnValue({
      timeRemaining: 0,
    });
  });

  it('opens detail view and triggers start/schedule actions', async () => {
    const user = userEvent.setup();
    render(
      <GroupCard
        group={createGroup()}
        onStartChain={handlers.onStartChain}
        onScheduleChain={handlers.onScheduleChain}
        onViewDetail={handlers.onViewDetail}
        onCancelScheduledSession={handlers.onCancelScheduledSession}
        onCompleteBooking={handlers.onCompleteBooking}
        onDelete={handlers.onDelete}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'View details: Focus Group' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start next' }));
    await user.click(screen.getByRole('button', { name: 'Schedule' }));

    expect(handlers.onViewDetail).toHaveBeenCalledWith('group-1');
    expect(handlers.onStartChain).toHaveBeenCalledWith('next-unit');
    expect(handlers.onScheduleChain).toHaveBeenCalledWith('next-unit');
  });

  it('shows scheduled-session controls and delegates complete/cancel actions', async () => {
    const user = userEvent.setup();
    const scheduledSession: ScheduledSession = {
      chainId: 'group-1',
      scheduledAt: new Date('2026-02-07T08:00:00.000Z'),
      expiresAt: new Date('2026-02-07T08:20:00.000Z'),
      auxiliarySignal: 'alarm',
    };

    countdownMock.useGroupCardScheduleCountdown.mockReturnValue({
      timeRemaining: 60,
    });

    render(
      <GroupCard
        group={createGroup()}
        scheduledSession={scheduledSession}
        onStartChain={handlers.onStartChain}
        onScheduleChain={handlers.onScheduleChain}
        onViewDetail={handlers.onViewDetail}
        onCancelScheduledSession={handlers.onCancelScheduledSession}
        onCompleteBooking={handlers.onCompleteBooking}
        onDelete={handlers.onDelete}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Schedule' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Complete booking' }));
    await user.click(
      screen.getByRole('button', { name: 'Interrupt / Adjudicate' }),
    );

    expect(handlers.onCompleteBooking).toHaveBeenCalledWith('group-1');
    expect(handlers.onCancelScheduledSession).toHaveBeenCalledWith('group-1');
  });

  it('opens delete menu and confirms deletion', async () => {
    const user = userEvent.setup();

    render(
      <GroupCard
        group={createGroup()}
        onStartChain={handlers.onStartChain}
        onScheduleChain={handlers.onScheduleChain}
        onViewDetail={handlers.onViewDetail}
        onCancelScheduledSession={handlers.onCancelScheduledSession}
        onCompleteBooking={handlers.onCompleteBooking}
        onDelete={handlers.onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete group' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(handlers.onDelete).toHaveBeenCalledWith('group-1');
  });
});

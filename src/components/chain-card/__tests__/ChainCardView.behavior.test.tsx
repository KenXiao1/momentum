import { createTranslator } from '../../../i18n/translate';
import { createChain as createFixtureChain } from '../../../test/factories/chainFactory';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChainCardView } from '../ChainCardView';
import type {
  ChainRecord,
  ChainTreeNode,
  ScheduledSession,
} from '../../../types';

function makeChain(overrides?: Partial<ChainTreeNode>): ChainTreeNode {
  const fields: Partial<ChainRecord> & {
    children?: ChainTreeNode[];
    depth?: number;
  } = {
    id: 'chain-1',
    parentId: undefined,
    type: 'unit',
    sortOrder: 0,
    name: 'Demo chain',
    trigger: 'demo-trigger',
    duration: 25,
    description: 'demo description',
    currentStreak: 3,
    auxiliaryStreak: 1,
    totalCompletions: 2,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: 'bell',
    auxiliaryDuration: 10,
    auxiliaryCompletionTrigger: 'demo-aux-trigger',
    timeLimitExceptions: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    children: [],
    depth: 0,
    ...overrides,
  };
  return {
    ...createFixtureChain(fields.type === 'group' ? 'group' : 'unit', fields),
    children: fields.children ?? [],
    depth: fields.depth ?? 0,
  };
}

function makeProps(overrides?: {
  chain?: ChainTreeNode;
  isScheduled?: boolean;
  showMenu?: boolean;
  showDeleteConfirm?: boolean;
  lastCompletionTime?: number | null;
  scheduledSession?: ScheduledSession;
}) {
  const onViewDetail = vi.fn();
  const onStartChain = vi.fn();
  const onScheduleChain = vi.fn();
  const onCompleteBooking = vi.fn();
  const onCancelScheduledSession = vi.fn();
  const onToggleMenu = vi.fn();
  const onShowDeleteConfirm = vi.fn();
  const onConfirmDelete = vi.fn();
  const onCancelDelete = vi.fn();

  return {
    props: {
      chain: overrides?.chain ?? makeChain(),
      typeConfig: {
        icon: 'zap' as const,
        bgColor: 'bg-slate-200',
        color: 'text-slate-700',
        name: 'Unit',
      },
      language: 'en' as const,
      t: createTranslator('en'),
      timeRemaining: 60,
      isScheduled: overrides?.isScheduled ?? false,
      showMenu: overrides?.showMenu ?? false,
      showDeleteConfirm: overrides?.showDeleteConfirm ?? false,
      lastCompletionTime: overrides?.lastCompletionTime ?? null,
      scheduledSession: overrides?.scheduledSession,
      onViewDetail,
      onStartChain,
      onScheduleChain,
      onCompleteBooking,
      onCancelScheduledSession,
      onToggleMenu,
      onShowDeleteConfirm,
      onConfirmDelete,
      onCancelDelete,
      deleteDialogRef: React.createRef<HTMLDivElement>(),
    },
    onViewDetail,
    onStartChain,
    onScheduleChain,
    onCompleteBooking,
    onCancelScheduledSession,
    onToggleMenu,
    onShowDeleteConfirm,
    onConfirmDelete,
  };
}

describe('ChainCardView behavior', () => {
  it('handles detail/start/schedule actions and keyboard access in regular mode', () => {
    const { props, onViewDetail, onStartChain, onScheduleChain } = makeProps();
    render(<ChainCardView {...props} />);

    const cardButton = screen.getByRole('button', {
      name: 'View details: Demo chain',
    });
    fireEvent.click(cardButton);
    fireEvent.keyDown(cardButton, { key: 'Enter' });
    fireEvent.keyDown(cardButton, { key: ' ' });
    expect(onViewDetail).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(onStartChain).toHaveBeenCalledTimes(1);
    expect(onScheduleChain).toHaveBeenCalledTimes(1);
  });

  it('renders menu actions and delete trigger when menu is open', () => {
    const { props, onToggleMenu, onShowDeleteConfirm } = makeProps({
      showMenu: true,
    });
    render(<ChainCardView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(onToggleMenu).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete chain' }));
    expect(onShowDeleteConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders scheduled session actions and hides schedule button', () => {
    const scheduledSession: ScheduledSession = {
      chainId: 'chain-1',
      scheduledAt: new Date('2026-01-01T08:00:00.000Z'),
      expiresAt: new Date('2026-01-01T09:00:00.000Z'),
      auxiliarySignal: 'alarm',
    };
    const { props, onCompleteBooking, onCancelScheduledSession } = makeProps({
      isScheduled: true,
      scheduledSession,
    });
    render(<ChainCardView {...props} />);

    expect(
      screen.queryByRole('button', { name: 'Schedule' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Complete booking' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Interrupt / Adjudicate' }),
    );
    expect(onCompleteBooking).toHaveBeenCalledTimes(1);
    expect(onCancelScheduledSession).toHaveBeenCalledTimes(1);
  });

  it('shows durationless and completion text branches', () => {
    const durationless = makeChain({
      isDurationless: true,
      duration: 0,
      totalCompletions: 1,
    });
    const { props } = makeProps({
      chain: durationless,
      lastCompletionTime: Date.now() - 60_000,
    });
    render(<ChainCardView {...props} />);

    expect(screen.getByText(/Last:/)).toBeInTheDocument();
    expect(screen.getByText('1 completion')).toBeInTheDocument();
  });

  it('shows first-time text and non-unit type label', () => {
    const nonUnit = makeChain({
      type: 'group',
      isDurationless: true,
      duration: 0,
      totalCompletions: 3,
    });
    const { props } = makeProps({
      chain: nonUnit,
      lastCompletionTime: null,
    });
    props.typeConfig.name = 'Group';
    render(<ChainCardView {...props} />);

    expect(screen.getByText('First time')).toBeInTheDocument();
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('3 completions')).toBeInTheDocument();
  });

  it('ignores keydown events from child elements or unsupported keys', () => {
    const { props, onViewDetail } = makeProps();
    render(<ChainCardView {...props} />);

    const cardButton = screen.getByRole('button', {
      name: 'View details: Demo chain',
    });
    const title = screen.getByText('Demo chain');

    fireEvent.keyDown(title, { key: 'Enter' });
    fireEvent.keyDown(cardButton, { key: 'Escape' });

    expect(onViewDetail).not.toHaveBeenCalled();
  });
});

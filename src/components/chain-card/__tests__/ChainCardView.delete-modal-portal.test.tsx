import { createTranslator } from '../../../i18n/translate';
import { createChain as createFixtureChain } from '../../../test/factories/chainFactory';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ChainCardView } from '../ChainCardView';
import type { ChainRecord, ChainTreeNode } from '../../../types';

const makeChain = (overrides?: Partial<ChainTreeNode>): ChainTreeNode => {
  const fields: Partial<ChainRecord> & {
    children?: ChainTreeNode[];
    depth?: number;
  } = {
    id: 'chain-1',
    parentId: undefined,
    type: 'unit',
    sortOrder: 0,
    name: 'Demo chain',
    trigger: 'demo',
    duration: 25,
    description: 'demo description',
    currentStreak: 3,
    auxiliaryStreak: 1,
    totalCompletions: 18,
    totalFailures: 8,
    auxiliaryFailures: 3,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: 'bell',
    auxiliaryDuration: 10,
    auxiliaryCompletionTrigger: 'demo',
    timeLimitExceptions: [],
    createdAt: new Date(),
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
};

describe('ChainCardView delete modal', () => {
  it('renders the delete modal outside transformed parents (via Portal)', async () => {
    const user = userEvent.setup();
    const onConfirmDelete = vi.fn();
    const onCancelDelete = vi.fn();

    render(
      <div data-testid="transformed" style={{ transform: 'translateY(12px)' }}>
        <ChainCardView
          chain={makeChain()}
          typeConfig={{
            icon: 'zap' as const,
            bgColor: 'bg-slate-200',
            color: 'text-slate-700',
            name: 'Unit',
          }}
          language="en"
          t={createTranslator('en')}
          timeRemaining={0}
          isScheduled={false}
          showMenu={false}
          showDeleteConfirm
          lastCompletionTime={null}
          scheduledSession={undefined}
          onViewDetail={() => {}}
          onStartChain={() => {}}
          onScheduleChain={() => {}}
          onCompleteBooking={() => {}}
          onCancelScheduledSession={() => {}}
          onToggleMenu={() => {}}
          onShowDeleteConfirm={() => {}}
          onConfirmDelete={onConfirmDelete}
          onCancelDelete={onCancelDelete}
        />
      </div>,
    );

    const dialog = screen.getByRole('alertdialog');
    const transformed = screen.getByTestId('transformed');

    expect(transformed.contains(dialog)).toBe(false);

    const deleteButton = within(dialog).getByRole('button', { name: 'Delete' });
    await user.click(deleteButton);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });
});

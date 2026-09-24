import { createTranslator } from '../../../i18n/translate';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainTreeNode } from '../../../types';
import { GroupView } from '../GroupViewContainer';

const getGroupProgressMock = vi.hoisted(() => vi.fn());
const getGroupUnitProgressMock = vi.hoisted(() => vi.fn());
const getNextUnitInGroupMock = vi.hoisted(() => vi.fn());
const getChainTypeConfigMock = vi.hoisted(() => vi.fn());
const getGroupTimeStatusMock = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/chainTree', () => ({
  getGroupProgress: getGroupProgressMock,
  getGroupUnitProgress: getGroupUnitProgressMock,
  getNextUnitInGroup: getNextUnitInGroupMock,
  getChainTypeConfig: getChainTypeConfigMock,
}));

vi.mock('../../../utils/timeLimit', () => ({
  getGroupTimeStatus: getGroupTimeStatusMock,
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: createTranslator('en'),
  }),
}));

vi.mock('../GroupViewHeader', () => ({
  GroupViewHeader: () => null,
}));

vi.mock('../GroupOverview', () => ({
  GroupOverview: () => null,
}));

vi.mock('../GroupUnitList', () => ({
  GroupUnitList: (props: {
    getScheduledSession: (chainId: string) => unknown;
    handleOpenRepeatModal: (unit: ChainTreeNode) => void;
    group: ChainTreeNode;
  }) => (
    <div>
      <div data-testid="scheduled-found">
        {props.getScheduledSession('unit-1') ? 'yes' : 'no'}
      </div>
      <button
        type="button"
        onClick={() => props.handleOpenRepeatModal(props.group.children[0])}
      >
        open-repeat
      </button>
    </div>
  ),
}));

function createGroupNode(): ChainTreeNode {
  return {
    id: 'group-1',
    name: 'Group',
    type: 'group',
    sortOrder: 1,
    trigger: 'trigger',
    duration: 30,
    description: 'desc',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: '',
    auxiliaryDuration: 10,
    auxiliaryCompletionTrigger: '',
    timeLimitExceptions: [],
    createdAt: new Date('2026-02-06T00:00:00.000Z'),
    children: [
      {
        id: 'unit-1',
        name: 'Unit',
        type: 'unit',
        taskRepeatCount: 2,
      } as ChainTreeNode,
    ],
    depth: 0,
  };
}

describe('GroupViewContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGroupProgressMock.mockReturnValue({ completed: 1, total: 2 });
    getGroupUnitProgressMock.mockReturnValue({ completed: 1, total: 3 });
    getNextUnitInGroupMock.mockReturnValue({ id: 'unit-1' });
    getChainTypeConfigMock.mockReturnValue({ color: '#fff' });
    getGroupTimeStatusMock.mockReturnValue({
      isExpired: false,
      remainingTime: 1000,
      formattedTime: '16m',
      progress: 0.2,
    });
  });

  it('maps scheduled sessions and saves the repeat count entered in the real modal', async () => {
    const user = userEvent.setup();
    const onUpdateTaskRepeatCount = vi.fn();
    render(
      <GroupView
        group={createGroupNode()}
        scheduledSessions={[
          {
            chainId: 'unit-1',
            scheduledAt: new Date('2026-02-06T01:00:00.000Z'),
            expiresAt: new Date('2026-02-06T02:00:00.000Z'),
            auxiliarySignal: 'signal',
          },
        ]}
        availableUnits={[{ id: 'unit-1' } as never]}
        onBack={vi.fn()}
        onStartChain={vi.fn()}
        onScheduleChain={vi.fn()}
        onEditChain={vi.fn()}
        onDeleteChain={vi.fn()}
        onAddUnit={vi.fn()}
        onImportUnits={vi.fn()}
        onUpdateTaskRepeatCount={onUpdateTaskRepeatCount}
        onReorderUnit={vi.fn()}
        onViewDetail={vi.fn()}
      />,
    );

    expect(screen.getByTestId('scheduled-found').textContent).toBe('yes');

    await user.click(screen.getByRole('button', { name: 'open-repeat' }));
    expect(
      screen.getByRole('heading', { name: 'Set repeat count' }),
    ).toBeInTheDocument();

    const repeatCountInput = screen.getByRole('spinbutton');
    expect(repeatCountInput).toHaveValue(2);
    fireEvent.change(repeatCountInput, { target: { value: '6' } });
    expect(repeatCountInput).toHaveValue(6);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdateTaskRepeatCount).toHaveBeenCalledWith('unit-1', 6);
    expect(
      screen.queryByRole('heading', { name: 'Set repeat count' }),
    ).not.toBeInTheDocument();
  });
});

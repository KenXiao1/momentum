import { createTranslator } from '../../i18n/translate';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainTreeNode, ScheduledSession } from '../../types';
import { VirtualizedChainList } from '../VirtualizedChainList';

const chainCardRenderSpy = vi.hoisted(() => vi.fn());
const groupCardRenderSpy = vi.hoisted(() => vi.fn());
const getNextUnitInGroupMock = vi.hoisted(() => vi.fn());
const devFlag = vi.hoisted(() => ({ value: false }));

vi.mock('../ChainCard', () => ({
  ChainCard: (props: { chain: { id: string } }) => {
    chainCardRenderSpy(props);
    return (
      <div data-testid={`chain-card-${props.chain.id}`}>{props.chain.id}</div>
    );
  },
}));

vi.mock('../GroupCard', () => ({
  GroupCard: (props: { group: { id: string } }) => {
    groupCardRenderSpy(props);
    return (
      <div data-testid={`group-card-${props.group.id}`}>{props.group.id}</div>
    );
  },
}));

vi.mock('../../utils/chainTree', () => ({
  getNextUnitInGroup: getNextUnitInGroupMock,
}));

vi.mock('../../utils/env', () => ({
  get isDev() {
    return devFlag.value;
  },
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: createTranslator('en'),
  }),
}));

function createChainNode(
  id: string,
  type: ChainTreeNode['type'],
): ChainTreeNode {
  return {
    id,
    parentId: undefined,
    type,
    sortOrder: 0,
    name: `${type}-${id}`,
    trigger: 'trigger',
    duration: 25,
    description: 'desc',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: 'bell',
    auxiliaryDuration: 10,
    auxiliaryCompletionTrigger: 'aux',
    timeLimitExceptions: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    children: [],
    depth: 0,
  };
}

function renderList(args: {
  topLevelChains: ChainTreeNode[];
  getScheduledSession?: (chainId: string) => ScheduledSession | undefined;
}) {
  return render(
    <VirtualizedChainList
      topLevelChains={args.topLevelChains}
      getScheduledSession={args.getScheduledSession ?? (() => undefined)}
      onStartChain={vi.fn()}
      onScheduleChain={vi.fn()}
      onViewDetail={vi.fn()}
      onCancelScheduledSession={vi.fn()}
      onCompleteBooking={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe('VirtualizedChainList', () => {
  let clientHeightGetter: PropertyDescriptor | undefined;

  beforeEach(() => {
    chainCardRenderSpy.mockReset();
    groupCardRenderSpy.mockReset();
    getNextUnitInGroupMock.mockReset();
    devFlag.value = false;

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400,
    });

    clientHeightGetter = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    );
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 600;
      },
    });
  });

  afterEach(() => {
    if (clientHeightGetter) {
      Object.defineProperty(
        HTMLElement.prototype,
        'clientHeight',
        clientHeightGetter,
      );
    }
  });

  it('renders regular grid for small lists and uses fallback group id when next unit is missing', () => {
    const group = createChainNode('group-1', 'group');
    const unit = createChainNode('unit-1', 'unit');
    const scheduledById = new Map<string, ScheduledSession>([
      [
        'group-1',
        {
          chainId: 'group-1',
          scheduledAt: new Date(),
          expiresAt: new Date(),
          auxiliarySignal: 'a',
        },
      ],
      [
        'unit-1',
        {
          chainId: 'unit-1',
          scheduledAt: new Date(),
          expiresAt: new Date(),
          auxiliarySignal: 'b',
        },
      ],
    ]);
    const getScheduledSession = vi.fn((chainId: string) =>
      scheduledById.get(chainId),
    );

    getNextUnitInGroupMock.mockReturnValue(undefined);
    renderList({
      topLevelChains: [group, unit],
      getScheduledSession,
    });

    expect(
      screen.getByRole('list', { name: 'Task chains list' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Virtual:/)).not.toBeInTheDocument();

    expect(groupCardRenderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({ id: 'group-1' }),
        scheduledSession: expect.objectContaining({ chainId: 'group-1' }),
      }),
    );
    expect(chainCardRenderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: expect.objectContaining({ id: 'unit-1' }),
        scheduledSession: expect.objectContaining({ chainId: 'unit-1' }),
      }),
    );

    expect(getScheduledSession).toHaveBeenCalledWith('group-1');
    expect(getScheduledSession).toHaveBeenCalledWith('unit-1');
  });

  it('renders virtual list for large sets, uses next unit id for groups, and handles scroll updates', async () => {
    devFlag.value = true;
    const group = createChainNode('group-a', 'group');
    const units = Array.from({ length: 24 }, (_, idx) =>
      createChainNode(`unit-${idx}`, 'unit'),
    );
    const all = [group, ...units];

    getNextUnitInGroupMock.mockImplementation((node: { id: string }) => {
      if (node.id === 'group-a') return { id: 'unit-next' };
      return undefined;
    });
    const getScheduledSession = vi.fn((chainId: string) =>
      chainId === 'unit-next'
        ? ({
            chainId,
            scheduledAt: new Date(),
            expiresAt: new Date(),
            auxiliarySignal: 'x',
          } as ScheduledSession)
        : undefined,
    );

    const { container } = renderList({
      topLevelChains: all,
      getScheduledSession,
    });

    const list = screen.getByRole('list', { name: 'Task chains list' });
    expect(list).toHaveAttribute('id', 'chain-list-container');
    expect(screen.getByText(/Virtual:/)).toBeInTheDocument();
    expect(getScheduledSession).toHaveBeenCalledWith('unit-next');

    const before = container.querySelectorAll(
      '[data-testid^="chain-card-"],[data-testid^="group-card-"]',
    ).length;
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(all.length);

    fireEvent.scroll(list, { target: { scrollTop: 560 } });
    await waitFor(() => {
      const transformedLayer = container.querySelector(
        'div.absolute.top-0.left-0.right-0',
      );
      expect(transformedLayer).toHaveStyle({ transform: 'translateY(560px)' });
    });
  });

  it('updates visible window when viewport width changes across breakpoints', async () => {
    const chains = Array.from({ length: 20 }, (_, idx) =>
      createChainNode(`unit-r-${idx}`, 'unit'),
    );
    getNextUnitInGroupMock.mockReturnValue(undefined);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1000,
    });
    const { container } = renderList({ topLevelChains: chains });
    expect(screen.queryByText(/Virtual:/)).not.toBeInTheDocument();

    const countRendered = () =>
      container.querySelectorAll(
        '[data-testid^="chain-card-"],[data-testid^="group-card-"]',
      ).length;

    const initialCount = countRendered();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    });
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(countRendered()).toBeLessThan(initialCount));

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400,
    });
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(countRendered()).toBeGreaterThan(initialCount));
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  createAppState,
  createGroupChain,
  createUnitChain,
  createLocalStorageMock,
} from '../../../../test/factories';
import { createCompletionHandlers } from '../completion';
import { buildChainTree } from '../../../../utils/chainTree';
import { getGroupProgress } from '../../../../utils/chainTree';

vi.mock('../../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: {
    notifyTaskCompleted: vi.fn(async () => undefined),
  },
}));

describe('group completion and rendered tree consistency', () => {
  it('B09 renders the settled cycle and reset progress without a refresh', () => {
    const group = createGroupChain({ id: 'group' });
    const unit = createUnitChain({
      id: 'unit',
      parentId: group.id,
      taskRepeatCount: 2,
      currentStreak: 1,
    });
    let state = createAppState({
      chains: [group, unit],
      activeSession: {
        chainId: unit.id,
        startedAt: new Date(),
        duration: 1,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const handlers = createCompletionHandlers({
      getState: () => state,
      setState: (update) => {
        state = typeof update === 'function' ? update(state) : update;
      },
      storage: createLocalStorageMock(),
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr: (_zh, en) => en,
    });
    handlers.handleCompleteSession();
    const tree = buildChainTree(state.chains);
    expect(tree[0].currentStreak).toBe(1);
    expect(tree[0].totalCompletions).toBe(1);
    expect(getGroupProgress(tree[0])).toEqual({ completed: 0, total: 2 });
    expect(state.activeSession).toBeNull();
    expect(state.completionHistory).toHaveLength(1);
  });
});

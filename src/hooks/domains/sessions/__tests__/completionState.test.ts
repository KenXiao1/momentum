import { createTranslator } from '../../../../i18n/translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGroupChain, createUnitChain } from '../../../../test/factories';
import {
  maybeIncrementGroupCycleCompletion,
  updateChainsForFailure,
  updateChainsForSuccess,
} from '../completionState';
import { notifyTaskCompleted } from '../sessionNotifications';

vi.mock('../sessionNotifications', () => ({
  notifyTaskCompleted: vi.fn(),
}));

describe('completionState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies successful completion counters without mutating input', () => {
    const chain = createUnitChain({
      id: 'chain-1',
      currentStreak: 2,
      totalCompletions: 4,
    });
    const completedAt = new Date('2026-01-01T00:00:00Z');
    const result = updateChainsForSuccess([chain], chain.id, completedAt);

    expect(result[0]).toMatchObject({
      currentStreak: 3,
      totalCompletions: 5,
      lastCompletedAt: completedAt,
    });
    expect(chain.currentStreak).toBe(2);
  });

  it('resets streak and increments failures on interruption', () => {
    const chain = createUnitChain({
      id: 'chain-1',
      currentStreak: 2,
      totalFailures: 1,
    });
    expect(updateChainsForFailure([chain], chain.id)[0]).toMatchObject({
      currentStreak: 0,
      totalFailures: 2,
    });
  });

  function completedGroup() {
    const unrelated = createUnitChain({ id: 'unrelated', currentStreak: 0 });
    const group = createGroupChain({
      id: 'parent-group',
      name: 'Morning routine',
      currentStreak: 2,
      totalCompletions: 4,
    });
    const completed = createUnitChain({
      id: 'completed',
      parentId: group.id,
      currentStreak: 2,
      taskRepeatCount: 2,
    });
    return { group, completed, chains: [unrelated, completed, group] };
  }

  it.each([
    ['en', 'Group completed a cycle'],
    ['zh', '任务群完成一轮'],
  ])(
    'increments only the matching completed group and emits its updated %s notification by default',
    (language, message) => {
      const { group, completed, chains } = completedGroup();
      const result = maybeIncrementGroupCycleCompletion(
        chains,
        completed,
        createTranslator(language === 'zh' ? 'zh' : 'en'),
      );

      expect(result.completedGroupId).toBe(group.id);
      expect(
        result.updatedChains.find((chain) => chain.id === group.id),
      ).toMatchObject({ currentStreak: 3, totalCompletions: 5 });
      expect(
        result.updatedChains.find((chain) => chain.id === completed.id),
      ).toMatchObject({ currentStreak: 0 });
      expect(result.updatedChains[0]).toBe(chains[0]);
      expect(chains[1].currentStreak).toBe(2);
      expect(chains[2].currentStreak).toBe(2);
      expect(notifyTaskCompleted).toHaveBeenCalledExactlyOnceWith(
        group.name,
        3,
        message,
      );
    },
  );

  it('prepares group completion without notifying before the transaction is confirmed', () => {
    const { group, completed, chains } = completedGroup();
    const result = maybeIncrementGroupCycleCompletion(
      chains,
      completed,
      createTranslator('en'),
      false,
    );

    expect(result.completedGroupId).toBe(group.id);
    expect(
      result.updatedChains.find((chain) => chain.id === group.id),
    ).toMatchObject({ currentStreak: 3 });
    expect(notifyTaskCompleted).not.toHaveBeenCalled();
  });

  it('preserves the full state while another sibling has unfinished repeats', () => {
    const { group, completed, chains } = completedGroup();
    chains.push(
      createUnitChain({
        id: 'unfinished-sibling',
        parentId: group.id,
        currentStreak: 1,
        taskRepeatCount: 2,
      }),
    );
    const result = maybeIncrementGroupCycleCompletion(
      chains,
      completed,
      createTranslator('en'),
    );

    expect(result).toEqual({ updatedChains: chains });
    expect(result.updatedChains).toBe(chains);
    expect(notifyTaskCompleted).not.toHaveBeenCalled();
  });

  it('does not count completion of a child group as another executable task', () => {
    const parent = createGroupChain({ id: 'parent' });
    const childGroup = createGroupChain({
      id: 'child-group',
      parentId: parent.id,
      currentStreak: 1,
    });
    const chains = [parent, childGroup];
    const result = maybeIncrementGroupCycleCompletion(
      chains,
      childGroup,
      createTranslator('en'),
    );

    expect(result).toEqual({ updatedChains: chains });
    expect(result.updatedChains).toBe(chains);
    expect(notifyTaskCompleted).not.toHaveBeenCalled();
  });

  it.each(['missing', 'unit'])(
    'does not complete or reset tasks when their parent is %s',
    (parentType) => {
      const completed = createUnitChain({
        id: 'completed',
        parentId: 'invalid-parent',
        currentStreak: 1,
      });
      const chains = [completed];
      if (parentType === 'unit')
        chains.unshift(
          createUnitChain({ id: 'invalid-parent', currentStreak: 1 }),
        );
      const result = maybeIncrementGroupCycleCompletion(
        chains,
        completed,
        createTranslator('en'),
      );

      expect(result).toEqual({ updatedChains: chains });
      expect(result.updatedChains).toBe(chains);
      expect(completed.currentStreak).toBe(1);
      expect(notifyTaskCompleted).not.toHaveBeenCalled();
    },
  );
});

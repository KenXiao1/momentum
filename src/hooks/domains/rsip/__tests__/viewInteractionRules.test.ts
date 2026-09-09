import { describe, expect, it } from 'vitest';
import type {
  RSIPLibraryEntry,
  RSIPNode,
  RSIPNodeGroup,
  RSIPTaskLink,
} from '../../../../types';
import {
  assessViolationGroup,
  calculateConstraintPower,
  createNodeFromLibraryEntry,
  getActiveExecutionTaskLinks,
  getViolationDescendants,
  markNodeExecutedFallback,
  markNodeViolatedFallback,
} from '../viewInteractionRules';

const createdAt = new Date('2026-07-01T00:00:00.000Z');

function node(overrides: Partial<RSIPNode> = {}): RSIPNode {
  return {
    id: overrides.id ?? 'node-1',
    title: overrides.title ?? 'Policy',
    rule: overrides.rule ?? 'Rule',
    sortOrder: overrides.sortOrder ?? 1,
    createdAt: overrides.createdAt ?? createdAt,
    ...overrides,
  };
}

function link(overrides: Partial<RSIPTaskLink> = {}): RSIPTaskLink {
  return {
    id: overrides.id ?? 'link-1',
    rsipNodeId: overrides.rsipNodeId ?? 'node-1',
    chainId: overrides.chainId ?? 'chain-1',
    chainKind: overrides.chainKind ?? 'unit',
    triggerEvent: overrides.triggerEvent ?? 'rsip_mark_executed',
    effect: overrides.effect ?? 'prompt_start_chain',
    automation: overrides.automation ?? 'auto',
    isActive: overrides.isActive ?? true,
    updatedAt: overrides.updatedAt ?? createdAt,
  };
}

describe('RSIP view interaction rules', () => {
  it('selects only the active execution action for a non-first target', () => {
    const selected = link({ id: 'selected', rsipNodeId: 'target-node' });
    const result = getActiveExecutionTaskLinks('target-node', [
      link({ id: 'other-node', rsipNodeId: 'other-node' }),
      link({
        id: 'inactive',
        rsipNodeId: 'target-node',
        isActive: false,
      }),
      link({
        id: 'task-event',
        rsipNodeId: 'target-node',
        triggerEvent: 'task_completed',
      }),
      selected,
    ]);

    expect(result).toEqual([selected]);
  });

  it('uses the matching group rather than the first group', () => {
    const unrelatedGroup: RSIPNodeGroup = {
      id: 'unrelated-group',
      title: 'Unrelated',
      faultTolerance: 9,
      createdAt,
    };
    const targetGroup: RSIPNodeGroup = {
      id: 'target-group',
      title: 'Core',
      faultTolerance: 1,
      createdAt,
    };
    const nodes = [
      node({ id: 'unrelated-node', groupId: unrelatedGroup.id }),
      node({ id: 'target-peer', groupId: targetGroup.id }),
      node({ id: 'target-node', groupId: targetGroup.id }),
    ];

    expect(
      assessViolationGroup(nodes[2], [unrelatedGroup, targetGroup]),
    ).toEqual({
      status: 'tolerated',
      groupTitle: 'Core',
    });
    expect(
      assessViolationGroup(nodes[2], [
        unrelatedGroup,
        { ...targetGroup, faultTolerance: 0 },
      ]),
    ).toEqual({ status: 'collapse', groupTitle: 'Core' });
  });

  it('returns no group assessment for ungrouped and missing-group nodes', () => {
    const group: RSIPNodeGroup = {
      id: 'known-group',
      title: 'Known',
      faultTolerance: 1,
      createdAt,
    };

    expect(assessViolationGroup(node(), [group])).toEqual({
      status: 'none',
    });
    expect(
      assessViolationGroup(node({ id: 'orphan', groupId: 'missing-group' }), [
        group,
      ]),
    ).toEqual({ status: 'none' });
  });

  it('copies the complete supported library entry shape into the restored node', () => {
    const entry: RSIPLibraryEntry = {
      id: 'library-1',
      title: 'Restored',
      rule: 'Restored rule',
      type: 'discipline',
      cumulativeExecutionDays: 5,
      internalizationProgress: 0.5,
      lastActiveAt: createdAt,
      timesUsed: 2,
      emoji: '🧭',
      isPassive: true,
      useTimer: true,
      timerMinutes: 15,
    };

    const restoredAt = new Date('2026-07-11T12:00:00.123Z');
    expect(
      createNodeFromLibraryEntry(entry, 'parent-1', 'new-node', restoredAt),
    ).toEqual({
      id: 'new-node',
      parentId: 'parent-1',
      title: 'Restored',
      rule: 'Restored rule',
      sortOrder: 1_783_771_200,
      createdAt: restoredAt,
      useTimer: true,
      timerMinutes: 15,
      emoji: '🧭',
      type: 'discipline',
      isPassive: true,
      cumulativeExecutionDays: 5,
    });
  });

  it.each([
    [undefined, 3],
    ['E0', 3],
    ['E1', 6],
    ['E2', 9],
  ] as const)(
    'applies the %s phase weight to a non-first target',
    (stabilityPhase, expectedFailureCost) => {
      const nodes = [
        node({ id: 'unrelated' }),
        node({
          id: 'root',
          stabilityPhase,
          reinforcementLevel: 0,
        }),
        node({ id: 'child', parentId: 'root' }),
        node({ id: 'grandchild', parentId: 'child' }),
      ];

      expect(calculateConstraintPower(nodes, 'root')).toEqual({
        descendantCount: 2,
        failureCost: expectedFailureCost,
      });
    },
  );

  it.each([
    [undefined, 9],
    [0, 9],
    [1, 2.7],
  ] as const)(
    'applies reinforcement level %s without changing descendant count',
    (reinforcementLevel, expectedFailureCost) => {
      const nodes = [
        node({ id: 'unrelated' }),
        node({ id: 'root', stabilityPhase: 'E2', reinforcementLevel }),
        node({ id: 'child', parentId: 'root' }),
        node({ id: 'grandchild', parentId: 'child' }),
      ];

      expect(calculateConstraintPower(nodes, 'root')).toEqual({
        descendantCount: 2,
        failureCost: expectedFailureCost,
      });
    },
  );

  it('returns zero constraint power for a missing node', () => {
    expect(
      calculateConstraintPower([node({ id: 'existing' })], 'missing'),
    ).toEqual({
      descendantCount: 0,
      failureCost: 0,
    });
  });

  it('returns the exact descendants of a non-first target', () => {
    const unrelated = node({ id: 'unrelated' });
    const root = node({ id: 'root' });
    const child = node({ id: 'child', parentId: 'root' });
    const grandchild = node({ id: 'grandchild', parentId: 'child' });
    const nodes = [unrelated, root, child, grandchild];

    expect(getViolationDescendants(nodes, 'root')).toEqual([child, grandchild]);
  });

  it.each([
    ['E0', 5, 'E0', false],
    ['E0', 6, 'E1', true],
    ['E1', 19, 'E1', false],
    ['E1', 20, 'E2', true],
    ['E2', 0, 'E2', false],
    ['E2', 99, 'E2', false],
  ] as const)(
    'transitions %s after %i prior executions to %s',
    (stabilityPhase, priorExecutions, expectedPhase, phaseChanges) => {
      const now = new Date('2026-07-11T12:00:00.000Z');
      const priorPhaseStartedAt = new Date('2026-07-01T12:00:00.000Z');
      const unrelated = node({
        id: 'unrelated',
        consecutiveExecutions: 99,
        totalExecutions: 99,
      });
      const target = node({
        id: 'target',
        stabilityPhase,
        phaseStartedAt: priorPhaseStartedAt,
        cumulativeExecutionDays: 10,
        consecutiveExecutions: priorExecutions,
        consecutiveViolations: 4,
        totalExecutions: 20,
        lastExecutedAt: new Date('2026-07-10T12:00:00.000Z'),
      });

      const executed = markNodeExecutedFallback(
        [unrelated, target],
        'target',
        now,
      );

      expect(executed).toEqual([
        unrelated,
        {
          ...target,
          stabilityPhase: expectedPhase,
          phaseStartedAt: phaseChanges ? now : priorPhaseStartedAt,
          cumulativeExecutionDays: 11,
          consecutiveExecutions: priorExecutions + 1,
          consecutiveViolations: 0,
          totalExecutions: 21,
          lastExecutedAt: now,
        },
      ]);
      expect(executed[0]).toBe(unrelated);
    },
  );

  it('initializes missing execution counters without touching other nodes', () => {
    const now = new Date('2026-07-11T12:00:00.000Z');
    const unrelated = node({ id: 'unrelated' });
    const target = node({ id: 'target' });

    expect(
      markNodeExecutedFallback([unrelated, target], 'target', now),
    ).toEqual([
      unrelated,
      {
        ...target,
        stabilityPhase: 'E0',
        phaseStartedAt: undefined,
        cumulativeExecutionDays: 1,
        consecutiveExecutions: 1,
        consecutiveViolations: 0,
        totalExecutions: 1,
        lastExecutedAt: now,
      },
    ]);
  });

  it('leaves all nodes untouched when the executed node is missing', () => {
    const nodes = [node({ id: 'first' }), node({ id: 'second' })];
    const result = markNodeExecutedFallback(nodes, 'missing', createdAt);

    expect(result).toEqual(nodes);
    expect(result[0]).toBe(nodes[0]);
    expect(result[1]).toBe(nodes[1]);
  });

  it('removes only a non-first violated node and its descendants', () => {
    const unrelated = node({ id: 'unrelated' });
    const target = node({ id: 'target' });
    const child = node({ id: 'child', parentId: 'target' });
    const grandchild = node({ id: 'grandchild', parentId: 'child' });
    const otherRoot = node({ id: 'other-root' });

    expect(
      markNodeViolatedFallback(
        [unrelated, target, child, grandchild, otherRoot],
        'target',
      ),
    ).toEqual([unrelated, otherRoot]);
  });

  it('preserves every node when the violated node is missing', () => {
    const nodes = [node({ id: 'first' }), node({ id: 'second' })];

    expect(markNodeViolatedFallback(nodes, 'missing')).toEqual(nodes);
  });
});

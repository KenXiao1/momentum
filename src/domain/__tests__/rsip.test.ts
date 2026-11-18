import { describe, expect, it } from 'vitest';
import type {
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPStabilityPhase,
} from '../../types';
import {
  absorbViolation,
  applyExecution,
  applyReinforcement,
  calculateConstraintPower,
  calculatePhaseDistribution,
  canCreateRSIPNodes,
  planRSIPViolation,
} from '../rsip';

const NOW = new Date('2026-07-11T12:00:00.000Z');
const YESTERDAY = new Date('2026-07-10T12:00:00.000Z');
const LAST_WEEK = new Date('2026-07-04T12:00:00.000Z');
const PHASE_START = new Date('2026-07-01T12:00:00.000Z');

function node(overrides: Partial<RSIPNode> = {}): RSIPNode {
  return {
    id: 'node',
    title: 'Policy',
    rule: 'Rule',
    sortOrder: 1,
    createdAt: PHASE_START,
    ...overrides,
  };
}

function group(overrides: Partial<RSIPNodeGroup> = {}): RSIPNodeGroup {
  return {
    id: 'group',
    title: 'Group',
    faultTolerance: 0,
    createdAt: PHASE_START,
    ...overrides,
  };
}

describe('applyExecution', () => {
  it.each([
    // phase, streak before today, phase after, promoted
    [undefined, 0, 'E0', false],
    ['E0', 5, 'E0', false],
    ['E0', 6, 'E1', true],
    ['E0', 30, 'E1', true],
    ['E1', 19, 'E1', false],
    ['E1', 20, 'E2', true],
    ['E2', 99, 'E2', false],
  ] as const)(
    '%s with a %i-day streak becomes %s',
    (phase, streak, expected, promoted) => {
      const executed = applyExecution(
        node({
          stabilityPhase: phase as RSIPStabilityPhase | undefined,
          phaseStartedAt: PHASE_START,
          consecutiveExecutions: streak,
          lastExecutedAt: YESTERDAY,
        }),
        NOW,
      );

      expect(executed).toMatchObject({
        stabilityPhase: expected,
        consecutiveExecutions: streak + 1,
        phaseStartedAt: promoted ? NOW : PHASE_START,
        lastExecutedAt: NOW,
      });
    },
  );

  it('restarts the streak after a missed day without demoting the phase', () => {
    const executed = applyExecution(
      node({
        stabilityPhase: 'E1',
        consecutiveExecutions: 15,
        lastExecutedAt: LAST_WEEK,
      }),
      NOW,
    );

    expect(executed).toMatchObject({
      stabilityPhase: 'E1',
      consecutiveExecutions: 1,
    });
  });

  it('updates counters and clears the violation streak', () => {
    expect(
      applyExecution(
        node({
          totalExecutions: 4,
          cumulativeExecutionDays: 9,
          consecutiveViolations: 3,
        }),
        NOW,
      ),
    ).toMatchObject({
      totalExecutions: 5,
      cumulativeExecutionDays: 10,
      consecutiveViolations: 0,
    });
  });

  it('ignores a second execution on the same day', () => {
    expect(
      applyExecution(
        node({ lastExecutedAt: new Date('2026-07-11T06:00:00.000Z') }),
        NOW,
      ),
    ).toBeNull();
  });

  it.each([
    ['E2', true, 3, 3],
    ['E2', false, 2, 2],
    ['E1', true, 2, 2],
  ] as const)(
    'in %s with reinforce=%s sets reinforcement to %i (max %i)',
    (phase, reinforce, level, max) => {
      const executed = applyExecution(
        node({
          stabilityPhase: phase,
          reinforcementLevel: 2,
          maxReinforcementLevel: 2,
          lastExecutedAt: YESTERDAY,
        }),
        NOW,
        { reinforce },
      );

      expect(executed).toMatchObject({
        reinforcementLevel: level,
        maxReinforcementLevel: max,
      });
    },
  );
});

describe('applyReinforcement', () => {
  it('adds whole levels to an E2 node and tracks the maximum', () => {
    expect(
      applyReinforcement(
        node({
          stabilityPhase: 'E2',
          reinforcementLevel: 1,
          maxReinforcementLevel: 5,
        }),
        2.9,
      ),
    ).toMatchObject({ reinforcementLevel: 3, maxReinforcementLevel: 5 });
    expect(applyReinforcement(node({ stabilityPhase: 'E2' }), 0)).toMatchObject(
      { reinforcementLevel: 1, maxReinforcementLevel: 1 },
    );
  });

  it('returns other phases unchanged', () => {
    const e1 = node({ stabilityPhase: 'E1' });
    expect(applyReinforcement(e1)).toBe(e1);
  });
});

describe('absorbViolation', () => {
  it('consumes one reinforcement level and keeps the node', () => {
    expect(
      absorbViolation(
        node({
          reinforcementLevel: 2,
          consecutiveExecutions: 8,
          consecutiveViolations: 1,
          totalViolations: 4,
        }),
        NOW,
      ),
    ).toMatchObject({
      reinforcementLevel: 1,
      lastViolatedAt: NOW,
      consecutiveExecutions: 0,
      consecutiveViolations: 2,
      totalViolations: 5,
    });
  });

  it.each([undefined, 0])(
    'returns null so the node collapses at reinforcement %s',
    (reinforcementLevel) => {
      expect(absorbViolation(node({ reinforcementLevel }), NOW)).toBeNull();
    },
  );
});

describe('planRSIPViolation', () => {
  const tree = [
    node({ id: 'root' }),
    node({ id: 'child', parentId: 'root' }),
    node({ id: 'other' }),
  ];

  it('removes the node and its subtree when it has no group', () => {
    const plan = planRSIPViolation('root', tree, []);
    expect([...plan.removedIds].sort()).toEqual(['child', 'root']);
    expect(plan.collapsedGroupIds.size).toBe(0);
  });

  it('spends group tolerance without collapsing the group', () => {
    const nodes = [
      node({ id: 'a', groupId: 'g' }),
      node({ id: 'b', groupId: 'g' }),
    ];
    const plan = planRSIPViolation('a', nodes, [
      group({ id: 'g', faultTolerance: 1 }),
    ]);

    expect([...plan.removedIds]).toEqual(['a']);
    expect(plan.updatedGroups).toEqual([
      group({ id: 'g', faultTolerance: 1, faultToleranceUsed: 1 }),
    ]);
  });

  it('collapses an exhausted group and cascades into groups it overlaps', () => {
    const nodes = [
      node({ id: 'a', groupId: 'g1' }),
      node({ id: 'b', groupId: 'g1' }),
      node({ id: 'b-child', parentId: 'b', groupId: 'g2' }),
      node({ id: 'c', groupId: 'g2' }),
      node({ id: 'safe' }),
    ];
    const plan = planRSIPViolation('a', nodes, [
      group({ id: 'g1', faultTolerance: 0 }),
      group({ id: 'g2', faultTolerance: 0 }),
    ]);

    expect([...plan.collapsedGroupIds].sort()).toEqual(['g1', 'g2']);
    expect([...plan.removedIds].sort()).toEqual(['a', 'b', 'b-child', 'c']);
  });

  it('leaves unaffected groups as the same objects', () => {
    const untouched = group({ id: 'untouched' });
    expect(planRSIPViolation('root', tree, [untouched]).updatedGroups[0]).toBe(
      untouched,
    );
  });
});

describe('canCreateRSIPNodes', () => {
  const strict: RSIPMeta = {};
  const today = new Date('2026-07-11T08:00:00.000Z');

  it.each([
    ['nothing in strict mode', strict, [], 0, true],
    ['one node in strict mode', strict, [], 1, true],
    ['two nodes in strict mode', strict, [], 2, false],
    ['any number in free mode', { allowMultiplePerDay: true }, [], 5, true],
    ['a second node the same day', { lastAddedAt: today }, [], 1, false],
    [
      'when a node was created today',
      strict,
      [node({ createdAt: today })],
      1,
      false,
    ],
    ['the day after adding', { lastAddedAt: YESTERDAY }, [], 1, true],
  ] as const)('allows %s: %s', (_label, meta, nodes, count, expected) => {
    expect(canCreateRSIPNodes(meta, [...nodes], count, NOW)).toBe(expected);
  });
});

describe('constraint power and phase distribution', () => {
  const subtree = (root: Partial<RSIPNode>) => [
    node({ id: 'unrelated' }),
    node({ id: 'root', ...root }),
    node({ id: 'child', parentId: 'root' }),
    node({ id: 'grandchild', parentId: 'child' }),
  ];

  it.each([
    [undefined, 0, 3],
    ['E0', 0, 3],
    ['E1', 0, 6],
    ['E2', 0, 9],
    ['E2', 1, 2.7],
  ] as const)(
    'costs a %s node with reinforcement %i at %d',
    (stabilityPhase, reinforcementLevel, failureCost) => {
      expect(
        calculateConstraintPower(
          subtree({ stabilityPhase, reinforcementLevel }),
          'root',
        ),
      ).toEqual({ descendantCount: 2, failureCost });
    },
  );

  it('costs nothing for a missing node', () => {
    expect(calculateConstraintPower(subtree({}), 'missing')).toEqual({
      descendantCount: 0,
      failureCost: 0,
    });
  });

  it('counts nodes per phase, treating a missing phase as E0', () => {
    expect(
      calculatePhaseDistribution([
        node(),
        node({ stabilityPhase: 'E0' }),
        node({ stabilityPhase: 'E1' }),
        node({ stabilityPhase: 'E2' }),
      ]),
    ).toEqual({ E0: 2, E1: 1, E2: 1 });
  });
});

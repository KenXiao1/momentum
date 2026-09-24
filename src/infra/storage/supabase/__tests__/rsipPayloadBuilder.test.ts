import { describe, expect, it } from 'vitest';
import { buildRSIPNodeRows } from '../rsipPayloadBuilder';

describe('buildRSIPNodeRows', () => {
  const nodes = [
    {
      id: 'n1',
      parentId: undefined,
      title: 'Node 1',
      rule: 'Do it',
      sortOrder: 1,
      createdAt: new Date('2026-02-07T00:00:00.000Z'),
      useTimer: true,
      timerMinutes: 20,
      emoji: '🔥',
      type: 'habit',
      groupId: 'group-1',
      reinforcementLevel: 2,
      maxReinforcementLevel: 3,
      cumulativeExecutionDays: 12,
      isPassive: true,
      splitFromGoal: '早睡早起',
      stabilityPhase: 'E1' as const,
      phaseStartedAt: new Date('2026-02-07T00:10:00.000Z'),
      lastExecutedAt: new Date('2026-02-07T00:20:00.000Z'),
      lastViolatedAt: new Date('2026-02-07T00:30:00.000Z'),
      consecutiveExecutions: 2,
      consecutiveViolations: 1,
      totalExecutions: 10,
      totalViolations: 3,
    },
  ];

  it('builds the complete migrated-schema payload', () => {
    const rows = buildRSIPNodeRows(nodes, 'user-1');
    expect(rows).toHaveLength(1);

    const row = rows[0] as Record<string, unknown>;
    expect(row.user_id).toBe('user-1');
    expect(row).toHaveProperty('consecutive_executions', 2);
    expect(row).toHaveProperty('stability_phase', 'E1');
    expect(row).toHaveProperty('group_id', 'group-1');
    expect(row).toHaveProperty('reinforcement_level', 2);
    expect(row).toHaveProperty('split_from_goal', '早睡早起');
  });

  it('includes complete-schema defaults for optional node fields', () => {
    const rows = buildRSIPNodeRows(
      [
        {
          id: 'minimal',
          title: 'Minimal',
          rule: 'Rule',
          sortOrder: 0,
          createdAt: new Date('2026-02-07T00:00:00.000Z'),
        },
      ],
      'user-1',
    );
    expect(rows).toHaveLength(1);

    const row = rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty('consecutive_executions', 0);
    expect(row).toHaveProperty('stability_phase', 'E0');
    expect(row).toHaveProperty('group_id', null);
    expect(row.user_id).toBe('user-1');
  });
});

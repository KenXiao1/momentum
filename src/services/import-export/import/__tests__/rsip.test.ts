import { createTranslator } from '../../../../i18n/translate';
import { describe, expect, test } from 'vitest';
import type { RSIPNodeGroup } from '../../../../types';
import {
  parseImportRsipExecutionRecords,
  parseImportRsipGroups,
  parseImportRsipLibrary,
  parseImportRsipMeta,
  parseImportRsipNodes,
  parseImportRsipRunHistory,
  parseImportRsipTaskLinks,
} from '../rsip';

const t = createTranslator('zh');

describe('import/rsip parser', () => {
  test('parses rsip meta with strict date fields', () => {
    const parsed = parseImportRsipMeta({
      lastAddedAt: '2026-01-01T00:00:00.000Z',
      allowMultiplePerDay: false,
      lastTreeOpenedAt: '2026-01-02T00:00:00.000Z',
      currentRunStartedAt: '2026-01-03T00:00:00.000Z',
      currentRunNumber: 3,
    });

    expect(parsed?.lastAddedAt).toBeInstanceOf(Date);
    expect(parsed?.lastTreeOpenedAt).toBeInstanceOf(Date);
    expect(parsed?.currentRunStartedAt).toBeInstanceOf(Date);
    expect(parsed?.currentRunNumber).toBe(3);
  });

  test('maps groups and nodes with id remapping and strict fields', () => {
    const existingGroups: RSIPNodeGroup[] = [
      {
        id: 'existing-group',
        title: 'existing',
        faultTolerance: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];

    const { groups, groupIdMap } = parseImportRsipGroups(
      [
        {
          id: 'source-group',
          title: 'new-group',
          faultTolerance: 2,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      existingGroups,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).not.toBe('source-group');
    expect(groupIdMap.get('source-group')).toBe(groups[0]?.id);

    const { nodes } = parseImportRsipNodes(
      [
        {
          id: 'source-node',
          title: 'Node A',
          rule: 'rule',
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          groupId: 'source-group',
          reinforcementLevel: 2,
          maxReinforcementLevel: 3,
          cumulativeExecutionDays: 4,
          isPassive: true,
          splitFromGoal: 'goal',
          stabilityPhase: 'E1',
          phaseStartedAt: '2026-01-02T00:00:00.000Z',
          lastExecutedAt: '2026-01-03T00:00:00.000Z',
          lastViolatedAt: '2026-01-04T00:00:00.000Z',
          consecutiveExecutions: 5,
          consecutiveViolations: 1,
          totalExecutions: 8,
          totalViolations: 2,
        },
      ],
      [],
      t,
      groupIdMap,
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.groupId).toBe(groups[0]?.id);
    expect(nodes[0]?.stabilityPhase).toBe('E1');
    expect(nodes[0]?.phaseStartedAt).toBeInstanceOf(Date);
    expect(nodes[0]?.lastExecutedAt).toBeInstanceOf(Date);
    expect(nodes[0]?.lastViolatedAt).toBeInstanceOf(Date);
  });

  test('parses library and run history entries', () => {
    const library = parseImportRsipLibrary([
      {
        id: 'source-lib',
        title: 'Lib',
        rule: 'rule',
        cumulativeExecutionDays: 7,
        internalizationProgress: 30,
        lastActiveAt: '2026-01-01T00:00:00.000Z',
        timesUsed: 2,
      },
    ]);
    expect(library).toHaveLength(1);
    expect(library[0]?.id).not.toBe('source-lib');
    expect(library[0]?.lastActiveAt).toBeInstanceOf(Date);

    const runHistory = parseImportRsipRunHistory([
      {
        runNumber: 3,
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: '2026-01-04T00:00:00.000Z',
        maxNodeCount: 8,
        durationDays: 3,
      },
    ]);
    expect(runHistory).toHaveLength(1);
    expect(runHistory[0]?.startedAt).toBeInstanceOf(Date);
    expect(runHistory[0]?.endedAt).toBeInstanceOf(Date);
  });

  test('skips invalid execution and task-link references', () => {
    const { rsipIdMap } = parseImportRsipNodes(
      [
        {
          id: 'source-node',
          title: 'Node A',
          rule: 'rule',
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      [],
      t,
    );
    const chainIdMap = new Map<string, string>([['source-chain', 'new-chain']]);

    const execution = parseImportRsipExecutionRecords(
      [
        {
          id: 'exec-valid',
          nodeId: 'source-node',
          status: 'executed',
          executedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'exec-invalid',
          nodeId: 'missing-node',
          status: 'executed',
          executedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      rsipIdMap,
    );
    expect(execution.records).toHaveLength(1);
    expect(execution.skipped).toBe(1);

    const links = parseImportRsipTaskLinks(
      [
        {
          id: 'link-valid',
          rsipNodeId: 'source-node',
          chainId: 'source-chain',
          chainKind: 'unit',
          triggerEvent: 'task_completed',
          effect: 'mark_rsip_executed',
          automation: 'confirm',
          isActive: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-invalid',
          rsipNodeId: 'source-node',
          chainId: 'missing-chain',
          chainKind: 'unit',
          triggerEvent: 'task_completed',
          effect: 'mark_rsip_executed',
          automation: 'confirm',
          isActive: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      rsipIdMap,
      chainIdMap,
    );

    expect(links.links).toHaveLength(1);
    expect(links.skipped).toBe(1);
  });
});

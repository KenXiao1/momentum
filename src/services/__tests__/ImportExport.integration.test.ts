import { createTranslator } from '../../i18n/translate';
import type {
  Chain,
  CompletionHistory,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../../types';
import type { PetState } from '../../types/pet';
import { importExportService } from '../ImportExportService';

describe('ImportExportService integration', () => {
  const t = createTranslator('zh');

  test('roundtrips V3 payload with extended RSIP and pet data', () => {
    const parentChain: Chain = {
      id: 'chain-parent',
      type: 'unit',
      sortOrder: 1,
      name: 'Parent chain',
      trigger: 'Parent trigger',
      duration: 45,
      description: 'Parent description',
      currentStreak: 2,
      auxiliaryStreak: 1,
      totalCompletions: 10,
      totalFailures: 3,
      auxiliaryFailures: 1,
      exceptions: ['ex-1'],
      auxiliaryExceptions: ['aux-ex-1'],
      auxiliarySignal: 'signal',
      auxiliaryDuration: 15,
      auxiliaryCompletionTrigger: 'completion trigger',
      timeLimitExceptions: [],
      isDurationless: false,
      minimumDuration: undefined,
      taskRepeatCount: undefined,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastCompletedAt: new Date('2026-01-02T00:00:00.000Z'),
      deletedAt: null,
    };

    const childChain: Chain = {
      ...parentChain,
      id: 'chain-child',
      parentId: parentChain.id,
      sortOrder: 2,
      name: 'Child chain',
      currentStreak: 5,
      totalCompletions: 20,
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      lastCompletedAt: undefined,
    };

    const historyEntry: CompletionHistory = {
      chainId: childChain.id,
      completedAt: new Date('2026-01-06T00:00:00.000Z'),
      duration: 30,
      wasSuccessful: true,
      isForwardTimed: false,
      description: 'did work',
      notes: 'notes',
    };

    const rsipGroups: RSIPNodeGroup[] = [
      {
        id: 'group-1',
        title: 'Core',
        faultTolerance: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        emoji: '🛡️',
      },
    ];

    const rsipNodes: RSIPNode[] = [
      {
        id: 'rsip-1',
        title: 'Rule 1',
        rule: 'Do X',
        sortOrder: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        groupId: 'group-1',
        stabilityPhase: 'E1',
        phaseStartedAt: new Date('2026-01-02T00:00:00.000Z'),
        lastExecutedAt: new Date('2026-01-03T00:00:00.000Z'),
        lastViolatedAt: new Date('2026-01-04T00:00:00.000Z'),
        reinforcementLevel: 2,
      },
    ];

    const rsipLibrary: RSIPLibraryEntry[] = [
      {
        id: 'lib-1',
        title: 'Library Rule',
        rule: 'Library text',
        cumulativeExecutionDays: 8,
        internalizationProgress: 20,
        lastActiveAt: new Date('2026-01-05T00:00:00.000Z'),
        timesUsed: 3,
      },
    ];

    const rsipRunHistory: RSIPRunRecord[] = [
      {
        runNumber: 2,
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: new Date('2026-01-10T00:00:00.000Z'),
        maxNodeCount: 6,
        durationDays: 9,
        collapseReason: 'manual',
      },
    ];

    const rsipExecutionRecords: RSIPExecutionRecord[] = [
      {
        id: 'exec-1',
        nodeId: 'rsip-1',
        status: 'executed',
        executedAt: new Date('2026-01-06T00:00:00.000Z'),
        notes: 'ok',
      },
    ];

    const rsipTaskLinks: RSIPTaskLink[] = [
      {
        id: 'link-1',
        rsipNodeId: 'rsip-1',
        chainId: childChain.id,
        chainKind: 'unit',
        triggerEvent: 'task_completed',
        effect: 'mark_rsip_executed',
        automation: 'confirm',
        isActive: true,
        updatedAt: new Date('2026-01-07T00:00:00.000Z'),
      },
    ];

    const petState: PetState = {
      id: 'pet-1',
      name: 'Pixel',
      hunger: 20,
      happiness: 80,
      health: 95,
      level: 3,
      experience: 40,
      stage: 'baby',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastFedAt: new Date('2026-01-02T00:00:00.000Z'),
      lastInteractedAt: new Date('2026-01-03T00:00:00.000Z'),
      lastDecayCalculatedAt: new Date('2026-01-04T00:00:00.000Z'),
      isVisible: true,
      isMinimized: false,
      position: { x: 88, y: 66 },
      minimizedPosition: { x: 92, y: 2 },
    };

    const exportData = importExportService.createExportData({
      chains: [parentChain, childChain],
      history: [historyEntry],
      rsipNodes,
      rsipMeta: {
        lastAddedAt: new Date('2026-01-01T00:00:00.000Z'),
        allowMultiplePerDay: false,
        lastTreeOpenedAt: new Date('2026-01-08T00:00:00.000Z'),
        currentRunStartedAt: new Date('2026-01-09T00:00:00.000Z'),
      },
      rsipGroups,
      rsipPolicyLibrary: rsipLibrary,
      rsipRunHistory,
      rsipExecutionRecords,
      rsipTaskLinks,
      petState,
      exceptionRules: {
        rules: [
          { name: 'Take a break', type: 'pause_only', description: 'ok' },
          { name: 123, type: 'pause_only' },
        ],
      },
    });

    expect(exportData.version).toBe('3.0');
    expect(exportData.petState).toBeDefined();
    expect(exportData.rsipGroups).toHaveLength(1);
    expect(exportData.rsipPolicyLibrary).toHaveLength(1);
    expect(exportData.rsipRunHistory).toHaveLength(1);
    expect(exportData.rsipExecutionRecords).toHaveLength(1);
    expect(exportData.rsipTaskLinks).toHaveLength(1);

    const imported = importExportService.parseImportData({
      json: JSON.stringify(exportData),
      options: {
        preserveStatistics: true,
        preserveTimestamps: true,
        importCompletionHistory: true,
      },
      existingRsipNodes: [],
      existingRsipGroups: [],
      t,
    });

    expect(imported.chains).toHaveLength(2);
    expect(imported.history).toHaveLength(1);
    expect(imported.exceptionRulesToImport).toHaveLength(1);
    expect(imported.petState?.name).toBe('Pixel');
    expect(imported.rsipGroups).toHaveLength(1);
    expect(imported.rsipPolicyLibrary).toHaveLength(1);
    expect(imported.rsipRunHistory).toHaveLength(1);
    expect(imported.rsipExecutionRecords).toHaveLength(1);
    expect(imported.rsipTaskLinks).toHaveLength(1);
    expect(imported.invalidReferences.rsipExecutionRecordsSkipped).toBe(0);
    expect(imported.invalidReferences.rsipTaskLinksSkipped).toBe(0);

    const importedParent = imported.chains.find(
      (c) => c.name === 'Parent chain',
    );
    const importedChild = imported.chains.find((c) => c.name === 'Child chain');
    expect(importedParent).toBeDefined();
    expect(importedChild).toBeDefined();

    expect(importedChild!.parentId).toBe(importedParent!.id);
    expect(importedChild!.currentStreak).toBe(5);
    expect(importedChild!.totalCompletions).toBe(20);
    expect(importedChild!.createdAt.toISOString()).toBe(
      childChain.createdAt.toISOString(),
    );

    expect(imported.history[0]!.chainId).toBe(importedChild!.id);
    expect(imported.history[0]!.completedAt.toISOString()).toBe(
      historyEntry.completedAt.toISOString(),
    );
    expect(imported.history[0]!.duration).toBe(30);
    expect(imported.history[0]!.wasSuccessful).toBe(true);

    const importedRsipNode = imported.rsipNodes[0]!;
    const importedGroup = imported.rsipGroups![0]!;
    expect(importedRsipNode.groupId).toBe(importedGroup.id);

    const importedExecution = imported.rsipExecutionRecords![0]!;
    expect(importedExecution.nodeId).toBe(importedRsipNode.id);

    const importedLink = imported.rsipTaskLinks![0]!;
    expect(importedLink.rsipNodeId).toBe(importedRsipNode.id);
    expect(importedLink.chainId).toBe(importedChild!.id);
  });

  test('supports legacy V2 payload by treating V3 fields as optional', () => {
    const legacyJson = JSON.stringify({
      version: '2.0',
      exportedAt: '2026-02-01T00:00:00.000Z',
      chains: [
        {
          id: 'legacy-chain',
          name: 'Legacy chain',
          type: 'unit',
          sortOrder: 1,
          trigger: '',
          duration: 30,
          description: '',
          currentStreak: 0,
          auxiliaryStreak: 0,
          totalCompletions: 0,
          totalFailures: 0,
          auxiliaryFailures: 0,
          exceptions: [],
          auxiliaryExceptions: [],
          auxiliarySignal: '',
          auxiliaryDuration: 15,
          auxiliaryCompletionTrigger: '',
          timeLimitExceptions: [],
          isDurationless: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          deletedAt: null,
        },
      ],
      completionHistory: [],
      rsipNodes: [],
      rsipMeta: {},
      exceptionRules: { rules: [] },
    });

    const imported = importExportService.parseImportData({
      json: legacyJson,
      options: {
        preserveStatistics: true,
        preserveTimestamps: true,
        importCompletionHistory: true,
      },
      t,
    });

    expect(imported.chains).toHaveLength(1);
    expect(imported.rsipGroups).toBeUndefined();
    expect(imported.rsipPolicyLibrary).toBeUndefined();
    expect(imported.rsipRunHistory).toBeUndefined();
    expect(imported.rsipExecutionRecords).toBeUndefined();
    expect(imported.rsipTaskLinks).toBeUndefined();
    expect(imported.petState).toBeUndefined();
  });

  test('skips invalid rsip execution/task link references and continues import', () => {
    const payload = JSON.stringify({
      version: '3.0',
      exportedAt: '2026-02-01T00:00:00.000Z',
      chains: [
        {
          id: 'source-chain',
          name: 'Chain',
          type: 'unit',
          sortOrder: 1,
          trigger: '',
          duration: 30,
          description: '',
          currentStreak: 0,
          auxiliaryStreak: 0,
          totalCompletions: 0,
          totalFailures: 0,
          auxiliaryFailures: 0,
          exceptions: [],
          auxiliaryExceptions: [],
          auxiliarySignal: '',
          auxiliaryDuration: 15,
          auxiliaryCompletionTrigger: '',
          timeLimitExceptions: [],
          isDurationless: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          deletedAt: null,
        },
      ],
      completionHistory: [],
      rsipNodes: [
        {
          id: 'node-a',
          title: 'A',
          rule: 'r',
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      rsipExecutionRecords: [
        {
          id: 'exec-valid',
          nodeId: 'node-a',
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
      rsipTaskLinks: [
        {
          id: 'link-valid',
          rsipNodeId: 'node-a',
          chainId: 'source-chain',
          chainKind: 'unit',
          triggerEvent: 'task_completed',
          effect: 'mark_rsip_executed',
          automation: 'confirm',
          isActive: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-invalid-node',
          rsipNodeId: 'missing-node',
          chainId: 'source-chain',
          chainKind: 'unit',
          triggerEvent: 'task_completed',
          effect: 'mark_rsip_executed',
          automation: 'confirm',
          isActive: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-invalid-chain',
          rsipNodeId: 'node-a',
          chainId: 'missing-chain',
          chainKind: 'unit',
          triggerEvent: 'task_completed',
          effect: 'mark_rsip_executed',
          automation: 'confirm',
          isActive: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const imported = importExportService.parseImportData({
      json: payload,
      options: {
        preserveStatistics: true,
        preserveTimestamps: true,
        importCompletionHistory: true,
      },
      t,
    });

    expect(imported.rsipExecutionRecords).toHaveLength(1);
    expect(imported.rsipTaskLinks).toHaveLength(1);
    expect(imported.invalidReferences.rsipExecutionRecordsSkipped).toBe(1);
    expect(imported.invalidReferences.rsipTaskLinksSkipped).toBe(2);
  });
});

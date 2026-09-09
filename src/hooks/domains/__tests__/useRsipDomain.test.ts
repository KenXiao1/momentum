import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AppState,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPTaskLink,
} from '../../../types';
import { useRsipDomain } from '../useRsipDomain';
import {
  createAppState,
  createLocalStorageMock,
} from '../../../test/factories';
import { logger } from '../../../utils/logger';
import { rsipTaskIntegrationService } from '../../../services/rsip-integration/RSIPTaskIntegrationService';

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function createBaseState(overrides: Partial<AppState> = {}): AppState {
  return createAppState(overrides);
}

function createStateContainer(initialState: AppState) {
  let state = initialState;
  const setState: Dispatch<SetStateAction<AppState>> = (update) => {
    state =
      typeof update === 'function'
        ? (update as (prev: AppState) => AppState)(state)
        : update;
  };
  return {
    getState: () => state,
    setState,
  };
}

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createNode(overrides: Partial<RSIPNode> = {}): RSIPNode {
  return {
    id: overrides.id ?? 'node-id',
    parentId: overrides.parentId,
    title: overrides.title ?? 'Node',
    rule: overrides.rule ?? 'Rule',
    sortOrder: overrides.sortOrder ?? 1,
    createdAt: overrides.createdAt ?? new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createGroup(overrides: Partial<RSIPNodeGroup> = {}): RSIPNodeGroup {
  return {
    id: overrides.id ?? 'group-id',
    title: overrides.title ?? 'Group',
    faultTolerance: overrides.faultTolerance ?? 0,
    createdAt: overrides.createdAt ?? new Date('2026-02-01T00:00:00.000Z'),
    emoji: overrides.emoji,
  };
}

function createLibraryEntry(
  overrides: Partial<RSIPLibraryEntry> = {},
): RSIPLibraryEntry {
  return {
    id: overrides.id ?? 'library-id',
    title: overrides.title ?? 'Library Title',
    rule: overrides.rule ?? 'Library Rule',
    type: overrides.type ?? 'habit',
    emoji: overrides.emoji ?? '🔥',
    cumulativeExecutionDays: overrides.cumulativeExecutionDays ?? 12,
    internalizationProgress: overrides.internalizationProgress ?? 20,
    lastActiveAt:
      overrides.lastActiveAt ?? new Date('2026-02-05T00:00:00.000Z'),
    timesUsed: overrides.timesUsed ?? 1,
    useTimer: overrides.useTimer ?? false,
    timerMinutes: overrides.timerMinutes,
    isPassive: overrides.isPassive ?? false,
  };
}

function createTaskLink(overrides: Partial<RSIPTaskLink> = {}): RSIPTaskLink {
  return {
    id: overrides.id ?? 'link-id',
    rsipNodeId: overrides.rsipNodeId ?? 'node-id',
    chainId: overrides.chainId ?? 'chain-id',
    chainKind: overrides.chainKind ?? 'unit',
    triggerEvent: overrides.triggerEvent ?? 'task_completed',
    effect: overrides.effect ?? 'mark_rsip_executed',
    automation: overrides.automation ?? 'confirm',
    isActive: overrides.isActive ?? true,
    updatedAt: overrides.updatedAt ?? new Date('2026-02-08T00:00:00.000Z'),
    userId: overrides.userId ?? 'user-id',
  };
}

describe('useRsipDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rsipTaskIntegrationService.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('commits rsipNodes only after persistence resolves', async () => {
    const stateRef = createStateContainer(createBaseState());

    let resolveSave!: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });

    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn().mockReturnValue(savePromise),
    });

    const domain = useRsipDomain({ setState: stateRef.setState, storage });

    const nodes: RSIPNode[] = [
      createNode({ id: 'rsip-1', title: 'Test', rule: 'Test rule' }),
    ];

    const pending = domain.saveNodes(nodes);

    expect(stateRef.getState().rsipNodes).toEqual([]);

    resolveSave();
    await pending;

    expect(stateRef.getState().rsipNodes).toBe(nodes);
    expect(storage.saveRSIPNodes).toHaveBeenCalledWith(nodes);
  });

  it('rejects and rolls back nodes when persistence fails', async () => {
    const originalNodes = [createNode({ id: 'existing-node' })];
    const stateRef = createStateContainer(
      createBaseState({ rsipNodes: originalNodes }),
    );
    const failure = new Error('persist failed');

    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn().mockRejectedValue(failure),
    });

    const domain = useRsipDomain({ setState: stateRef.setState, storage });

    const nodes: RSIPNode[] = [
      createNode({ id: 'rsip-1', title: 'Test', rule: 'Test rule' }),
    ];

    await expect(domain.saveNodes(nodes)).rejects.toBe(failure);
    expect(stateRef.getState().rsipNodes).toBe(originalNodes);
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to save RSIP nodes',
      { nodeCount: 1 },
      expect.any(Error),
    );
  });

  it('does not let an older failed save roll back a newer same-reference commit', async () => {
    const originalNodes = [createNode({ id: 'original-node' })];
    const sharedNodes = [createNode({ id: 'shared-node' })];
    const firstSave = createDeferred();
    const stateRef = createStateContainer(
      createBaseState({ rsipNodes: originalNodes }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi
        .fn()
        .mockReturnValueOnce(firstSave.promise)
        .mockResolvedValueOnce(undefined),
    });
    const domain = useRsipDomain({ setState: stateRef.setState, storage });

    const olderPending = domain.saveNodes(sharedNodes);
    const latestPending = domain.saveNodes(sharedNodes);

    await vi.waitFor(() => {
      expect(storage.saveRSIPNodes).toHaveBeenCalledTimes(1);
    });

    const failure = new Error('older request failed');
    const olderRejection = expect(olderPending).rejects.toBe(failure);
    firstSave.reject(failure);
    await olderRejection;
    await latestPending;

    expect(stateRef.getState().rsipNodes).toBe(sharedNodes);
    expect(storage.saveRSIPNodes).toHaveBeenNthCalledWith(1, sharedNodes);
    expect(storage.saveRSIPNodes).toHaveBeenNthCalledWith(2, sharedNodes);
  });

  it('keeps the original slice when two queued saves both reject', async () => {
    const originalNodes = [createNode({ id: 'original-node' })];
    const firstNodes = [createNode({ id: 'first-node' })];
    const secondNodes = [createNode({ id: 'second-node' })];
    const firstSave = createDeferred();
    const secondSave = createDeferred();
    void secondSave.promise.catch(() => undefined);
    const stateRef = createStateContainer(
      createBaseState({ rsipNodes: originalNodes }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi
        .fn()
        .mockReturnValueOnce(firstSave.promise)
        .mockReturnValueOnce(secondSave.promise),
    });
    const domain = useRsipDomain({ setState: stateRef.setState, storage });

    const firstPending = domain.saveNodes(firstNodes);
    const secondPending = domain.saveNodes(secondNodes);
    const firstFailure = new Error('first save failed');
    const secondFailure = new Error('second save failed first');
    const firstRejection = expect(firstPending).rejects.toBe(firstFailure);
    const secondRejection = expect(secondPending).rejects.toBe(secondFailure);

    secondSave.reject(secondFailure);
    firstSave.reject(firstFailure);
    await Promise.all([firstRejection, secondRejection]);

    expect(storage.saveRSIPNodes).toHaveBeenNthCalledWith(1, firstNodes);
    expect(storage.saveRSIPNodes).toHaveBeenNthCalledWith(2, secondNodes);
    expect(stateRef.getState().rsipNodes).toBe(originalNodes);
  });

  it('keeps a committed first-node save when run initialization bookkeeping fails', async () => {
    const originalMeta: RSIPMeta = { allowMultiplePerDay: false };
    const stateRef = createStateContainer(
      createBaseState({ rsipNodes: [], rsipMeta: originalMeta }),
    );
    const nodes = [createNode({ id: 'first-node' })];
    const metaFailure = new Error('run initialization failed');
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      saveRSIPMeta: vi.fn().mockRejectedValue(metaFailure),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    await expect(domain.saveNodes(nodes)).resolves.toBeUndefined();

    expect(stateRef.getState().rsipNodes).toBe(nodes);
    expect(stateRef.getState().rsipMeta).toBe(originalMeta);
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to save RSIP meta',
      { meta: expect.objectContaining({ currentRunNumber: 1 }) },
      metaFailure,
    );
  });

  it('opens RSIP and rolls meta back when persistence fails', async () => {
    const originalMeta: RSIPMeta = { allowMultiplePerDay: true };
    const stateRef = createStateContainer(
      createBaseState({ rsipMeta: originalMeta }),
    );
    const failure = new Error('meta persist failed');
    const storage = createLocalStorageMock({
      saveRSIPMeta: vi.fn(async () => {
        throw failure;
      }),
    });
    const onNavigateToRSIP = vi.fn();
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      onNavigateToRSIP,
    });

    domain.openRSIP();
    expect(onNavigateToRSIP).toHaveBeenCalledTimes(1);

    const meta: RSIPMeta = { allowMultiplePerDay: false, treeOpenStreak: 2 };
    await expect(domain.saveMeta(meta)).rejects.toBe(failure);
    expect(stateRef.getState().rsipMeta).toBe(originalMeta);
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to save RSIP meta',
      { meta },
      expect.any(Error),
    );
  });

  it('should provide strict/free mode helpers and opened-today check', () => {
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage: createLocalStorageMock(),
    });
    const strictMeta: RSIPMeta = { allowMultiplePerDay: false };
    const freeMeta: RSIPMeta = { allowMultiplePerDay: true };

    expect(domain.getMode(strictMeta)).toBe('strict');
    expect(domain.getMode(freeMeta)).toBe('free');
    expect(domain.isStrictMode(strictMeta)).toBe(true);
    expect(domain.isStrictMode(freeMeta)).toBe(false);
    expect(domain.hasOpenedToday({})).toBe(false);
    expect(domain.hasOpenedToday({ lastTreeOpenedAt: new Date() })).toBe(true);
  });

  it('should mark execution and advance phase from E0 to E1', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const nodes = [
      createNode({
        id: 'exec-e0',
        stabilityPhase: 'E0',
        consecutiveExecutions: 6,
        consecutiveViolations: 2,
        totalExecutions: 4,
      }),
    ];

    const updated = await domain.markExecuted('exec-e0', nodes);
    const node = updated[0];

    expect(node.consecutiveExecutions).toBe(7);
    expect(node.totalExecutions).toBe(5);
    expect(node.consecutiveViolations).toBe(0);
    expect(node.stabilityPhase).toBe('E1');
    expect(node.phaseStartedAt).toBeInstanceOf(Date);
  });

  it('should update only target node when marking execution', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const target = createNode({
      id: 'exec-target',
      stabilityPhase: 'E0',
      consecutiveExecutions: 1,
      totalExecutions: 2,
    });
    const untouched = createNode({
      id: 'exec-untouched',
      stabilityPhase: 'E1',
      consecutiveExecutions: 9,
      totalExecutions: 9,
    });

    const updated = await domain.markExecuted('exec-target', [
      target,
      untouched,
    ]);
    expect(
      updated.find((node) => node.id === 'exec-target')?.consecutiveExecutions,
    ).toBe(2);
    expect(updated.find((node) => node.id === 'exec-untouched')).toEqual(
      untouched,
    );
  });

  it('should not transition stability phase before threshold and should not transition E0 directly to E2', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });

    const e0BelowThreshold = createNode({
      id: 'e0-below',
      stabilityPhase: 'E0',
      consecutiveExecutions: 3,
      totalExecutions: 3,
    });
    const e0HighExecutions = createNode({
      id: 'e0-high',
      stabilityPhase: 'E0',
      consecutiveExecutions: 30,
      totalExecutions: 30,
    });
    const e1BelowThreshold = createNode({
      id: 'e1-below',
      stabilityPhase: 'E1',
      consecutiveExecutions: 10,
      totalExecutions: 10,
    });

    const updatedE0 = await domain.markExecuted('e0-below', [e0BelowThreshold]);
    expect(updatedE0[0].stabilityPhase).toBe('E0');

    const updatedE0High = await domain.markExecuted('e0-high', [
      e0HighExecutions,
    ]);
    expect(updatedE0High[0].stabilityPhase).toBe('E1');

    const updatedE1 = await domain.markExecuted('e1-below', [e1BelowThreshold]);
    expect(updatedE1[0].stabilityPhase).toBe('E1');
  });

  it('should mark execution and advance phase from E1 to E2', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const nodes = [
      createNode({
        id: 'exec-e1',
        stabilityPhase: 'E1',
        consecutiveExecutions: 20,
        totalExecutions: 20,
      }),
    ];

    const updated = await domain.markExecuted('exec-e1', nodes);
    expect(updated[0].stabilityPhase).toBe('E2');
    expect(updated[0].consecutiveExecutions).toBe(21);
    expect(updated[0].totalExecutions).toBe(21);
  });

  it('should treat undefined stability phase as E0 when marking execution', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const nodes = [
      createNode({
        id: 'exec-undefined-phase',
        stabilityPhase: undefined,
        consecutiveExecutions: 6,
        totalExecutions: 12,
      }),
    ];

    const updated = await domain.markExecuted('exec-undefined-phase', nodes);
    expect(updated[0].stabilityPhase).toBe('E1');
    expect(updated[0].consecutiveExecutions).toBe(7);
    expect(updated[0].totalExecutions).toBe(13);
    expect(updated[0].phaseStartedAt).toBeInstanceOf(Date);
  });

  it('should keep E2 node phase unchanged when marking execution', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const originalPhaseStartedAt = new Date('2026-01-15T00:00:00.000Z');
    const nodes = [
      createNode({
        id: 'exec-e2-stable',
        stabilityPhase: 'E2',
        consecutiveExecutions: 4,
        totalExecutions: 9,
        phaseStartedAt: originalPhaseStartedAt,
      }),
    ];

    const updated = await domain.markExecuted('exec-e2-stable', nodes);
    expect(updated[0].stabilityPhase).toBe('E2');
    expect(updated[0].phaseStartedAt).toEqual(originalPhaseStartedAt);
    expect(updated[0].consecutiveExecutions).toBe(5);
    expect(updated[0].totalExecutions).toBe(10);
  });

  it('should not reset E2 phase start when high execution count is already reached', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const originalPhaseStartedAt = new Date('2026-01-01T00:00:00.000Z');
    const nodes = [
      createNode({
        id: 'exec-e2-high',
        stabilityPhase: 'E2',
        consecutiveExecutions: 21,
        totalExecutions: 30,
        phaseStartedAt: originalPhaseStartedAt,
      }),
    ];

    const updated = await domain.markExecuted('exec-e2-high', nodes);
    expect(updated[0].stabilityPhase).toBe('E2');
    expect(updated[0].phaseStartedAt).toEqual(originalPhaseStartedAt);
    expect(updated[0].consecutiveExecutions).toBe(22);
    expect(updated[0].totalExecutions).toBe(31);
  });

  it('should delete violated node with all descendants', async () => {
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const root = createNode({ id: 'root' });
    const child = createNode({ id: 'child', parentId: root.id });
    const grandChild = createNode({ id: 'grand', parentId: child.id });
    const keep = createNode({ id: 'keep' });

    const updated = await domain.markViolated(root.id, [
      root,
      child,
      grandChild,
      keep,
    ]);
    expect(updated).toEqual([keep]);
  });

  it('should record tree opened streak with increment and reset behavior', async () => {
    const storage = createLocalStorageMock({
      saveRSIPMeta: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const incremented = await domain.recordTreeOpened({
      lastTreeOpenedAt: yesterday,
      treeOpenStreak: 3,
    });
    expect(incremented.treeOpenStreak).toBe(4);

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 7);
    const reset = await domain.recordTreeOpened({
      lastTreeOpenedAt: oldDate,
      treeOpenStreak: 9,
    });
    expect(reset.treeOpenStreak).toBe(1);
  });

  it('should initialize streak when no last open date and keep streak when reopened on same day', async () => {
    const storage = createLocalStorageMock({
      saveRSIPMeta: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({ setState: vi.fn(), storage });

    const initialized = await domain.recordTreeOpened({
      allowMultiplePerDay: false,
    });
    expect(initialized.treeOpenStreak).toBe(1);

    const sameDay = await domain.recordTreeOpened({
      allowMultiplePerDay: false,
      lastTreeOpenedAt: new Date(),
      treeOpenStreak: 5,
    });
    expect(sameDay.treeOpenStreak).toBe(5);
  });

  it('should calculate constraint power and phase distribution', () => {
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage: createLocalStorageMock(),
    });
    const root = createNode({ id: 'cp-root', stabilityPhase: 'E2' });
    const child1 = createNode({
      id: 'cp-child-1',
      parentId: root.id,
      stabilityPhase: 'E1',
    });
    const child2 = createNode({
      id: 'cp-child-2',
      parentId: root.id,
      stabilityPhase: 'E0',
    });
    const child3 = createNode({
      id: 'cp-child-3',
      parentId: root.id,
      stabilityPhase: undefined,
    });
    const nodes = [root, child1, child2, child3];

    expect(domain.calculateConstraintPower('missing', nodes)).toEqual({
      descendantCount: 0,
      failureCost: 0,
    });
    expect(domain.calculateConstraintPower(root.id, nodes)).toEqual({
      descendantCount: 3,
      failureCost: 12,
    });

    expect(domain.calculatePhaseDistribution(nodes)).toEqual({
      E0: 2,
      E1: 1,
      E2: 1,
    });
  });

  it('should report hasOpenedToday false for stale dates', () => {
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage: createLocalStorageMock(),
    });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    expect(domain.hasOpenedToday({ lastTreeOpenedAt: yesterday })).toBe(false);
  });

  it('consumes reinforcement on violation before deleting node', async () => {
    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [
          createNode({
            id: 'reinforced-node',
            reinforcementLevel: 2,
            totalViolations: 0,
          }),
        ],
        rsipExecutionRecords: [],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      appendRSIPExecutionRecord: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const updated = await domain.markViolated('reinforced-node', [
      createNode({
        id: 'reinforced-node',
        reinforcementLevel: 2,
        totalViolations: 0,
      }),
    ]);

    expect(updated).toHaveLength(1);
    expect(updated[0].reinforcementLevel).toBe(1);
    expect(updated[0].totalViolations).toBe(1);
    expect(stateRef.getState().rsipExecutionRecords).toHaveLength(1);
  });

  it('respects group fault tolerance on violation', async () => {
    const groupId = 'group-a';
    const groupNodeA = createNode({ id: 'group-node-a', groupId });
    const groupNodeB = createNode({ id: 'group-node-b', groupId });
    const independent = createNode({ id: 'independent-node' });

    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [groupNodeA, groupNodeB, independent],
        rsipGroups: [
          {
            id: groupId,
            title: 'Group A',
            faultTolerance: 1,
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
          },
        ],
        rsipPolicyLibrary: [],
        rsipExecutionRecords: [],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      saveRSIPPolicyLibrary: vi.fn(async () => undefined),
      appendRSIPExecutionRecord: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const updated = await domain.markViolated(groupNodeA.id, [
      groupNodeA,
      groupNodeB,
      independent,
    ]);

    expect(updated.map((node) => node.id)).toEqual([
      groupNodeB.id,
      independent.id,
    ]);
    expect(stateRef.getState().rsipPolicyLibrary).toHaveLength(1);
  });

  it('records collapse and increments run number', async () => {
    const startedAt = new Date('2026-02-01T00:00:00.000Z');
    const stateRef = createStateContainer(
      createBaseState({
        rsipMeta: {
          currentRunNumber: 2,
          currentRunStartedAt: startedAt,
        },
        rsipRunHistory: [],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPMeta: vi.fn(async () => undefined),
      saveRSIPRunHistory: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const nextMeta = await domain.recordCollapse(
      stateRef.getState().rsipMeta,
      'manual collapse',
      'Node X',
      10,
    );

    expect(nextMeta.currentRunNumber).toBe(3);
    expect(nextMeta.currentRunStartedAt).toBeInstanceOf(Date);
    expect(stateRef.getState().rsipRunHistory?.[0]).toMatchObject({
      runNumber: 2,
      maxNodeCount: 10,
      collapseReason: 'manual collapse',
      collapseNodeTitle: 'Node X',
    });
  });

  it('starts a new run when saving the first node into existing meta state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T14:00:00.000Z'));
    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [],
        rsipMeta: { allowMultiplePerDay: false },
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      saveRSIPMeta: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    await domain.saveNodes([createNode({ id: 'first-node' })]);

    expect(storage.saveRSIPMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        currentRunNumber: 1,
        currentRunStartedAt: new Date('2026-03-07T14:00:00.000Z'),
      }),
    );
    expect(stateRef.getState().rsipMeta).toMatchObject({
      currentRunNumber: 1,
    });
  });

  it('does not start a new run when nodes already exist or when the incoming list is empty', async () => {
    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [createNode({ id: 'existing-node' })],
        rsipMeta: { allowMultiplePerDay: false, currentRunNumber: 9 },
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      saveRSIPMeta: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    await domain.saveNodes([createNode({ id: 'replacement-node' })]);
    await domain.saveNodes([]);

    expect(storage.saveRSIPMeta).not.toHaveBeenCalled();
    expect(stateRef.getState().rsipMeta).toMatchObject({
      currentRunNumber: 9,
    });
  });

  it('rejects and rolls back groups, policy library, and run history on persistence failures', async () => {
    const groups = [createGroup({ id: 'group-save' })];
    const library = [createLibraryEntry({ id: 'library-save' })];
    const history = [
      {
        runNumber: 1,
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        endedAt: new Date('2026-02-02T00:00:00.000Z'),
        maxNodeCount: 4,
        durationDays: 1,
      },
    ];
    const originalGroups = [createGroup({ id: 'original-group' })];
    const originalLibrary = [createLibraryEntry({ id: 'original-library' })];
    const originalHistory = [
      {
        runNumber: 0,
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        endedAt: new Date('2026-01-02T00:00:00.000Z'),
        maxNodeCount: 2,
        durationDays: 1,
      },
    ];
    const stateRef = createStateContainer(
      createBaseState({
        rsipGroups: originalGroups,
        rsipPolicyLibrary: originalLibrary,
        rsipRunHistory: originalHistory,
      }),
    );
    const groupsFailure = new Error('groups failed');
    const libraryFailure = new Error('library failed');
    const historyFailure = new Error('history failed');
    const storage = createLocalStorageMock({
      saveRSIPGroups: vi.fn(async () => {
        throw groupsFailure;
      }),
      saveRSIPPolicyLibrary: vi.fn(async () => {
        throw libraryFailure;
      }),
      saveRSIPRunHistory: vi.fn(async () => {
        throw historyFailure;
      }),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    await expect(domain.saveGroups(groups)).rejects.toBe(groupsFailure);
    await expect(domain.savePolicyLibrary(library)).rejects.toBe(
      libraryFailure,
    );
    await expect(domain.saveRunHistory(history)).rejects.toBe(historyFailure);

    expect(stateRef.getState().rsipGroups).toBe(originalGroups);
    expect(stateRef.getState().rsipPolicyLibrary).toBe(originalLibrary);
    expect(stateRef.getState().rsipRunHistory).toBe(originalHistory);
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to save RSIP groups',
      { count: 1 },
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to save RSIP policy library',
      { count: 1 },
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to save RSIP run history',
      { count: 1 },
      expect.any(Error),
    );
  });

  it('normalizes task links but rejects and rolls back on persistence failure', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T15:00:00.000Z'));
    const latestLink = createTaskLink({
      id: 'link-latest',
      chainId: 'chain-1',
      rsipNodeId: 'node-1',
      updatedAt: new Date('2026-02-08T01:00:00.000Z'),
    });
    const staleDuplicate = createTaskLink({
      id: 'link-stale',
      chainId: 'chain-1',
      rsipNodeId: 'node-1',
      updatedAt: new Date('invalid'),
    });
    const originalLinks = [createTaskLink({ id: 'original-link' })];
    const stateRef = createStateContainer(
      createBaseState({ rsipTaskLinks: originalLinks }),
    );
    const failure = new Error('links failed');
    const storage = createLocalStorageMock({
      saveRSIPTaskLinks: vi.fn(async () => {
        throw failure;
      }),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const pendingSave = domain.saveTaskLinks([latestLink, staleDuplicate]);

    await expect(pendingSave).rejects.toBe(failure);
    expect(storage.saveRSIPTaskLinks).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'link-stale',
        chainId: 'chain-1',
        rsipNodeId: 'node-1',
        updatedAt: new Date('2026-03-07T15:00:00.000Z'),
      }),
    ]);
    expect(stateRef.getState().rsipTaskLinks).toBe(originalLinks);
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to save RSIP task links',
      { count: 1 },
      expect.any(Error),
    );
  });

  it('creates groups with trimmed titles and floored fault tolerance', async () => {
    const existingGroup = createGroup({ id: 'existing-group' });
    const stateRef = createStateContainer(
      createBaseState({
        rsipGroups: [existingGroup],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPGroups: vi.fn(async () => undefined),
    });
    const randomUUIDMock = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('created-group-id');
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const created = await domain.createGroup('  Focus Group  ', 2.8, '🎯');

    expect(created).toMatchObject({
      id: 'created-group-id',
      title: 'Focus Group',
      faultTolerance: 2,
      emoji: '🎯',
    });
    expect(stateRef.getState().rsipGroups).toHaveLength(2);
    randomUUIDMock.mockRestore();
  });

  it('creates groups without state by starting from an empty list', async () => {
    const storage = createLocalStorageMock({
      saveRSIPGroups: vi.fn(async () => undefined),
    });
    const randomUUIDMock = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('stateless-group-id');
    const stateRef = createStateContainer(createBaseState());
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
    });

    const created = await domain.createGroup('Stateless Group', 1.2);

    expect(created).toMatchObject({
      id: 'stateless-group-id',
      title: 'Stateless Group',
      faultTolerance: 1,
    });
    expect(stateRef.getState().rsipGroups).toEqual([created]);
    randomUUIDMock.mockRestore();
  });

  it('evaluates group liveness across missing, empty, and populated states', () => {
    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [createNode({ id: 'alive-node', groupId: 'alive-group' })],
        rsipGroups: [
          createGroup({ id: 'alive-group', faultTolerance: 0 }),
          createGroup({ id: 'empty-group', faultTolerance: 2 }),
        ],
      }),
    );
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage: createLocalStorageMock(),
      getState: stateRef.getState,
    });

    expect(domain.isGroupAlive('missing-group')).toBe(false);
    expect(domain.isGroupAlive('empty-group')).toBe(false);
    expect(domain.isGroupAlive('alive-group')).toBe(true);
  });

  it('evaluates group liveness from explicit nodes and groups without relying on state', () => {
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage: createLocalStorageMock(),
    });
    const groups = [createGroup({ id: 'provided-group', faultTolerance: 3 })];
    const nodes = [
      createNode({ id: 'provided-node', groupId: 'provided-group' }),
    ];

    expect(domain.isGroupAlive('provided-group', nodes, groups)).toBe(true);
    expect(domain.isGroupAlive('missing-group', nodes, groups)).toBe(false);
  });

  it('archives new and existing library entries with accumulated progress', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T16:00:00.000Z'));
    const stateRef = createStateContainer(
      createBaseState({
        rsipPolicyLibrary: [
          createLibraryEntry({
            id: 'archived-node',
            cumulativeExecutionDays: 50,
            timesUsed: 2,
            internalizationProgress: 83.33,
          }),
        ],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPPolicyLibrary: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const accumulated = await domain.archiveToLibrary(
      createNode({
        id: 'archived-node',
        title: 'Updated Title',
        rule: 'Updated Rule',
        cumulativeExecutionDays: 20,
        emoji: '🧠',
      }),
    );
    const created = await domain.archiveToLibrary(
      createNode({
        id: 'new-library-node',
        title: 'Brand New',
        rule: 'Brand Rule',
        cumulativeExecutionDays: 15,
      }),
      accumulated,
    );

    expect(accumulated[0]).toMatchObject({
      title: 'Updated Title',
      rule: 'Updated Rule',
      cumulativeExecutionDays: 70,
      internalizationProgress: 100,
      timesUsed: 3,
      lastActiveAt: new Date('2026-03-07T16:00:00.000Z'),
    });
    expect(
      created.find((entry) => entry.id === 'new-library-node'),
    ).toMatchObject({
      cumulativeExecutionDays: 15,
      internalizationProgress: 25,
      timesUsed: 1,
    });
  });

  it('archives into explicit library input and preserves fallback fields from the existing entry', async () => {
    const storage = createLocalStorageMock({
      saveRSIPPolicyLibrary: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage,
    });
    const existingEntry = createLibraryEntry({
      id: 'preserve-entry',
      type: 'discipline',
      emoji: '🪨',
      useTimer: true,
      timerMinutes: 45,
      isPassive: true,
      cumulativeExecutionDays: 10,
      timesUsed: 1,
    });

    const next = await domain.archiveToLibrary(
      createNode({
        id: 'preserve-entry',
        title: 'Preserved Title',
        rule: 'Preserved Rule',
        totalExecutions: 5,
        type: undefined,
        emoji: undefined,
        useTimer: undefined,
        timerMinutes: undefined,
        isPassive: undefined,
      }),
      [existingEntry],
    );

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      title: 'Preserved Title',
      rule: 'Preserved Rule',
      type: 'discipline',
      emoji: '🪨',
      useTimer: true,
      timerMinutes: 45,
      isPassive: true,
      cumulativeExecutionDays: 15,
      timesUsed: 2,
    });
  });

  it('restores nodes from library entries and updates usage metadata', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T17:00:00.000Z'));
    const entry = createLibraryEntry({
      id: 'restore-entry',
      title: 'Restore Me',
      rule: 'Restored Rule',
      useTimer: true,
      timerMinutes: 25,
      cumulativeExecutionDays: 18,
      timesUsed: 4,
    });
    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [createNode({ id: 'existing-node' })],
        rsipPolicyLibrary: [entry],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      saveRSIPPolicyLibrary: vi.fn(async () => undefined),
    });
    const randomUUIDMock = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('restored-node-id');
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    expect(await domain.restoreFromLibrary('missing-entry')).toBeNull();

    const restored = await domain.restoreFromLibrary(
      'restore-entry',
      'parent-1',
    );

    expect(restored).toMatchObject({
      id: 'restored-node-id',
      parentId: 'parent-1',
      title: 'Restore Me',
      rule: 'Restored Rule',
      useTimer: true,
      timerMinutes: 25,
      cumulativeExecutionDays: 18,
      stabilityPhase: 'E0',
      consecutiveExecutions: 0,
      totalExecutions: 0,
      totalViolations: 0,
    });
    expect(stateRef.getState().rsipNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'restored-node-id' }),
      ]),
    );
    expect(stateRef.getState().rsipPolicyLibrary?.[0]).toMatchObject({
      id: 'restore-entry',
      timesUsed: 5,
      lastActiveAt: new Date('2026-03-07T17:00:00.000Z'),
    });
    randomUUIDMock.mockRestore();
  });

  it('returns null when restoring from library without state access', async () => {
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage: createLocalStorageMock(),
    });

    await expect(domain.restoreFromLibrary('any-entry')).resolves.toBeNull();
  });

  it('starts new runs idempotently and reinforces only E2 nodes', async () => {
    const stateRef = createStateContainer(
      createBaseState({
        rsipMeta: {
          currentRunNumber: 3,
          currentRunStartedAt: new Date('2026-02-20T00:00:00.000Z'),
        },
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPMeta: vi.fn(async () => undefined),
      saveRSIPNodes: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const sameMeta = await domain.startNewRun(stateRef.getState().rsipMeta);
    const reinforced = await domain.reinforceNode(
      'reinforce-target',
      [
        createNode({
          id: 'reinforce-target',
          stabilityPhase: 'E2',
          reinforcementLevel: 2,
          maxReinforcementLevel: 2,
        }),
        createNode({
          id: 'not-reinforced',
          stabilityPhase: 'E1',
          reinforcementLevel: 5,
        }),
      ],
      0,
    );

    expect(sameMeta).toEqual(stateRef.getState().rsipMeta);
    expect(storage.saveRSIPMeta).not.toHaveBeenCalled();
    expect(
      reinforced.find((node) => node.id === 'reinforce-target'),
    ).toMatchObject({
      reinforcementLevel: 3,
      maxReinforcementLevel: 3,
    });
    expect(
      reinforced.find((node) => node.id === 'not-reinforced'),
    ).toMatchObject({
      reinforcementLevel: 5,
    });
  });

  it('keeps a committed execution when its post-commit audit record fails', async () => {
    const stateRef = createStateContainer(
      createBaseState({
        rsipExecutionRecords: [
          {
            id: 'existing-record',
            nodeId: 'other-node',
            executedAt: new Date('2026-02-01T00:00:00.000Z'),
            status: 'executed',
          },
        ],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      appendRSIPExecutionRecord: vi.fn(async () => {
        throw new Error('append failed');
      }),
    });
    const randomUUIDMock = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('new-record-id');
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const updated = await domain.markExecuted(
      'reinforced-e2',
      [
        createNode({
          id: 'reinforced-e2',
          stabilityPhase: 'E2',
          reinforcementLevel: 1,
          maxReinforcementLevel: 1,
          consecutiveExecutions: 21,
          totalExecutions: 21,
        }),
      ],
      'reinforced execution',
      {
        reinforce: true,
        reasonCode: 'manual_execution',
      },
    );

    expect(updated[0]).toMatchObject({
      reinforcementLevel: 2,
      maxReinforcementLevel: 2,
      totalExecutions: 22,
    });
    expect(stateRef.getState().rsipNodes[0]).toMatchObject({
      id: 'reinforced-e2',
      reinforcementLevel: 2,
      totalExecutions: 22,
    });
    expect(stateRef.getState().rsipExecutionRecords).toEqual([
      expect.objectContaining({ id: 'existing-record' }),
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      'RSIP',
      'Failed to append RSIP execution record',
      { nodeId: 'reinforced-e2', status: 'executed' },
      expect.any(Error),
    );
    randomUUIDMock.mockRestore();
  });

  it('inserts or updates task links and returns RSIP task actions for rsip_mark_executed prompts', async () => {
    const existing = createTaskLink({
      id: 'existing-link',
      rsipNodeId: 'node-1',
      chainId: 'chain-1',
      updatedAt: new Date('2026-02-08T00:00:00.000Z'),
    });
    const incoming = createTaskLink({
      id: 'incoming-link',
      rsipNodeId: 'node-1',
      chainId: 'chain-1',
      updatedAt: new Date('2026-02-08T01:00:00.000Z'),
      triggerEvent: 'rsip_mark_executed',
      effect: 'prompt_start_chain',
    });
    const ignored = createTaskLink({
      id: 'ignored-link',
      rsipNodeId: 'node-1',
      chainId: 'chain-2',
      triggerEvent: 'task_completed',
      effect: 'mark_rsip_executed',
    });
    const stateRef = createStateContainer(
      createBaseState({
        rsipTaskLinks: [existing, ignored],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPTaskLinks: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });

    const merged = await domain.upsertTaskLinks([incoming]);

    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'incoming-link' }),
      ]),
    );
    expect(domain.getRsipTaskActions('node-1')).toEqual([
      expect.objectContaining({
        id: 'incoming-link',
        triggerEvent: 'rsip_mark_executed',
        effect: 'prompt_start_chain',
      }),
    ]);
  });

  it('returns empty task-link integrations when state is unavailable', async () => {
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage: createLocalStorageMock(),
    });

    await expect(domain.upsertTaskLinks([createTaskLink()])).resolves.toEqual([
      createTaskLink(),
    ]);
    expect(domain.getRsipTaskActions('missing-node')).toEqual([]);
    await expect(
      domain.handleTaskEventIntegration({
        event: 'task_completed',
        chainId: 'missing-chain',
        chainKind: 'unit',
      }),
    ).resolves.toEqual([]);
  });

  it('handles task integration execution, dedupe, and missing-node warnings', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T18:00:00.000Z'));
    const executableNode = createNode({
      id: 'integration-node',
      stabilityPhase: 'E0',
      consecutiveExecutions: 6,
      totalExecutions: 6,
    });
    const executionLink = createTaskLink({
      id: 'integration-link',
      rsipNodeId: executableNode.id,
      chainId: 'chain-1',
      triggerEvent: 'task_completed',
      effect: 'mark_rsip_executed',
      updatedAt: new Date('2026-02-08T01:00:00.000Z'),
    });
    const staleDuplicate = createTaskLink({
      id: 'integration-link-stale',
      rsipNodeId: executableNode.id,
      chainId: 'chain-1',
      triggerEvent: 'task_completed',
      effect: 'mark_rsip_executed',
      updatedAt: new Date('2026-02-08T00:00:00.000Z'),
    });
    const missingNodeLink = createTaskLink({
      id: 'missing-node-link',
      rsipNodeId: 'missing-node',
      chainId: 'chain-2',
      triggerEvent: 'task_interrupted',
      effect: 'mark_rsip_violated',
    });
    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [executableNode],
        rsipTaskLinks: [staleDuplicate, executionLink, missingNodeLink],
        rsipExecutionRecords: [],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      appendRSIPExecutionRecord: vi.fn(async () => undefined),
    });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      confirmTaskLink: async () => true,
      getState: stateRef.getState,
    });

    const executed = await domain.handleTaskEventIntegration({
      event: 'task_completed',
      chainId: 'chain-1',
      chainKind: 'unit',
      occurredAt: new Date('2026-03-07T18:00:00.000Z'),
    });
    const deduped = await domain.handleTaskEventIntegration({
      event: 'task_completed',
      chainId: 'chain-1',
      chainKind: 'unit',
      occurredAt: new Date('2026-03-07T18:00:00.000Z'),
    });
    const missingNodeResult = await domain.handleTaskEventIntegration({
      event: 'task_interrupted',
      chainId: 'chain-2',
      chainKind: 'unit',
      occurredAt: new Date('2026-03-07T18:00:00.000Z'),
    });

    expect(
      executed.find((node) => node.id === 'integration-node'),
    ).toMatchObject({
      stabilityPhase: 'E1',
      totalExecutions: 7,
      consecutiveExecutions: 7,
    });
    expect(deduped).toEqual(executed);
    expect(missingNodeResult).toEqual(executed);
    expect(stateRef.getState().rsipExecutionRecords).toHaveLength(1);
    expect(stateRef.getState().rsipExecutionRecords?.[0]).toMatchObject({
      nodeId: 'integration-node',
      status: 'executed',
      sourceChainId: 'chain-1',
      sourceEvent: 'task_completed',
      reasonCode: 'integration_task_completed',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'RSIP',
      'RSIP integration skipped: target node missing',
      {
        event: 'task_interrupted',
        rsipNodeId: 'missing-node',
        chainId: 'chain-2',
      },
    );
  });

  it('handles task integration violation effects and records collapse details', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T19:00:00.000Z'));
    const targetNode = createNode({
      id: 'violation-node',
      title: 'Violation Node',
      parentId: 'group-parent',
      groupId: 'group-collapse',
    });
    const siblingNode = createNode({
      id: 'violation-sibling',
      parentId: 'group-parent',
      groupId: 'group-collapse',
    });
    const independentNode = createNode({ id: 'safe-node' });
    const violationLink = createTaskLink({
      id: 'violation-link',
      rsipNodeId: targetNode.id,
      chainId: 'chain-violation',
      triggerEvent: 'task_interrupted',
      effect: 'mark_rsip_violated',
    });
    const stateRef = createStateContainer(
      createBaseState({
        rsipNodes: [targetNode, siblingNode, independentNode],
        rsipGroups: [createGroup({ id: 'group-collapse', faultTolerance: 0 })],
        rsipTaskLinks: [violationLink],
        rsipMeta: {
          currentRunNumber: 4,
          currentRunStartedAt: new Date('2026-03-05T19:00:00.000Z'),
        },
        rsipRunHistory: [],
        rsipPolicyLibrary: [],
        rsipExecutionRecords: [],
      }),
    );
    const storage = createLocalStorageMock({
      saveRSIPNodes: vi.fn(async () => undefined),
      saveRSIPPolicyLibrary: vi.fn(async () => undefined),
      appendRSIPExecutionRecord: vi.fn(async () => undefined),
      saveRSIPRunHistory: vi.fn(async () => undefined),
      saveRSIPMeta: vi.fn(async () => undefined),
    });
    const randomUUIDMock = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('violation-record-id');
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      confirmTaskLink: async () => true,
      getState: stateRef.getState,
    });

    const updated = await domain.handleTaskEventIntegration({
      event: 'task_interrupted',
      chainId: 'chain-violation',
      chainKind: 'unit',
      occurredAt: new Date('2026-03-07T19:00:00.000Z'),
    });

    expect(updated).toEqual([expect.objectContaining({ id: 'safe-node' })]);
    expect(stateRef.getState().rsipExecutionRecords?.[0]).toMatchObject({
      id: 'violation-record-id',
      nodeId: 'violation-node',
      status: 'violated',
      reasonCode: 'integration_task_interrupted',
      sourceChainId: 'chain-violation',
      sourceEvent: 'task_interrupted',
    });
    expect(stateRef.getState().rsipRunHistory?.[0]).toMatchObject({
      runNumber: 4,
      maxNodeCount: 3,
      durationDays: 2,
      collapseReason: 'integration_task_interrupted',
      collapseNodeTitle: 'Violation Node',
    });
    expect(stateRef.getState().rsipMeta).toMatchObject({
      currentRunNumber: 5,
    });
    randomUUIDMock.mockRestore();
  });

  it('calculates reduced failure cost for reinforced nodes', () => {
    const domain = useRsipDomain({
      setState: vi.fn(),
      storage: createLocalStorageMock(),
    });
    const root = createNode({
      id: 'reinforced-root',
      stabilityPhase: 'E2',
      reinforcementLevel: 2,
    });
    const child = createNode({
      id: 'reinforced-child',
      parentId: root.id,
      stabilityPhase: 'E1',
    });

    expect(domain.calculateConstraintPower(root.id, [root, child])).toEqual({
      descendantCount: 1,
      failureCost: 1.8,
    });
  });
});

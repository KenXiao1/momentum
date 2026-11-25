/**
 * Shared behavioral contract for MomentumStorage adapters.
 *
 * Local runs it in the unit suite; SupabaseStorage runs it in the integration
 * suite through the real Supabase SDK against the HTTP-level REST fake.
 * SQL, RLS and RPC semantics are covered separately on real PostgreSQL by
 * scripts/database/run-tests.py.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ActiveSession,
  CompletionHistory,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
  ScheduledSession,
} from '../../types';
import { ExceptionRuleType } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { createUnitChain } from '../factories/chainFactory';
import { createPetState } from '../factories/petStateFactory';

const JAN_1 = new Date('2026-01-01T00:00:00.000Z');
const JAN_2 = new Date('2026-01-02T00:00:00.000Z');
const JAN_3 = new Date('2026-01-03T00:00:00.000Z');

function makeScheduledSession(chainId: string): ScheduledSession {
  return {
    chainId,
    scheduledAt: new Date('2026-01-10T08:00:00.000Z'),
    expiresAt: new Date('2026-01-10T09:00:00.000Z'),
    auxiliarySignal: 'put-on-headphones',
  };
}

function makeActiveSession(chainId: string): ActiveSession {
  return {
    chainId,
    startedAt: new Date('2026-01-10T09:00:00.000Z'),
    duration: 1500,
    isPaused: false,
    totalPausedTime: 0,
  };
}

function makeHistory(chainId: string, completedAt = JAN_1): CompletionHistory {
  return {
    chainId,
    completedAt,
    duration: 30,
    wasSuccessful: true,
  };
}

function makeRsipNode(id: string, title = `RSIP node ${id}`): RSIPNode {
  return {
    id,
    title,
    rule: `Execute ${id} daily`,
    sortOrder: 0,
    createdAt: JAN_1,
    phaseStartedAt: JAN_2,
    lastExecutedAt: JAN_3,
  };
}

function makeRsipGroup(id: string): RSIPNodeGroup {
  return {
    id,
    title: `Group ${id}`,
    faultTolerance: 1,
    createdAt: JAN_1,
    emoji: '🛡️',
  };
}

function makeLibraryEntry(
  id: string,
  title = `Library ${id}`,
): RSIPLibraryEntry {
  return {
    id,
    title,
    rule: `Rule ${id}`,
    cumulativeExecutionDays: 8,
    internalizationProgress: 20,
    lastActiveAt: JAN_2,
    timesUsed: 3,
  };
}

function makeRun(runNumber: number): RSIPRunRecord {
  return {
    runNumber,
    startedAt: JAN_1,
    endedAt: JAN_3,
    maxNodeCount: 6,
    durationDays: 2,
    collapseReason: 'manual',
  };
}

function makeTaskLink(id: string, nodeId: string): RSIPTaskLink {
  return {
    id,
    rsipNodeId: nodeId,
    chainId: `chain-${id}`,
    chainKind: 'unit',
    triggerEvent: 'task_completed',
    effect: 'mark_rsip_executed',
    automation: 'confirm',
    isActive: true,
    updatedAt: JAN_2,
  };
}

function makeExecutionRecord(id: string, nodeId: string): RSIPExecutionRecord {
  return {
    id,
    nodeId,
    status: 'executed',
    executedAt: JAN_3,
    notes: `note-${id}`,
  };
}

/** Reads whose failure must reject: an empty result would mean "no data". */
type ContractReadTarget = 'scheduledSessions' | 'activeSession' | 'rsipMeta';

interface StorageContractSetup {
  /** Returns a storage instance with empty persisted state. */
  reset(): Promise<MomentumStorage>;
  /** Makes reads of `target` fail the way this adapter's backing store can. */
  breakRead(target: ContractReadTarget): void;
}

/**
 * Behavior every MomentumStorage adapter must share. Each adapter runs this
 * suite from its own test file so it can supply its own environment.
 */
export function describeStorageContract(
  label: string,
  setup: StorageContractSetup,
): void {
  describe(`MomentumStorage contract [${label}]`, () => {
    let storage: MomentumStorage;

    beforeEach(async () => {
      storage = await setup.reset();
    });

    describe('ChainStore', () => {
      it('starts empty and round-trips all chains with hydrated dates', async () => {
        await expect(storage.getChains()).resolves.toEqual([]);

        const chains = [
          createUnitChain({ id: 'c-a', name: 'Alpha', createdAt: JAN_1 }),
          createUnitChain({ id: 'c-b', name: 'Beta', createdAt: JAN_2 }),
        ];
        await storage.saveChains(chains);

        // Chain order is unspecified by the port.
        const loaded = (await storage.getChains()).sort((a, b) =>
          a.id.localeCompare(b.id),
        );
        expect(loaded.map(({ id, name }) => ({ id, name }))).toEqual([
          { id: 'c-a', name: 'Alpha' },
          { id: 'c-b', name: 'Beta' },
        ]);
        expect(loaded.map((chain) => chain.createdAt)).toEqual([JAN_1, JAN_2]);
        expect(loaded.every((chain) => chain.createdAt instanceof Date)).toBe(
          true,
        );
      });

      it('upserts by id without duplicating an existing chain', async () => {
        await storage.upsertChain(
          createUnitChain({ id: 'target', name: 'Before' }),
        );
        await storage.upsertChain(
          createUnitChain({ id: 'target', name: 'After' }),
        );
        await storage.upsertChain(createUnitChain({ id: 'other' }));

        const loaded = await storage.getChains();
        expect(loaded).toHaveLength(2);
        expect(loaded.find((chain) => chain.id === 'target')?.name).toBe(
          'After',
        );
      });

      it('batch-upserts chains without deleting chains it was not given', async () => {
        await storage.saveChains([
          createUnitChain({ id: 'kept', name: 'Kept' }),
          createUnitChain({ id: 'edited', name: 'Before' }),
        ]);

        await storage.upsertChains([
          createUnitChain({ id: 'edited', name: 'After' }),
          createUnitChain({ id: 'created', name: 'Created' }),
        ]);

        const loaded = new Map(
          (await storage.getChains()).map((chain) => [chain.id, chain.name]),
        );
        expect(Object.fromEntries(loaded)).toEqual({
          kept: 'Kept',
          edited: 'After',
          created: 'Created',
        });
      });

      it('soft-deletes, restores, and permanently deletes the target only', async () => {
        await storage.saveChains([
          createUnitChain({ id: 'target' }),
          createUnitChain({ id: 'other' }),
        ]);

        await storage.softDeleteChain('target');
        expect(
          (await storage.getActiveChains()).map((chain) => chain.id),
        ).toEqual(['other']);
        const [deleted] = await storage.getDeletedChains();
        expect(deleted.id).toBe('target');
        expect(deleted.deletedAt).toBeInstanceOf(Date);

        await storage.restoreChain('target');
        expect(
          (await storage.getDeletedChains()).map((chain) => chain.id),
        ).toEqual([]);
        expect(
          (await storage.getActiveChains()).map((chain) => chain.id).sort(),
        ).toEqual(['other', 'target']);

        await storage.softDeleteChain('target');
        await storage.permanentlyDeleteChain('target');
        expect((await storage.getChains()).map((chain) => chain.id)).toEqual([
          'other',
        ]);
      });

      it('cleans up only deleted chains older than the cutoff', async () => {
        const day = 24 * 60 * 60 * 1000;
        await storage.saveChains([
          createUnitChain({
            id: 'old',
            deletedAt: new Date(Date.now() - 90 * day),
          }),
          createUnitChain({
            id: 'recent',
            deletedAt: new Date(Date.now() - 5 * day),
          }),
          createUnitChain({ id: 'active' }),
        ]);

        await expect(storage.cleanupExpiredDeletedChains(30)).resolves.toBe(1);
        expect(
          (await storage.getDeletedChains()).map((chain) => chain.id),
        ).toEqual(['recent']);
        expect(
          (await storage.getActiveChains()).map((chain) => chain.id),
        ).toEqual(['active']);
      });
    });

    describe('SessionStore', () => {
      it('sets, updates, removes, and replaces scheduled sessions', async () => {
        await expect(storage.getScheduledSessions()).resolves.toEqual([]);

        await storage.setScheduledSession(makeScheduledSession('first'));
        await storage.setScheduledSession({
          ...makeScheduledSession('first'),
          auxiliarySignal: 'ring-bell',
        });
        await storage.setScheduledSession(makeScheduledSession('second'));

        let loaded = await storage.getScheduledSessions();
        expect(loaded).toHaveLength(2);
        expect(
          loaded.find((session) => session.chainId === 'first'),
        ).toMatchObject({ auxiliarySignal: 'ring-bell' });
        expect(
          loaded.every((session) => session.scheduledAt instanceof Date),
        ).toBe(true);

        await storage.removeScheduledSession('first');
        expect(
          (await storage.getScheduledSessions()).map((s) => s.chainId),
        ).toEqual(['second']);

        await storage.saveScheduledSessions([
          makeScheduledSession('replacement'),
        ]);
        loaded = await storage.getScheduledSessions();
        expect(loaded.map((session) => session.chainId)).toEqual([
          'replacement',
        ]);
        expect(loaded[0].expiresAt).toEqual(
          new Date('2026-01-10T09:00:00.000Z'),
        );
      });

      it('round-trips and clears the active session', async () => {
        await expect(storage.getActiveSession()).resolves.toBeNull();

        await storage.saveActiveSession(makeActiveSession('chain-1'));
        await expect(storage.getActiveSession()).resolves.toMatchObject({
          chainId: 'chain-1',
          duration: 1500,
          startedAt: new Date('2026-01-10T09:00:00.000Z'),
        });

        await storage.saveActiveSession(null);
        await expect(storage.getActiveSession()).resolves.toBeNull();
      });
    });

    describe('HistoryStore', () => {
      it('returns history oldest first, hydrates dates, and replaces it', async () => {
        await expect(storage.getCompletionHistory()).resolves.toEqual([]);

        await storage.appendCompletionHistory(makeHistory('first', JAN_1));
        await storage.appendCompletionHistory(makeHistory('second', JAN_2));
        let loaded = await storage.getCompletionHistory();
        expect(loaded.map((record) => record.chainId)).toEqual([
          'first',
          'second',
        ]);
        expect(loaded.map((record) => record.completedAt)).toEqual([
          JAN_1,
          JAN_2,
        ]);

        await storage.saveCompletionHistory([
          makeHistory('replacement', JAN_3),
        ]);
        loaded = await storage.getCompletionHistory();
        expect(loaded).toEqual([
          expect.objectContaining({
            chainId: 'replacement',
            completedAt: JAN_3,
          }),
        ]);
      });
    });

    describe('TaskTimeStatsStore', () => {
      it('creates and updates exact completion aggregates', async () => {
        await expect(
          storage.getLastCompletionTime('missing'),
        ).resolves.toBeNull();
        await expect(storage.getTaskAverageTime('missing')).resolves.toBeNull();

        await storage.updateTaskTimeStats('chain-1', 40);
        await storage.updateTaskTimeStats('chain-1', 80);

        await expect(storage.getLastCompletionTime('chain-1')).resolves.toBe(
          80,
        );
        await expect(storage.getTaskAverageTime('chain-1')).resolves.toBe(60);
        await expect(storage.getTaskTimeStats()).resolves.toEqual([
          expect.objectContaining({
            chainId: 'chain-1',
            totalCompletions: 2,
            totalTime: 120,
            averageCompletionTime: 60,
          }),
        ]);
      });

      it('saveTaskTimeStats replaces prior stats', async () => {
        await storage.updateTaskTimeStats('old', 30);
        await storage.saveTaskTimeStats([
          { chainId: 'new', totalCompletions: 1, totalTime: 45 },
        ]);

        await expect(storage.getTaskTimeStats()).resolves.toEqual([
          expect.objectContaining({ chainId: 'new', totalTime: 45 }),
        ]);
      });
    });

    describe('PetStore', () => {
      it('starts empty and overwrites a hydrated pet state', async () => {
        await expect(storage.getPetState()).resolves.toBeNull();
        await storage.savePetState(
          createPetState({ id: 'pet-1', name: 'Before', createdAt: JAN_1 }),
        );
        await storage.savePetState(
          createPetState({ id: 'pet-1', name: 'After', createdAt: JAN_2 }),
        );

        const loaded = await storage.getPetState();
        expect(loaded).toMatchObject({ id: 'pet-1', name: 'After' });
        expect(loaded?.createdAt).toEqual(JAN_2);
        expect(loaded?.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('RuleStore', () => {
      it('starts empty and replaces hydrated rules and usage records', async () => {
        await expect(storage.getRules()).resolves.toEqual([]);
        await expect(storage.getUsageRecords()).resolves.toEqual([]);

        const rule = {
          id: 'rule-1',
          name: 'Phone call',
          type: ExceptionRuleType.PAUSE_ONLY,
          scope: 'global' as const,
          createdAt: JAN_1,
          lastUsedAt: JAN_2,
          usageCount: 1,
          isActive: true,
        };
        await storage.saveRules([rule]);
        await storage.saveUsageRecords([
          {
            id: 'use-1',
            ruleId: 'rule-1',
            chainId: 'chain-1',
            sessionId: 'session-1',
            usedAt: JAN_2,
            actionType: 'pause',
            taskElapsedTime: 60,
            ruleScope: 'global',
          },
        ]);
        await storage.saveRules([{ ...rule, name: 'Doorbell', usageCount: 2 }]);

        const rules = await storage.getRules();
        expect(rules).toMatchObject([
          { id: 'rule-1', name: 'Doorbell', usageCount: 2 },
        ]);
        expect(rules[0].createdAt).toEqual(JAN_1);
        expect(rules[0].lastUsedAt).toEqual(JAN_2);
        const records = await storage.getUsageRecords();
        expect(records).toMatchObject([{ id: 'use-1', ruleId: 'rule-1' }]);
        expect(records[0].usedAt).toEqual(JAN_2);
      });
    });

    describe('RsipStore', () => {
      it('starts with every RSIP collection empty and default metadata', async () => {
        await expect(storage.getRSIPNodes()).resolves.toEqual([]);
        await expect(storage.getRSIPMeta()).resolves.toEqual({});
        await expect(storage.getRSIPGroups()).resolves.toEqual([]);
        await expect(storage.getRSIPPolicyLibrary()).resolves.toEqual([]);
        await expect(storage.getRSIPRunHistory()).resolves.toEqual([]);
        await expect(storage.getRSIPTaskLinks()).resolves.toEqual([]);
        await expect(storage.getRSIPExecutionRecords()).resolves.toEqual([]);
      });

      it('saves, hydrates, upserts, and removes RSIP nodes by id', async () => {
        await storage.saveRSIPNodes([
          makeRsipNode('first'),
          makeRsipNode('second'),
        ]);
        await storage.upsertRSIPNode(makeRsipNode('second', 'Updated second'));
        await storage.upsertRSIPNode(makeRsipNode('third'));
        await storage.removeRSIPNodes(['first', 'third']);

        const loaded = await storage.getRSIPNodes();
        expect(loaded).toEqual([
          expect.objectContaining({ id: 'second', title: 'Updated second' }),
        ]);
        expect(loaded[0].createdAt).toEqual(JAN_1);
        expect(loaded[0].phaseStartedAt).toEqual(JAN_2);
        expect(loaded[0].lastExecutedAt).toEqual(JAN_3);
      });

      it('replaces and hydrates RSIP metadata', async () => {
        const meta: RSIPMeta = {
          lastAddedAt: JAN_1,
          allowMultiplePerDay: true,
          currentRunNumber: 5,
          currentRunStartedAt: JAN_2,
        };
        await storage.saveRSIPMeta(meta);

        expect(await storage.getRSIPMeta()).toEqual({
          ...meta,
          dailyTreeOpenRequired: false,
          lastTreeOpenedAt: undefined,
          phaseDistribution: undefined,
          treeOpenStreak: 0,
        });
        await storage.saveRSIPMeta({ currentRunNumber: 6 });
        expect(await storage.getRSIPMeta()).toEqual({
          allowMultiplePerDay: false,
          currentRunNumber: 6,
          currentRunStartedAt: undefined,
          dailyTreeOpenRequired: false,
          lastAddedAt: undefined,
          lastTreeOpenedAt: undefined,
          phaseDistribution: undefined,
          treeOpenStreak: 0,
        });
      });

      it('replaces groups and hydrates createdAt', async () => {
        await storage.saveRSIPGroups([
          makeRsipGroup('old'),
          makeRsipGroup('other'),
        ]);
        await storage.saveRSIPGroups([makeRsipGroup('replacement')]);

        const loaded = await storage.getRSIPGroups();
        expect(loaded).toEqual([
          expect.objectContaining({ id: 'replacement', emoji: '🛡️' }),
        ]);
        expect(loaded[0].createdAt).toEqual(JAN_1);
      });

      it('replaces, upserts, and hydrates policy library entries', async () => {
        await storage.saveRSIPPolicyLibrary([
          makeLibraryEntry('first'),
          makeLibraryEntry('second'),
        ]);
        await storage.upsertRSIPLibraryEntry(
          makeLibraryEntry('second', 'Updated second'),
        );
        await storage.upsertRSIPLibraryEntry(makeLibraryEntry('third'));

        // Library order is unspecified by the port; the view sorts entries.
        let loaded = (await storage.getRSIPPolicyLibrary()).sort((a, b) =>
          a.id.localeCompare(b.id),
        );
        expect(loaded.map(({ id, title }) => ({ id, title }))).toEqual([
          { id: 'first', title: 'Library first' },
          { id: 'second', title: 'Updated second' },
          { id: 'third', title: 'Library third' },
        ]);
        expect(
          loaded.every((entry) => entry.lastActiveAt instanceof Date),
        ).toBe(true);

        await storage.saveRSIPPolicyLibrary([makeLibraryEntry('replacement')]);
        loaded = await storage.getRSIPPolicyLibrary();
        expect(loaded.map((entry) => entry.id)).toEqual(['replacement']);
      });

      it('replaces run history and prepends appended records', async () => {
        await storage.saveRSIPRunHistory([makeRun(1), makeRun(2)]);
        await storage.saveRSIPRunHistory([makeRun(3)]);
        await storage.appendRSIPRunRecord(makeRun(4));

        const loaded = await storage.getRSIPRunHistory();
        expect(loaded.map((record) => record.runNumber)).toEqual([4, 3]);
        expect(loaded[0].startedAt).toEqual(JAN_1);
        expect(loaded[0].endedAt).toEqual(JAN_3);
      });

      it('replaces task links and hydrates updatedAt', async () => {
        await storage.saveRSIPTaskLinks([
          makeTaskLink('first', 'node-1'),
          makeTaskLink('second', 'node-2'),
        ]);
        await storage.saveRSIPTaskLinks([
          { ...makeTaskLink('replacement', 'node-3'), isActive: false },
        ]);

        const loaded = await storage.getRSIPTaskLinks();
        expect(loaded).toEqual([
          expect.objectContaining({
            id: 'replacement',
            rsipNodeId: 'node-3',
            isActive: false,
          }),
        ]);
        expect(loaded[0].updatedAt).toEqual(JAN_2);
      });

      it('appends execution records without replacing prior records', async () => {
        await storage.appendRSIPExecutionRecord(
          makeExecutionRecord('first', 'node-1'),
        );
        await storage.appendRSIPExecutionRecord(
          makeExecutionRecord('second', 'node-2'),
        );

        const loaded = await storage.getRSIPExecutionRecords();
        expect(loaded.map(({ id, nodeId }) => ({ id, nodeId }))).toEqual([
          { id: 'first', nodeId: 'node-1' },
          { id: 'second', nodeId: 'node-2' },
        ]);
        expect(
          loaded.every((record) => record.executedAt instanceof Date),
        ).toBe(true);
        expect(loaded[1].notes).toBe('note-second');
      });
    });

    describe('read failures', () => {
      const reads: Record<ContractReadTarget, () => Promise<unknown>> = {
        scheduledSessions: () => storage.getScheduledSessions(),
        activeSession: () => storage.getActiveSession(),
        rsipMeta: () => storage.getRSIPMeta(),
      };

      it.each(Object.keys(reads) as ContractReadTarget[])(
        'rejects a failed %s read instead of reporting empty state',
        async (target) => {
          setup.breakRead(target);

          await expect(reads[target]()).rejects.toThrow();
        },
      );
    });
  });
}

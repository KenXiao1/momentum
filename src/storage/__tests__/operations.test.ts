import { afterEach, describe, expect, it, vi } from 'vitest';
import { localStorageAdapter as storage } from '../localStorageAdapter';
import { createUnitChain } from '../../test/factories';
import type { SessionCompletionInput } from '../operations';
import { STORAGE_KEYS } from '../../utils/storage/keys';
import { withOperationLock } from '../../utils/storage/operationJournal';

async function sessionInput(): Promise<SessionCompletionInput> {
  const chain = createUnitChain({ currentStreak: 2, totalCompletions: 5 });
  await storage.saveChains([chain]);
  const session = {
    chainId: chain.id,
    startedAt: new Date('2026-09-20T10:00:00Z'),
    duration: 5,
    isPaused: false,
    totalPausedTime: 0,
  };
  await storage.saveActiveSession(session);
  return {
    operationId: 'session:one',
    session,
    sessionId: null,
    expectedChains: await storage.getChains(),
    chains: [{ ...chain, currentStreak: 3, totalCompletions: 6 }],
    record: {
      chainId: chain.id,
      completedAt: new Date('2026-09-20T10:05:00Z'),
      duration: 5,
      wasSuccessful: true,
    },
  };
}

describe('durable local operations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('waits for an ongoing write before a read can recover or expose data', async () => {
    const chain = createUnitChain({ name: 'Before' });
    await storage.saveChains([chain]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer = withOperationLock('local-data', async () => {
      await gate;
      localStorage.setItem(
        STORAGE_KEYS.CHAINS,
        JSON.stringify([{ ...chain, name: 'After' }]),
      );
    });
    const reader = storage.getChains();
    release();
    await writer;
    expect((await reader)[0].name).toBe('After');
  });

  it('commits chain, history, session and receipt once under concurrent duplicate submission', async () => {
    const input = await sessionInput();
    await Promise.all([
      storage.commitSessionCompletion(input),
      storage.commitSessionCompletion(input),
    ]);
    expect(await storage.getActiveSession()).toBeNull();
    expect(await storage.getCompletionHistory()).toHaveLength(1);
    expect((await storage.getChains())[0].totalCompletions).toBe(6);
    await storage.commitSessionCompletion(input);
    expect(await storage.getCompletionHistory()).toHaveLength(1);
  });

  it('recovers a partial local write before exposing any data and reuses its original receipt', async () => {
    const input = await sessionInput();
    const original = Storage.prototype.setItem;
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key, value) {
        if (key === STORAGE_KEYS.COMPLETION_HISTORY)
          throw new Error('disk temporarily unavailable');
        original.call(this, key, value);
      });
    await expect(storage.commitSessionCompletion(input)).rejects.toThrow(
      'disk temporarily',
    );
    expect(localStorage.getItem('momentum_operation_journal')).not.toBeNull();
    await expect(storage.getChains()).rejects.toThrow('disk temporarily');
    write.mockRestore();
    // A new adapter read after a restart completes the saved operation first.
    expect((await storage.getChains())[0].currentStreak).toBe(3);
    await storage.commitSessionCompletion({
      ...input,
      record: { ...input.record, completedAt: new Date() },
    });
    const history = await storage.getCompletionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].completedAt).toEqual(input.record.completedAt);
    expect(localStorage.getItem('momentum_operation_journal')).toBeNull();
  });

  it('does not write application data when the journal itself cannot be saved', async () => {
    const input = await sessionInput();
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === 'momentum_operation_journal')
        throw new Error('quota exceeded');
      original.call(this, key, value);
    });
    await expect(storage.commitSessionCompletion(input)).rejects.toThrow(
      'quota',
    );
    expect((await storage.getChains())[0].currentStreak).toBe(2);
    expect(await storage.getCompletionHistory()).toEqual([]);
    expect(await storage.getActiveSession()).toMatchObject(input.session);
  });

  it('cannot revive a completed session by pausing after recovery, and permits a new session', async () => {
    const input = await sessionInput();
    const original = Storage.prototype.setItem;
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key, value) {
        if (key === STORAGE_KEYS.COMPLETION_HISTORY)
          throw new Error('interrupted');
        original.call(this, key, value);
      });
    await expect(storage.commitSessionCompletion(input)).rejects.toThrow(
      'interrupted',
    );
    write.mockRestore();
    await expect(
      storage.saveActiveSession({
        ...input.session,
        isPaused: true,
        pausedAt: new Date(),
      }),
    ).rejects.toThrow('already completed');
    expect(await storage.getActiveSession()).toBeNull();
    await storage.commitSessionCompletion(input);
    expect(await storage.getCompletionHistory()).toHaveLength(1);
    const next = {
      ...input.session,
      startedAt: new Date('2026-09-20T11:00:00Z'),
    };
    await storage.saveActiveSession(next);
    expect(await storage.getActiveSession()).toMatchObject(next);
  });

  it('rejects an outdated completion before overwriting newer chain data', async () => {
    const input = await sessionInput();
    await storage.saveChains([
      { ...input.expectedChains[0], name: 'Changed elsewhere' },
    ]);
    await expect(storage.commitSessionCompletion(input)).rejects.toThrow(
      'changed',
    );
    expect((await storage.getChains())[0].name).toBe('Changed elsewhere');
    expect(await storage.getCompletionHistory()).toEqual([]);
  });

  it('imports all slices once and preserves Date values after retry', async () => {
    const chain = createUnitChain();
    const data = {
      chains: [chain],
      history: [
        {
          chainId: chain.id,
          completedAt: new Date(),
          duration: 3,
          wasSuccessful: true,
        },
      ],
      rsipNodes: [
        {
          id: 'policy',
          title: 'One',
          rule: 'Read',
          sortOrder: 1,
          createdAt: new Date(),
        },
      ],
      rsipMeta: { currentRunNumber: 2 },
    };
    await storage.importData(data);
    await storage.importData(data);
    expect(await storage.getChains()).toHaveLength(1);
    expect(await storage.getCompletionHistory()).toHaveLength(1);
    expect((await storage.getRSIPNodes())[0].createdAt).toEqual(
      data.rsipNodes[0].createdAt,
    );
    expect(await storage.getRSIPMeta()).toMatchObject({ currentRunNumber: 2 });
  });

  it('rejects duplicate relations without partially importing chains', async () => {
    await storage.saveRSIPNodes([
      {
        id: 'existing',
        title: 'Kept',
        rule: 'Keep',
        sortOrder: 1,
        createdAt: new Date(),
      },
    ]);
    await expect(
      storage.importData({
        chains: [createUnitChain()],
        rsipNodes: [
          {
            id: 'existing',
            title: 'Bad replacement',
            rule: 'Bad',
            sortOrder: 2,
            createdAt: new Date(),
          },
        ],
      }),
    ).rejects.toThrow('conflicting');
    expect(await storage.getChains()).toEqual([]);
    expect((await storage.getRSIPNodes())[0].title).toBe('Kept');
  });
});

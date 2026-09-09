import { beforeEach, describe, expect, it } from 'vitest';
import type { CompletionHistory, ScheduledSession } from '../../../../types';
import { createUnitChain } from '../../../../test/factories/chainFactory';
import { supabase } from '../../../../lib/supabase';
import {
  failSupabaseTransportRequests,
  resetSupabaseMockState,
} from '../../../../test/mocks/supabaseMocks';
import { SupabaseStorage } from '../SupabaseStorage';

const storage = new SupabaseStorage();

async function authenticate(): Promise<void> {
  if (!supabase) throw new Error('Supabase integration client was not created');
  const { error } = await supabase.auth.signInWithPassword({
    email: 'test@momentum.app',
    password: 'integration-password',
  });
  expect(error).toBeNull();
}

function scheduledSession(
  chainId: string,
  signal = 'put-on-headphones',
): ScheduledSession {
  return {
    chainId,
    scheduledAt: new Date('2026-04-01T08:00:00.000Z'),
    expiresAt: new Date('2026-04-01T09:00:00.000Z'),
    auxiliarySignal: signal,
  };
}

function historyRecord(
  chainId: string,
  completedAt: string,
): CompletionHistory {
  return {
    chainId,
    completedAt: new Date(completedAt),
    duration: 45,
    actualDuration: 42,
    wasSuccessful: true,
    isForwardTimed: false,
    description: `completed-${chainId}`,
  };
}

describe('SupabaseStorage HTTP boundary', () => {
  beforeEach(async () => {
    if (supabase) await supabase.auth.signOut({ scope: 'local' });
    localStorage.clear();
    resetSupabaseMockState();
    storage.clearCache();
  });

  it('uses independent native localStorage and sessionStorage instances', () => {
    localStorage.setItem('storage-boundary', '');
    expect(localStorage.getItem('storage-boundary')).toBe('');
    expect(sessionStorage.getItem('storage-boundary')).toBeNull();

    sessionStorage.setItem('storage-boundary', 'session');
    expect(localStorage.getItem('storage-boundary')).toBe('');
    expect(sessionStorage.getItem('storage-boundary')).toBe('session');
  });

  it('runs unauthenticated reads and failures through production auth logic', async () => {
    await expect(storage.getChains()).resolves.toEqual([]);
    await expect(storage.softDeleteChain('missing')).rejects.toThrow(
      'User not authenticated',
    );
  });

  it('round-trips chain rows through the SDK, mapper, and Date hydration', async () => {
    await authenticate();
    const alpha = createUnitChain({
      id: 'chain-alpha',
      name: 'Alpha',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    const beta = createUnitChain({
      id: 'chain-beta',
      name: 'Beta',
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
    });

    await storage.saveChains([alpha, beta]);
    const loaded = await storage.getChains();

    expect(loaded.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'chain-beta', name: 'Beta' },
      { id: 'chain-alpha', name: 'Alpha' },
    ]);
    expect(loaded.every((chain) => chain.createdAt instanceof Date)).toBe(true);
    expect(loaded.find((chain) => chain.id === alpha.id)?.createdAt).toEqual(
      alpha.createdAt,
    );
  });

  it('upserts idempotently and saveChains removes rows absent from replacement', async () => {
    await authenticate();
    await storage.saveChains([
      createUnitChain({ id: 'keep', name: 'Before' }),
      createUnitChain({ id: 'remove' }),
    ]);

    await storage.upsertChain(createUnitChain({ id: 'keep', name: 'After' }));
    await storage.upsertChain(createUnitChain({ id: 'keep', name: 'Final' }));
    await storage.saveChains([createUnitChain({ id: 'keep', name: 'Final' })]);

    const loaded = await storage.getChains();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ id: 'keep', name: 'Final' });
  });

  it('soft-deletes, restores, and permanently deletes only the target chain', async () => {
    await authenticate();
    await storage.saveChains([
      createUnitChain({ id: 'target' }),
      createUnitChain({ id: 'other' }),
    ]);

    await storage.softDeleteChain('target');
    expect((await storage.getActiveChains()).map((chain) => chain.id)).toEqual([
      'other',
    ]);
    const deleted = await storage.getDeletedChains();
    expect(deleted.map((chain) => chain.id)).toEqual(['target']);
    expect(deleted[0].deletedAt).toBeInstanceOf(Date);

    await storage.restoreChain('target');
    expect(await storage.getDeletedChains()).toEqual([]);
    expect(
      (await storage.getActiveChains()).map((chain) => chain.id).sort(),
    ).toEqual(['other', 'target']);

    await storage.softDeleteChain('target');
    await storage.permanentlyDeleteChain('target');
    expect((await storage.getChains()).map((chain) => chain.id)).toEqual([
      'other',
    ]);
  });

  it('sets, updates, removes, and replaces scheduled sessions with hydrated dates', async () => {
    await authenticate();
    await storage.setScheduledSession(scheduledSession('first'));
    await storage.setScheduledSession(scheduledSession('first', 'ring-bell'));
    await storage.setScheduledSession(scheduledSession('second'));

    let loaded = await storage.getScheduledSessions();
    expect(loaded).toHaveLength(2);
    expect(loaded.find((session) => session.chainId === 'first')).toMatchObject(
      {
        auxiliarySignal: 'ring-bell',
      },
    );
    expect(loaded.every((session) => session.scheduledAt instanceof Date)).toBe(
      true,
    );

    await storage.removeScheduledSession('first');
    expect(
      (await storage.getScheduledSessions()).map((s) => s.chainId),
    ).toEqual(['second']);

    await storage.saveScheduledSessions([scheduledSession('replacement')]);
    loaded = await storage.getScheduledSessions();
    expect(loaded.map((session) => session.chainId)).toEqual(['replacement']);
    expect(loaded[0].expiresAt).toEqual(new Date('2026-04-01T09:00:00.000Z'));
  });

  it('appends history in query order and saveCompletionHistory replaces it', async () => {
    await authenticate();
    await storage.appendCompletionHistory(
      historyRecord('older', '2026-04-01T10:00:00.000Z'),
    );
    await storage.appendCompletionHistory(
      historyRecord('newer', '2026-04-02T10:00:00.000Z'),
    );

    let loaded = await storage.getCompletionHistory();
    expect(loaded.map((record) => record.chainId)).toEqual(['newer', 'older']);
    expect(loaded.every((record) => record.completedAt instanceof Date)).toBe(
      true,
    );
    expect(loaded[0]).toMatchObject({
      actualDuration: 42,
      isForwardTimed: false,
    });

    await storage.saveCompletionHistory([
      historyRecord('replacement', '2026-04-03T10:00:00.000Z'),
    ]);
    loaded = await storage.getCompletionHistory();
    expect(loaded.map((record) => record.chainId)).toEqual(['replacement']);
  });

  it('propagates a network transport failure from the write boundary', async () => {
    await authenticate();
    failSupabaseTransportRequests('GET', 'chains');

    await expect(
      storage.saveChains([createUnitChain({ id: 'unwritten' })]),
    ).rejects.toThrow('Failed to query existing chains');
    await expect(storage.getChains()).resolves.toEqual([]);
  });
  it('B06 round-trips group tolerance usage and preserves existing groups when an update fails', async () => {
    await authenticate();
    const group = {
      id: 'group-a',
      title: 'Group A',
      faultTolerance: 1,
      createdAt: new Date('2026-09-06T12:00:00Z'),
    };
    const other = { ...group, id: 'group-b', title: 'Group B' };
    await storage.saveRSIPGroups([group, other]);
    await storage.saveRSIPGroups([{ ...group, faultToleranceUsed: 1 }, other]);
    expect(await storage.getRSIPGroups()).toEqual([
      { ...group, faultToleranceUsed: 1 },
      { ...other, faultToleranceUsed: 0 },
    ]);
    failSupabaseTransportRequests('POST', 'rsip_groups', 10);
    await expect(
      storage.saveRSIPGroups([{ ...group, faultToleranceUsed: 2 }]),
    ).rejects.toThrow();
    expect(await storage.getRSIPGroups()).toHaveLength(2);
    await storage.saveRSIPGroups([]);
    expect(await storage.getRSIPGroups()).toEqual([]);
  });
});

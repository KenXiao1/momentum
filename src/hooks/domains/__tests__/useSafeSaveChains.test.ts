import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestStorage, createUnitChain } from '../../../test/factories';
import { useSafeSaveChains } from '../useSafeSaveChains';

const DELETED_AT = new Date('2026-02-01T10:00:00.000Z');

function failingSaves(errors: Error[]) {
  const storage = createTestStorage();
  const upsert = storage.upsertChains;
  const upsertChains = vi.fn(async (chains) => {
    const error = errors.shift();
    if (error) throw error;
    await upsert(chains);
  });
  return { storage: { ...storage, upsertChains }, upsertChains };
}

async function savedIds(
  storage: ReturnType<typeof createTestStorage>,
): Promise<string[]> {
  return (await storage.getChains()).map((chain) => chain.id).sort();
}

describe('useSafeSaveChains', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('upserts the given chains and never deletes chains it was not given', async () => {
    const storage = createTestStorage();
    await storage.saveChains([
      createUnitChain({ id: 'not-in-memory', name: 'Stored elsewhere' }),
      createUnitChain({ id: 'edited', name: 'Before' }),
      createUnitChain({ id: 'binned', deletedAt: DELETED_AT }),
    ]);
    const { result } = renderHook(() => useSafeSaveChains(storage));

    // An incomplete in-memory list (e.g. stale state) must not delete rows.
    await result.current([
      createUnitChain({ id: 'edited', name: 'After' }),
      createUnitChain({ id: 'created' }),
    ]);

    expect(await savedIds(storage)).toEqual([
      'binned',
      'created',
      'edited',
      'not-in-memory',
    ]);
    const byId = new Map(
      (await storage.getChains()).map((chain) => [chain.id, chain]),
    );
    expect(byId.get('edited')?.name).toBe('After');
    expect(byId.get('not-in-memory')?.name).toBe('Stored elsewhere');
    const binned = (await storage.getDeletedChains())[0];
    expect(binned.deletedAt).toEqual(DELETED_AT);
  });

  it('fails at once on an error that retrying cannot fix', async () => {
    const { storage, upsertChains } = failingSaves([
      new Error('Converting circular structure to JSON'),
    ]);
    const { result } = renderHook(() => useSafeSaveChains(storage));

    await expect(
      result.current([createUnitChain({ id: 'chain' })]),
    ).rejects.toThrow('Converting circular structure to JSON');
    expect(upsertChains).toHaveBeenCalledTimes(1);
    expect(await savedIds(storage)).toEqual([]);
  });

  it('retries a transient failure after one second and then saves', async () => {
    vi.useFakeTimers();
    const { storage } = failingSaves([new Error('temporary network issue')]);
    const { result } = renderHook(() => useSafeSaveChains(storage));

    const saving = result.current([createUnitChain({ id: 'chain' })]);
    await vi.advanceTimersByTimeAsync(999);
    expect(await savedIds(storage)).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await saving;

    expect(await savedIds(storage)).toEqual(['chain']);
  });

  it('gives up after three retries spaced 1s, 2s and 4s apart', async () => {
    vi.useFakeTimers();
    const failure = new Error('persistent failure');
    const { storage, upsertChains } = failingSaves(Array(4).fill(failure));
    const { result } = renderHook(() => useSafeSaveChains(storage));

    const saving = result.current([createUnitChain({ id: 'chain' })]);
    const rejection = expect(saving).rejects.toThrow('persistent failure');
    await vi.advanceTimersByTimeAsync(6999);
    expect(upsertChains).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;

    expect(upsertChains).toHaveBeenCalledTimes(4);
    expect(await savedIds(storage)).toEqual([]);
  });
});

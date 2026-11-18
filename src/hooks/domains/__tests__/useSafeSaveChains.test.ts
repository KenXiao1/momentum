import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestStorage, createUnitChain } from '../../../test/factories';
import { useSafeSaveChains } from '../useSafeSaveChains';

const DELETED_AT = new Date('2026-02-01T10:00:00.000Z');

function failingSaves(errors: Error[]) {
  const storage = createTestStorage();
  const save = storage.saveChains;
  const saveChains = vi.fn(async (chains) => {
    const error = errors.shift();
    if (error) throw error;
    await save(chains);
  });
  return { storage: { ...storage, saveChains }, saveChains };
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

  it('saves the active chains and keeps chains already in the recycle bin', async () => {
    const storage = createTestStorage();
    await storage.saveChains([
      createUnitChain({ id: 'stale-active' }),
      createUnitChain({ id: 'binned', deletedAt: DELETED_AT }),
    ]);
    const { result } = renderHook(() => useSafeSaveChains(storage));

    await result.current([createUnitChain({ id: 'active' })]);

    expect(await savedIds(storage)).toEqual(['active', 'binned']);
    const binned = (await storage.getDeletedChains())[0];
    expect(binned.deletedAt).toEqual(DELETED_AT);
  });

  it('fails at once on an error that retrying cannot fix', async () => {
    const { storage, saveChains } = failingSaves([
      new Error('Converting circular structure to JSON'),
    ]);
    const { result } = renderHook(() => useSafeSaveChains(storage));

    await expect(
      result.current([createUnitChain({ id: 'chain' })]),
    ).rejects.toThrow('Converting circular structure to JSON');
    expect(saveChains).toHaveBeenCalledTimes(1);
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
    const { storage, saveChains } = failingSaves(Array(4).fill(failure));
    const { result } = renderHook(() => useSafeSaveChains(storage));

    const saving = result.current([createUnitChain({ id: 'chain' })]);
    const rejection = expect(saving).rejects.toThrow('persistent failure');
    await vi.advanceTimersByTimeAsync(6999);
    expect(saveChains).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;

    expect(saveChains).toHaveBeenCalledTimes(4);
    expect(await savedIds(storage)).toEqual([]);
  });
});

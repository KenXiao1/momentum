import { describe, expect, it } from 'vitest';
import { createTestStorage, createUnitChain } from '../../test/factories';
import {
  PartialRestoreError,
  permanentlyDeleteChains,
  restoreChains,
  softDeleteChain,
  upsertChains,
} from '../chainOperations';

const ids = (chains: { id: string }[]) =>
  chains.map((chain) => chain.id).sort();

async function storageWith(...chainIds: string[]) {
  const storage = createTestStorage();
  await storage.upsertChains(chainIds.map((id) => createUnitChain({ id })));
  return storage;
}

describe('chainOperations', () => {
  it('upserts without deleting chains missing from the list', async () => {
    const storage = await storageWith('a', 'b');

    const chains = await upsertChains(storage, [createUnitChain({ id: 'c' })]);

    expect(ids(chains)).toEqual(['a', 'b', 'c']);
  });

  it('moves a chain to the recycle bin and returns the active chains', async () => {
    const storage = await storageWith('a', 'b');

    const chains = await softDeleteChain(storage, 'a');

    expect(ids(chains)).toEqual(['b']);
    expect(ids(await storage.getDeletedChains())).toEqual(['a']);
  });

  it('restores chains from the recycle bin', async () => {
    const storage = await storageWith('a', 'b');
    await storage.softDeleteChain('a');
    await storage.softDeleteChain('b');

    expect(ids(await restoreChains(storage, ['a', 'b']))).toEqual(['a', 'b']);
  });

  it('reports which chains failed when only some restores succeed', async () => {
    const storage = await storageWith('a', 'b');
    await storage.softDeleteChain('a');
    await storage.softDeleteChain('b');
    const failing = {
      ...storage,
      restoreChain: async (chainId: string) => {
        if (chainId === 'b') throw new Error('locked');
        return storage.restoreChain(chainId);
      },
    };

    const failure = await restoreChains(failing, ['a', 'b']).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(PartialRestoreError);
    expect((failure as PartialRestoreError).failedChainIds).toEqual(['b']);
    expect(ids((failure as PartialRestoreError).chains)).toEqual(['a']);
  });

  it('rejects with a plain error when every restore fails', async () => {
    const storage = await storageWith('a');
    const failing = {
      ...storage,
      restoreChain: async () => {
        throw new Error('offline');
      },
    };

    const failure = await restoreChains(failing, ['a']).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(PartialRestoreError);
    expect((failure as Error).message).toContain('offline');
  });

  it('permanently deletes chains', async () => {
    const storage = await storageWith('a', 'b');
    await storage.softDeleteChain('a');

    const chains = await permanentlyDeleteChains(storage, ['a']);

    expect(ids(chains)).toEqual(['b']);
    expect(await storage.getDeletedChains()).toEqual([]);
  });
});

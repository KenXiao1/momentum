import type { MomentumStorage } from '../storage/MomentumStorage';
import type { Chain } from '../types';
import { logger } from '../utils/logger';

/**
 * Some, but not all, chains in a restore request failed. `chains` is the
 * active list read after the attempt, so callers can show what succeeded.
 */
export class PartialRestoreError extends Error {
  readonly failedChainIds: string[];
  readonly chains: Chain[];

  constructor(failures: { id: string; error: string }[], chains: Chain[]) {
    super(
      `Partial restore failure: ${failures.map((item) => item.error).join('; ')}`,
    );
    this.name = 'PartialRestoreError';
    this.failedChainIds = failures.map((item) => item.id);
    this.chains = chains;
  }
}

/** Moves a chain to the recycle bin and returns the remaining active chains. */
export async function softDeleteChain(
  storage: MomentumStorage,
  chainId: string,
): Promise<Chain[]> {
  await storage.softDeleteChain(chainId);
  return storage.getActiveChains();
}

/**
 * Restores each chain and returns the active chains afterwards. Throws a
 * `PartialRestoreError` when only some fail, and a plain error when all fail.
 */
export async function restoreChains(
  storage: MomentumStorage,
  chainIds: string[],
): Promise<Chain[]> {
  const failed: { id: string; error: string }[] = [];

  for (const chainId of chainIds) {
    try {
      await storage.restoreChain(chainId);
    } catch (error) {
      failed.push({
        id: chainId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const chains = await storage.getActiveChains();
  if (failed.length === 0) return chains;

  logger.warn('CHAIN_OPERATIONS', 'Restore failures', {
    failed: failed.length,
    total: chainIds.length,
    failures: failed,
  });
  if (failed.length === chainIds.length)
    throw new Error(
      `All restore operations failed: ${failed.map((item) => item.error).join('; ')}`,
    );
  throw new PartialRestoreError(failed, chains);
}

/** Permanently deletes the chains and returns the active chains afterwards. */
export async function permanentlyDeleteChains(
  storage: MomentumStorage,
  chainIds: string[],
): Promise<Chain[]> {
  for (const chainId of chainIds) {
    await storage.permanentlyDeleteChain(chainId);
  }
  return storage.getActiveChains();
}

/**
 * Upserts, never replaces: a stale or partial in-memory list must not be able
 * to delete chains. Deletion goes through the recycle-bin operations above.
 */
export async function upsertChains(
  storage: MomentumStorage,
  chains: Chain[],
): Promise<Chain[]> {
  await storage.upsertChains(chains);
  return storage.getActiveChains();
}

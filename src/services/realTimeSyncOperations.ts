import type { MomentumStorage } from '../storage/MomentumStorage';
import type { Chain } from '../types';
import { logger } from '../utils/logger';

type SyncChains = (
  operation: 'update' | 'delete' | 'restore',
  chains: Chain[],
) => Promise<void>;

async function loadAndSyncChains(
  storage: MomentumStorage,
  operation: 'update' | 'delete' | 'restore',
  sync: SyncChains,
): Promise<Chain[]> {
  const freshChains = await storage.getActiveChains();
  await sync(operation, freshChains);
  return freshChains;
}

export async function deleteChainWithSync(
  storage: MomentumStorage,
  chainId: string,
  sync: SyncChains,
): Promise<Chain[]> {
  logger.info('REALTIME_SYNC', 'Starting delete operation', { chainId });
  await storage.softDeleteChain(chainId);
  return loadAndSyncChains(storage, 'delete', sync);
}

export async function restoreChainsWithSync(
  storage: MomentumStorage,
  chainIds: string[],
  sync: SyncChains,
): Promise<Chain[]> {
  logger.info('REALTIME_SYNC', 'Starting restore operation', { chainIds });
  const failed: { id: string; error: string }[] = [];

  for (const chainId of chainIds) {
    try {
      logger.debug('REALTIME_SYNC', 'Restoring chain', { chainId });
      await storage.restoreChain(chainId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      failed.push({ id: chainId, error: errorMessage });
      logger.warn('REALTIME_SYNC', 'Failed to restore chain', {
        chainId,
        errorMessage,
      });
    }
  }

  const freshChains = await loadAndSyncChains(storage, 'restore', sync);
  logger.info('REALTIME_SYNC', 'Restore operation completed', {
    total: chainIds.length,
    successful: chainIds.length - failed.length,
    failed: failed.length,
    failures: failed,
  });

  if (failed.length === chainIds.length) {
    throw new Error(
      `All restore operations failed: ${failed.map((item) => item.error).join('; ')}`,
    );
  }
  if (failed.length > 0) {
    logger.warn('REALTIME_SYNC', 'Partial restore failure', {
      failedCount: failed.length,
      total: chainIds.length,
      failures: failed,
    });
    throw new Error(
      `Partial restore failure: ${failed.map((item) => item.error).join('; ')}`,
    );
  }
  return freshChains;
}

export async function permanentlyDeleteChainsWithSync(
  storage: MomentumStorage,
  chainIds: string[],
  sync: SyncChains,
): Promise<Chain[]> {
  logger.info('REALTIME_SYNC', 'Starting permanent delete operation', {
    chainIds,
  });
  for (const chainId of chainIds) {
    await storage.permanentlyDeleteChain(chainId);
  }
  return loadAndSyncChains(storage, 'delete', sync);
}

export async function saveChainsWithSync(
  storage: MomentumStorage,
  chains: Chain[],
  sync: SyncChains,
): Promise<Chain[]> {
  logger.debug('REALTIME_SYNC', 'Starting save operation', {
    chainCount: chains.length,
  });
  // Upsert, never replace: a stale or partial in-memory list must not be able
  // to delete chains. Deletion goes through softDelete/permanentlyDelete.
  await storage.upsertChains(chains);
  return loadAndSyncChains(storage, 'update', sync);
}

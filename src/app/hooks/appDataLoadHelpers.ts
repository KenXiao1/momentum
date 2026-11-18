import type { MomentumStorage } from '../../storage/MomentumStorage';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorMessage';

export async function cleanupExpiredDeletedChains(
  storage: MomentumStorage,
): Promise<void> {
  try {
    const cleanedCount = await storage.cleanupExpiredDeletedChains(30);
    if (cleanedCount > 0) {
      logger.info(
        'APP_SHELL',
        `Auto-cleaned ${cleanedCount} expired deleted chains`,
      );
    }
  } catch (error) {
    logger.warn('APP_SHELL', 'Auto cleanup failed', undefined, toError(error));
  }
}

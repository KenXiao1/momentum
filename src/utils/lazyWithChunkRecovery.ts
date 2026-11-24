import { toError } from './errorMessage';
import { attemptChunkLoadRecovery } from './chunkLoadRecovery';
import { logger } from './logger';

type LazyImport<TModule extends { default: unknown }> = () => Promise<TModule>;

export function lazyWithChunkRecovery<TModule extends { default: unknown }>(
  loader: LazyImport<TModule>,
  chunkName: string,
): LazyImport<TModule> {
  return () =>
    loader().catch((error: unknown) => {
      const recovered = attemptChunkLoadRecovery(error);
      logger.error(
        'LAZY_IMPORT',
        `Failed to load lazy chunk: ${chunkName}`,
        { recovered },
        toError(error),
      );
      throw error;
    });
}

/**
 * @module useSafeSaveChains
 * @description 安全保存链条数据的领域 Hook
 *
 * 职责：
 * - 提供带重试机制的链条保存函数（只 upsert，不会删除未列出的链条）
 *
 * 重试策略：
 * - 最多重试 3 次
 * - 指数退避：1s → 2s → 4s
 * - 重试前清理缓存
 *
 * @returns safelySaveChains - 安全保存函数，被其他 Domain Hooks 依赖
 */
import { useCallback } from 'react';
import type { Chain } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { upsertChains } from '../../services/chainOperations';
import { logger } from '../../utils/logger';
import { isDev } from '../../utils/env';

export function useSafeSaveChains(storage: MomentumStorage) {
  return useCallback(
    async function safelySaveChains(
      updatedActiveChains: Chain[],
      retryCount: number = 0,
    ): Promise<void> {
      const maxRetries = 3;
      try {
        if (isDev) {
          logger.debug('SAFE_SAVE', 'Starting safe save operation for chains', {
            attempt: retryCount + 1,
          });
        }

        await upsertChains(storage, updatedActiveChains);

        if (isDev) {
          logger.debug(
            'SAFE_SAVE',
            'Safe save completed successfully with enhanced synchronization',
          );
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(
          'SAFE_SAVE',
          'Safe save failed',
          { attempt: retryCount + 1 },
          err,
        );

        const message = err.message.toLowerCase();
        const nonRetryableClientErrors = [
          'converting circular structure to json',
          'do not know how to serialize a bigint',
        ];
        if (
          nonRetryableClientErrors.some((fragment) =>
            message.includes(fragment),
          )
        ) {
          throw err;
        }

        if (retryCount < maxRetries) {
          const retryDelay = Math.pow(2, retryCount) * 1000;
          if (isDev) {
            logger.debug('SAFE_SAVE', 'Retrying safe save', {
              retryDelayMs: retryDelay,
              nextAttempt: retryCount + 2,
            });
          }

          storage.clearCache();

          return new Promise((resolve, reject) => {
            setTimeout(async () => {
              try {
                await safelySaveChains(updatedActiveChains, retryCount + 1);
                resolve();
              } catch (retryError) {
                reject(retryError);
              }
            }, retryDelay);
          });
        }

        throw error;
      }
    },
    [storage],
  );
}

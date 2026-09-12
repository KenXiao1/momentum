/**
 * @module useGroupDomain
 * @description 任务群（Group）管理的领域 Hook
 *
 * 职责：
 * - 导入单元到任务群（复制/移动模式）
 * - 更新任务重复次数设置
 * - 任务群内单元排序
 *
 * 任务群是一种容器类型的链条，包含多个子任务，
 * 支持循环执行和时间限制功能。
 *
 * @see src/types/index.ts - GroupChain, TaskGroupChain 类型定义
 * @see src/utils/chainTree.ts - 任务树构建工具
 */
import type { Dispatch, SetStateAction } from 'react';
import type { AppState, Chain } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import type { SafelySaveChains } from './useChainsDomain';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { buildChainTree } from '../../utils/chainTree';
import { useI18n } from '../../i18n';
import { resolveAppStateReader } from './appStateAccess';
import { getSafeErrorDetailFromUnknown } from '../../utils/errorMessage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';

interface UseGroupDomainParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;
}

export function useGroupDomain({
  state,
  getState,
  setState,
  storage,
  safelySaveChains,
}: UseGroupDomainParams) {
  const readState = resolveAppStateReader({ state, getState });
  const { language, tr } = useI18n();

  const handleChainsOperationError = async (
    error: unknown,
    {
      logMessage,
      toastPrefixZh,
      toastPrefixEn,
      toastFallbackZh,
      toastFallbackEn,
    }: {
      logMessage: string;
      toastPrefixZh: string;
      toastPrefixEn: string;
      toastFallbackZh: string;
      toastFallbackEn: string;
    },
  ) => {
    logger.error(
      'APP_SHELL',
      logMessage,
      undefined,
      normalizeUnknownError(error),
    );
    const safeDetail = getSafeErrorDetailFromUnknown(error, language);
    toast.error(
      safeDetail
        ? tr(
            `${toastPrefixZh}: ${safeDetail}\n\n请查看控制台了解详细信息，然后重试`,
            `${toastPrefixEn}: ${safeDetail}\n\nCheck the console for details, then try again.`,
          )
        : tr(toastFallbackZh, toastFallbackEn),
    );

    try {
      const currentChains = await storage.getChains();
      setState((prev) => ({
        ...prev,
        chains: currentChains,
      }));
    } catch (reloadError) {
      logger.error(
        'APP_SHELL',
        '重新加载数据也失败了',
        undefined,
        normalizeUnknownError(reloadError),
      );
    }
  };

  const handleImportUnits = async (
    unitIds: string[],
    groupId: string,
    mode: 'move' | 'copy' = 'copy',
  ) => {
    logger.info('APP_SHELL', '开始导入单元到任务群', {
      unitIds,
      groupId,
      mode,
    });

    try {
      let updatedChains: Chain[];

      if (mode === 'copy') {
        // 复制模式：创建副本并加入任务群，原单元保持独立
        const copiesToAdd: Chain[] = [];

        readState().chains.forEach((chain) => {
          if (unitIds.includes(chain.id)) {
            const copy: Chain = {
              ...chain,
              id: crypto.randomUUID(), // 生成新的ID
              name: `${chain.name} ${tr('(副本)', '(Copy)')}`, // 添加副本标识
              parentId: groupId,
              currentStreak: 0, // 重置记录
              auxiliaryStreak: 0,
              totalCompletions: 0,
              totalFailures: 0,
              auxiliaryFailures: 0,
              createdAt: new Date(),
              lastCompletedAt: undefined,
            };
            copiesToAdd.push(copy);
          }
        });

        updatedChains = [...readState().chains, ...copiesToAdd];
      } else {
        // 移动模式：更新选中单元的 parentId 为目标任务群的 ID
        updatedChains = readState().chains.map((chain) => {
          if (unitIds.includes(chain.id)) {
            return { ...chain, parentId: groupId };
          }
          return chain;
        });
      }

      logger.debug('APP_SHELL', '准备保存导入后的数据到存储');
      await safelySaveChains(updatedChains);
      logger.info('APP_SHELL', '导入数据保存成功，更新UI状态');

      setState((prev) => ({
        ...prev,
        chains: updatedChains,
      }));
      logger.info('APP_SHELL', '导入完成，UI状态更新完成');
    } catch (error) {
      await handleChainsOperationError(error, {
        logMessage: 'Failed to import units',
        toastPrefixZh: '导入失败',
        toastPrefixEn: 'Import failed',
        toastFallbackZh: '导入失败，请重试（详情见控制台）',
        toastFallbackEn:
          'Import failed. Check the console for details, then try again.',
      });
    }
  };

  const handleUpdateTaskRepeatCount = async (
    chainId: string,
    repeatCount: number,
  ) => {
    logger.debug('APP_SHELL', '开始更新任务重复次数', { chainId, repeatCount });

    try {
      const updatedChains = readState().chains.map((chain) => {
        if (chain.id === chainId) {
          return { ...chain, taskRepeatCount: repeatCount };
        }
        return chain;
      });

      logger.debug('APP_SHELL', '准备保存重复次数更新到存储');
      await safelySaveChains(updatedChains);
      logger.info('APP_SHELL', '重复次数更新保存成功，更新UI状态');

      setState((prev) => ({
        ...prev,
        chains: updatedChains,
      }));
      logger.info('APP_SHELL', '重复次数更新完成，UI状态更新完成');
    } catch (error) {
      await handleChainsOperationError(error, {
        logMessage: 'Failed to update task repeat count',
        toastPrefixZh: '重复次数更新失败',
        toastPrefixEn: 'Failed to update repeat count',
        toastFallbackZh: '重复次数更新失败，请重试（详情见控制台）',
        toastFallbackEn:
          'Failed to update repeat count. Check the console for details, then try again.',
      });
    }
  };

  const handleReorderUnit = async (
    groupId: string,
    unitId: string,
    direction: 'up' | 'down',
  ) => {
    const chainTree = buildChainTree(readState().chains);
    const groupNode = chainTree.find((node) => node.id === groupId);
    if (!groupNode) return;

    const idx = groupNode.children.findIndex((child) => child.id === unitId);
    if (idx < 0) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= groupNode.children.length) return;

    const a = groupNode.children[idx];
    const b = groupNode.children[targetIdx];
    const updated = readState().chains.map((ch) => {
      if (ch.id === a.id) return { ...ch, sortOrder: b.sortOrder };
      if (ch.id === b.id) return { ...ch, sortOrder: a.sortOrder };
      return ch;
    });

    await safelySaveChains(updated);
    setState((prev) => ({
      ...prev,
      chains: updated,
    }));
  };

  return { handleImportUnits, handleUpdateTaskRepeatCount, handleReorderUnit };
}

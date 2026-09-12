/**
 * @module useRulesDomain
 * @description 辅助链例外规则判定的领域 Hook
 *
 * 职责：
 * - 处理辅助链（预约）失败判定
 * - 处理辅助链例外规则添加
 * - 更新辅助链连胜/失败计数
 *
 * 注意：此 Hook 处理的是辅助链的例外规则，
 * 主任务的例外规则由 ExceptionRuleManager 服务处理。
 *
 * @see docs/features/DOMAIN_RULES.md - 例外规则系统文档
 * @see src/services/ExceptionRuleManager.ts - 主任务例外规则管理
 */
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import type { SafelySaveChains } from './useChainsDomain';
import { resolveAppStateReader } from './appStateAccess';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorMessage';

interface UseRulesDomainParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;
  setShowAuxiliaryJudgment: (chainId: string | null) => void;
}

export function useRulesDomain({
  state,
  getState,
  setState,
  storage,
  safelySaveChains,
  setShowAuxiliaryJudgment,
}: UseRulesDomainParams) {
  const readState = resolveAppStateReader({ state, getState });
  const persistChains = (
    chainId: string,
    updatedChains: AppState['chains'],
    context: string,
  ) => {
    safelySaveChains(updatedChains).catch((error) => {
      logger.error('RULES_DOMAIN', context, { chainId }, toError(error));
    });
  };

  const removeScheduledSession = (chainId: string, context: string) => {
    storage.removeScheduledSession(chainId).catch((error) => {
      logger.error('RULES_DOMAIN', context, { chainId }, toError(error));
    });
  };

  const handleAuxiliaryJudgmentFailure = (chainId: string) => {
    const currentState = readState();
    const updatedScheduledSessions = currentState.scheduledSessions.filter(
      (session) => session.chainId !== chainId,
    );
    const updatedChains = currentState.chains.map((chain) =>
      chain.id === chainId
        ? {
            ...chain,
            auxiliaryStreak: 0,
            auxiliaryFailures: chain.auxiliaryFailures + 1,
          }
        : chain,
    );

    persistChains(
      chainId,
      updatedChains,
      'Failed to persist chains after failure judgment',
    );
    removeScheduledSession(
      chainId,
      'Failed to persist scheduled sessions after failure judgment',
    );

    setState((prev) => ({
      ...prev,
      chains: updatedChains,
      scheduledSessions: updatedScheduledSessions,
    }));
    setShowAuxiliaryJudgment(null);
  };

  const handleAuxiliaryJudgmentAllow = (
    chainId: string,
    exceptionRule: string,
  ) => {
    const currentState = readState();
    const updatedScheduledSessions = currentState.scheduledSessions.filter(
      (session) => session.chainId !== chainId,
    );
    const updatedChains = currentState.chains.map((chain) =>
      chain.id === chainId
        ? {
            ...chain,
            auxiliaryExceptions: [
              ...(chain.auxiliaryExceptions || []),
              exceptionRule,
            ],
          }
        : chain,
    );

    persistChains(
      chainId,
      updatedChains,
      'Failed to persist chains after allow judgment',
    );
    removeScheduledSession(
      chainId,
      'Failed to persist scheduled sessions after allow judgment',
    );

    setState((prev) => ({
      ...prev,
      chains: updatedChains,
      scheduledSessions: updatedScheduledSessions,
    }));
    setShowAuxiliaryJudgment(null);
  };

  return { handleAuxiliaryJudgmentFailure, handleAuxiliaryJudgmentAllow };
}

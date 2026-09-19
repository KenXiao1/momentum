import { useCallback, useState } from 'react';
import type { ExceptionRule } from '../../types';
import { ExceptionRuleType } from '../../types';
import { exceptionRuleManager } from '../../services/ExceptionRuleManager';
import { getSafeErrorDetailFromUnknown } from '../../utils/errorMessage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import { logger } from '../../utils/logger';
import type { Language } from '../../i18n';

export type RuleActionType = 'pause' | 'early_completion';

export function useRuleSelectionRules(params: {
  chainId: string;
  actionType: RuleActionType;
  language: Language;
  tr: (zh: string, en: string) => string;
}) {
  const { actionType, chainId, language, tr } = params;
  const [rules, setRules] = useState<ExceptionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDefaultRules = useCallback(async () => {
    const names =
      actionType === 'pause'
        ? ['Bathroom break', 'Phone call']
        : ['Reached goal early'];
    const type =
      actionType === 'pause'
        ? ExceptionRuleType.PAUSE_ONLY
        : ExceptionRuleType.EARLY_COMPLETION_ONLY;
    const allRules = await exceptionRuleManager.getAllRules();
    const chainRules = allRules.filter(
      (rule) => rule.chainId === chainId && rule.scope === 'chain',
    );
    const created: ExceptionRule[] = [];
    for (const name of names) {
      try {
        const existing = chainRules.find(
          (rule) => rule.isActive && rule.name === name,
        );
        created.push(
          existing ??
            (await exceptionRuleManager.createChainRule(chainId, name, type))
              .rule,
        );
      } catch (error) {
        logger.warn(
          'RULE_SELECTION',
          `Failed to create default rule "${name}"`,
          { chainId, actionType },
          normalizeUnknownError(error),
        );
      }
    }
    return created;
  }, [actionType, chainId]);

  const fetchRules = useCallback(async () => {
    try {
      const allRules = await exceptionRuleManager.getAllRules();
      const applicable = allRules.filter((rule) => {
        if (
          !rule.isActive ||
          rule.chainId !== chainId ||
          rule.scope !== 'chain'
        )
          return false;
        return actionType === 'pause'
          ? rule.type === ExceptionRuleType.PAUSE_ONLY
          : rule.type === ExceptionRuleType.EARLY_COMPLETION_ONLY;
      });
      return applicable.length > 0 ? applicable : createDefaultRules();
    } catch (error) {
      logger.error(
        'RULE_SELECTION',
        '获取规则失败',
        { chainId, actionType },
        normalizeUnknownError(error),
      );
      return createDefaultRules();
    }
  }, [actionType, chainId, createDefaultRules]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRules(await fetchRules());
    } catch (error) {
      setError(
        getSafeErrorDetailFromUnknown(error, language) ??
          tr('加载规则失败', 'Failed to load rules'),
      );
    } finally {
      setLoading(false);
    }
  }, [fetchRules, language, tr]);

  const addRule = useCallback(
    (rule: ExceptionRule) => {
      if (rule.chainId !== chainId || rule.scope !== 'chain') return;
      setRules((current) => [...current, rule]);
    },
    [chainId],
  );

  return { rules, loading, error, setError, loadRules, addRule };
}

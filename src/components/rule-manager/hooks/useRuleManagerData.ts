import { type Translator } from '../../../i18n';
import { useCallback, useEffect, useState } from 'react';
import type { ExceptionRule } from '../../../types';
import { exceptionRuleManager } from '../../../services/exception-rule-manager/ExceptionRuleManager';
import { getSafeErrorDetailFromUnknown } from '../../../utils/errorMessage';
import type { Language } from '../../../i18n/translations';

export function useRuleManagerData(args: {
  language: Language;
  t: Translator;
}) {
  const { language, t } = args;

  const [rules, setRules] = useState<ExceptionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyRules = useCallback((allRules: ExceptionRule[]) => {
    setRules(allRules);
    setError(null);
    setLoading(false);
  }, []);
  const applyLoadFailure = useCallback(
    (err: unknown) => {
      const safe = getSafeErrorDetailFromUnknown(err, language);
      setError(safe ?? t('ruleManager.useRuleManagerData.failedToLoadRules'));
      setLoading(false);
    },
    [language, t],
  );

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      applyRules(await exceptionRuleManager.getAllRules());
    } catch (err) {
      applyLoadFailure(err);
    }
  }, [applyLoadFailure, applyRules]);

  // Initial load; `loading` starts true.
  useEffect(() => {
    let cancelled = false;
    exceptionRuleManager.getAllRules().then(
      (allRules) => {
        if (!cancelled) applyRules(allRules);
      },
      (err: unknown) => {
        if (!cancelled) applyLoadFailure(err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [applyLoadFailure, applyRules]);

  return {
    rules,
    setRules,
    loading,
    error,
    setError,
    loadRules,
  };
}

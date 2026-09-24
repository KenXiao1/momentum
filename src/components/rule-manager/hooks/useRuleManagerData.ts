import { type Translator } from '../../../i18n';
import { useCallback, useEffect, useState } from 'react';
import type { ExceptionRule } from '../../../types';
import { exceptionRuleManager } from '../../../services/ExceptionRuleManager';
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

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const allRules = await exceptionRuleManager.getAllRules();
      setRules(allRules);
      setError(null);
    } catch (err) {
      const safe = getSafeErrorDetailFromUnknown(err, language);
      setError(safe ?? t('ruleManager.useRuleManagerData.failedToLoadRules'));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  return {
    rules,
    setRules,
    loading,
    error,
    setError,
    loadRules,
  };
}

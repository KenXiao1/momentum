/**
 * Rule selection dialog container.
 * Lets users select applicable exception rules for pause/early completion flows.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ExceptionRule, PauseOptions, SessionContext } from '../types';
import { ExceptionRuleType } from '../types';
import { exceptionRuleManager } from '../services/ExceptionRuleManager';
import { useI18n } from '../i18n';
import { isDev } from '../utils/env';
import { getSafeErrorDetailFromUnknown } from '../utils/errorMessage';
import { useLayoutStability } from '../utils/LayoutStabilityMonitor';
import { logger } from '../utils/logger';
import { RuleSelectionDialogView } from './RuleSelectionDialogView';
import {
  useRuleSelectionRules,
  type RuleActionType,
} from './rule-selection-dialog/useRuleSelectionRules';
import { useRuleSearchResults } from './rule-selection-dialog/useRuleSearchResults';

function getPauseOptions(
  actionType: RuleActionType,
  isIndefinite: boolean,
  durationMinutes: number | undefined,
): PauseOptions | undefined {
  if (actionType !== 'pause') return undefined;
  if (isIndefinite) return { autoResume: false };
  return { duration: (durationMinutes ?? 15) * 60, autoResume: true };
}

interface RuleSelectionDialogProps {
  isOpen: boolean;
  actionType: RuleActionType;
  sessionContext: SessionContext;
  onRuleSelected: (rule: ExceptionRule, pauseOptions?: PauseOptions) => void;
  onCreateNewRule: (name: string, type: ExceptionRuleType) => void;
  onCancel: () => void;
}

export const RuleSelectionDialog: React.FC<RuleSelectionDialogProps> = ({
  isOpen,
  actionType,
  sessionContext,
  onRuleSelected,
  onCreateNewRule,
  onCancel,
}) => {
  const { language, t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [duration, setDuration] = useState<number | undefined>(15);
  const [isIndefinite, setIsIndefinite] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { startMonitoring, stopMonitoring } = useLayoutStability(containerRef);
  const ruleState = useRuleSelectionRules({
    chainId: sessionContext.chainId,
    actionType,
    language,
    t,
  });
  const search = useRuleSearchResults(ruleState.rules, searchQuery);
  const {
    addRule,
    error,
    loadRules,
    loading,
    setError: setRuleError,
  } = ruleState;
  const { detectDuplicates, results: searchResults } = search;

  useEffect(() => {
    if (isOpen) {
      startMonitoring();
      void loadRules();
    } else {
      stopMonitoring();
      setSearchQuery('');
      setRuleError(null);
    }

    return () => {
      stopMonitoring();
    };
  }, [isOpen, loadRules, setRuleError, startMonitoring, stopMonitoring]);

  const handleRuleSelect = useCallback(
    async (rule: ExceptionRule) => {
      try {
        if (isDev) {
          logger.debug('RULE_SELECTION', '\u9009\u62e9\u89c4\u5219', {
            ruleId: rule.id,
            actionType,
          });
        }

        const pauseOptions = getPauseOptions(
          actionType,
          isIndefinite,
          duration,
        );

        onRuleSelected(rule, pauseOptions);
      } catch (err) {
        const safe = getSafeErrorDetailFromUnknown(err, language);
        setRuleError(safe ?? t('ruleSelectionDialog.failedToSelectRule'));
      }
    },
    [
      actionType,
      duration,
      isIndefinite,
      language,
      onRuleSelected,
      setRuleError,
      t,
    ],
  );

  const handleCreateNewRule = useCallback(
    async (inputName: string) => {
      const cleanName = inputName.trim();
      if (!cleanName) return;

      try {
        const ruleType =
          actionType === 'pause'
            ? ExceptionRuleType.PAUSE_ONLY
            : ExceptionRuleType.EARLY_COMPLETION_ONLY;

        const duplicateCheck = detectDuplicates(cleanName);
        if (duplicateCheck.hasExactMatch) {
          setRuleError(
            t('ruleSelectionDialog.ruleNameCleanNameAlreadyExists', {
              cleanName: cleanName,
            }),
          );
          return;
        }

        if (isDev) {
          logger.debug('RULE_SELECTION', 'Creating chain-specific rule', {
            cleanName,
            ruleType,
            actionType,
            chainId: sessionContext.chainId,
          });
        }

        const result = await exceptionRuleManager.createChainRule(
          sessionContext.chainId,
          cleanName,
          ruleType,
        );

        addRule(result.rule);
        setSearchQuery('');

        onCreateNewRule(cleanName, ruleType);
      } catch (err) {
        const safe = getSafeErrorDetailFromUnknown(err, language);
        setRuleError(safe ?? t('ruleSelectionDialog.failedToCreateRule'));
      }
    },
    [
      actionType,
      addRule,
      detectDuplicates,
      language,
      onCreateNewRule,
      setRuleError,
      sessionContext.chainId,
      t,
    ],
  );

  if (!isOpen) return null;

  return (
    <RuleSelectionDialogView
      actionType={actionType}
      sessionContext={sessionContext}
      language={language}
      t={t}
      containerRef={containerRef}
      searchInputRef={searchInputRef}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchResults={searchResults}
      isLoading={loading}
      error={error}
      onDismissError={() => setRuleError(null)}
      durationMinutes={duration}
      onDurationMinutesChange={setDuration}
      isIndefinite={isIndefinite}
      onIsIndefiniteChange={setIsIndefinite}
      onCancel={onCancel}
      onSelectRule={(rule) => void handleRuleSelect(rule)}
      onCreateNewRule={(name) => void handleCreateNewRule(name)}
    />
  );
};

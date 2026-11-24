import { useState } from 'react';
import type {
  ExceptionRule,
  PauseOptions,
  SessionContext,
} from '../../../types';
import { useI18n } from '../../../i18n';
import { toast } from '../../../utils/toast';
import {
  useExceptionRuleOperations,
  type PendingActionType,
} from './useExceptionRuleOperations';

interface UseExceptionRuleFlowParams {
  sessionContext: SessionContext;
  onPause: (duration?: number) => void | Promise<boolean | void>;
  onRequestCompletionDialog: () => void;
  scheduleAutoResume: (minutes: number) => void;
  clearAutoResumeSchedule: () => void;
  onRuleUsed?: (
    rule: ExceptionRule,
    actionType: PendingActionType,
    pauseOptions?: PauseOptions,
  ) => void;
}

export function useExceptionRuleFlow(params: UseExceptionRuleFlowParams) {
  const { t } = useI18n();
  const [showRuleSelection, setShowRuleSelection] = useState(false);
  const [pendingActionType, setPendingActionType] =
    useState<PendingActionType | null>(null);

  const finishFlow = () => {
    setShowRuleSelection(false);
    setPendingActionType(null);
  };
  const operations = useExceptionRuleOperations({
    ...params,
    pendingActionType,
    finishFlow,
    t,
  });

  const openPauseSelection = () => {
    setPendingActionType('pause');
    setShowRuleSelection(true);
  };
  const openEarlyCompletionSelection = () => {
    setPendingActionType('early_completion');
    setShowRuleSelection(true);
  };
  const handleRuleSelectionCancel = () => {
    finishFlow();
    toast.info(
      t(
        'focusMode.useExceptionRuleFlow.youCanContinueTheTaskOrChooseAnotherAction',
      ),
      { title: t('focusMode.useExceptionRuleFlow.cancelled') },
    );
  };

  return {
    showRuleSelection,
    pendingActionType,
    openPauseSelection,
    openEarlyCompletionSelection,
    handleRuleSelected: operations.handleRuleSelected,
    handleCreateNewRule: operations.handleCreateNewRule,
    handleRuleSelectionCancel,
  };
}

import { useState } from 'react';
import type {
  ExceptionRule,
  PauseOptions,
  SessionContext,
} from '../../../types';
import { userFeedbackHandler } from '../../../services/UserFeedbackHandler';
import { useI18n } from '../../../i18n';
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
  const { tr } = useI18n();
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
    tr,
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
    userFeedbackHandler.hideProgress();
    finishFlow();
    userFeedbackHandler.showInfo(
      tr('操作已取消', 'Cancelled'),
      tr(
        '您可以继续任务或重新选择操作',
        'You can continue the task or choose another action.',
      ),
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

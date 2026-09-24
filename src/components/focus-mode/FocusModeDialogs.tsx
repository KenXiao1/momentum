import type {
  ExceptionRule,
  ExceptionRuleType,
  PauseOptions,
  SessionContext,
} from '../../types';
import { RuleSelectionDialog } from '../RuleSelectionDialog';
import { TaskCompletionDialog } from '../TaskCompletionDialog';
import { UserFeedbackDisplay } from '../UserFeedbackDisplay';
import { InterruptConfirmDialog } from './InterruptConfirmDialog';

interface FocusModeDialogsProps {
  chainId: string;
  chainName: string;
  isDurationless: boolean;
  showRuleSelection: boolean;
  pendingActionType: 'pause' | 'early_completion' | null;
  sessionContext: SessionContext;
  onRuleSelected: (rule: ExceptionRule, pauseOptions?: PauseOptions) => void;
  onCreateNewRule: (name: string, type: ExceptionRuleType) => void;
  onRuleSelectionCancel: () => void;
  showCompletionDialog: boolean;
  onDirectComplete: (
    description?: string,
    notes?: string,
  ) => void | Promise<boolean | void>;
  onCompletionCancel: () => void;
  showInterruptDialog: boolean;
  onCancelInterrupt: () => void;
  onConfirmInterrupt: () => void;
}

export function FocusModeDialogs({
  chainId,
  chainName,
  isDurationless,
  showRuleSelection,
  pendingActionType,
  sessionContext,
  onRuleSelected,
  onCreateNewRule,
  onRuleSelectionCancel,
  showCompletionDialog,
  onDirectComplete,
  onCompletionCancel,
  showInterruptDialog,
  onCancelInterrupt,
  onConfirmInterrupt,
}: FocusModeDialogsProps) {
  return (
    <>
      {showRuleSelection && pendingActionType && (
        <RuleSelectionDialog
          isOpen
          actionType={pendingActionType}
          sessionContext={sessionContext}
          onRuleSelected={onRuleSelected}
          onCreateNewRule={onCreateNewRule}
          onCancel={onRuleSelectionCancel}
        />
      )}
      {showCompletionDialog && (
        <TaskCompletionDialog
          isOpen
          chainName={chainName}
          chainId={chainId}
          isDurationless={isDurationless}
          onComplete={onDirectComplete}
          onCancel={onCompletionCancel}
        />
      )}
      <InterruptConfirmDialog
        isOpen={showInterruptDialog}
        onCancel={onCancelInterrupt}
        onConfirm={onConfirmInterrupt}
      />
      <UserFeedbackDisplay />
    </>
  );
}

import React from 'react';
import { useI18n } from '../../i18n';
import { NotesSection } from './components/NotesSection';
import { TaskCompletionDialogFooter } from './components/TaskCompletionDialogFooter';
import { TaskCompletionDialogHeader } from './components/TaskCompletionDialogHeader';
import { TaskDescriptionSection } from './components/TaskDescriptionSection';
import { useTaskCompletionDialog } from './hooks/useTaskCompletionDialog';
import { DialogShell } from '../shared/DialogShell';

interface TaskCompletionDialogProps {
  isOpen: boolean;
  chainName: string;
  chainId: string;
  isDurationless?: boolean;
  onComplete: (
    description: string,
    notes?: string,
  ) => void | Promise<boolean | void>;
  onCancel: () => void;
}

export const TaskCompletionDialog: React.FC<TaskCompletionDialogProps> = ({
  isOpen,
  chainName,
  chainId,
  isDurationless = false,
  onComplete,
  onCancel,
}) => {
  const { t } = useI18n();

  const {
    description,
    isSubmitting,
    setDescription,
    notes,
    setNotes,
    isNotesVisible,
    recentDescriptions,
    showQuickFill,
    descriptionInputRef,
    notesTextareaRef,
    handleSubmit,
    handleCancel,
    showNotes,
    toggleQuickFill,
    handleQuickFill,
    handleDescriptionKeyDown,
    handleNotesKeyDown,
  } = useTaskCompletionDialog({
    isOpen,
    chainId,
    isDurationless,
    onComplete,
    onCancel,
  });

  if (!isOpen) return null;

  const disableComplete =
    isSubmitting || (isDurationless && !description.trim());

  return (
    <DialogShell
      titleId="task-completion-dialog-title"
      onClose={handleCancel}
      initialFocusRef={descriptionInputRef}
      className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800"
    >
      <TaskCompletionDialogHeader
        chainName={chainName}
        t={t}
        onCancel={handleCancel}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <TaskDescriptionSection
          t={t}
          isDurationless={isDurationless}
          description={description}
          onDescriptionChange={setDescription}
          onDescriptionKeyDown={handleDescriptionKeyDown}
          descriptionInputRef={descriptionInputRef}
          recentDescriptions={recentDescriptions}
          showQuickFill={showQuickFill}
          onToggleQuickFill={toggleQuickFill}
          onQuickFill={handleQuickFill}
        />

        <NotesSection
          t={t}
          isVisible={isNotesVisible}
          notes={notes}
          onNotesChange={setNotes}
          onNotesKeyDown={handleNotesKeyDown}
          notesTextareaRef={notesTextareaRef}
          onShowNotes={showNotes}
        />
      </div>

      <TaskCompletionDialogFooter
        t={t}
        disableComplete={disableComplete}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    </DialogShell>
  );
};

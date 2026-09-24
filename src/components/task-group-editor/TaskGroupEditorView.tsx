import React from 'react';
import { Hash } from 'lucide-react';
import type { CSSProperties } from 'react';

import { ResponsiveContainer } from '../ResponsiveContainer';
import { BackButton } from '../BackButton';
import { useI18n } from '../../i18n';

import { BasicInfoSection } from './BasicInfoSection';
import { BookingSettingsSection } from './BookingSettingsSection';
import { ActionButtons } from './ActionButtons';
import type { TaskGroupEditorViewProps } from './types';
import { RSIPTaskLinkPanel } from '../rsip/RSIPTaskLinkPanel';

type EditorSurfaceStyle = CSSProperties & { '--keyboard-height': string };

export const TaskGroupEditorView: React.FC<TaskGroupEditorViewProps> =
  React.memo(
    ({
      chain,
      isEditing,
      name,
      description,
      auxiliarySignal,
      customAuxiliarySignal,
      auxiliaryDuration,
      isCustomAuxiliaryDuration,
      auxiliaryCompletionTrigger,
      errors,
      keyboardHeight,
      onNameChange,
      onDescriptionChange,
      onAuxiliarySignalSelect,
      onCustomAuxiliarySignalChange,
      onAuxiliaryDurationChange,
      onAuxiliaryDurationModeChange,
      onAuxiliaryCompletionTriggerChange,
      onSubmit,
      onCancel,
      rsipNodes,
      rsipTaskLinks,
      onUpsertRSIPTaskLinks,
    }) => {
      const { language, t } = useI18n();
      const canEditRsipLinks = Boolean(
        chain?.id && rsipNodes && rsipTaskLinks && onUpsertRSIPTaskLinks,
      );
      const editorStyle: EditorSurfaceStyle = {
        '--keyboard-height': `${keyboardHeight}px`,
      };

      return (
        <div
          className="editor-surface bg-background overflow-x-clip"
          style={editorStyle}
        >
          <ResponsiveContainer
            maxWidth="4xl"
            className="editor-scroll-region py-4 md:py-6"
          >
            <header className="mb-8 flex animate-fade-in items-center justify-between md:mb-10">
              <div className="flex items-center space-x-4">
                <BackButton
                  onClick={onCancel}
                  label={t('common.back')}
                  className="rounded-2xl p-3 text-gray-400 transition-colors hover:bg-white/50 hover:text-[#161615]"
                />
                <div>
                  <h1 className="mb-2 font-chinese text-4xl font-bold text-[#161615] dark:text-slate-100 md:text-5xl">
                    {isEditing
                      ? t('taskGroupEditor.taskGroupEditorView.editGroup')
                      : t('taskGroupEditor.taskGroupEditorView.createGroup')}
                  </h1>
                  <p className="font-mono text-sm uppercase tracking-wider text-gray-500">
                    {isEditing
                      ? t(
                          'taskGroupEditor.taskGroupEditorView.editGroupVariant2',
                        )
                      : t(
                          'taskGroupEditor.taskGroupEditorView.createGroupVariant2',
                        )}
                  </p>
                </div>
              </div>

              {chain && isEditing && (
                <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-700/50 dark:bg-primary-900/20">
                  <div className="flex items-center space-x-2">
                    <Hash
                      className="text-primary-600 dark:text-primary-400"
                      size={16}
                    />
                    <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                      #{chain.totalCompletions || 0}
                    </span>
                  </div>
                  <p className="mt-1 font-chinese text-xs text-primary-600 dark:text-primary-400">
                    {t('groupView.unitCard.completions')}
                  </p>
                </div>
              )}
            </header>

            <form
              onSubmit={onSubmit}
              className="animate-slide-up space-y-6 md:space-y-8"
            >
              <BasicInfoSection
                name={name}
                description={description}
                errors={errors}
                onNameChange={onNameChange}
                onDescriptionChange={onDescriptionChange}
                t={t}
              />

              <BookingSettingsSection
                auxiliarySignal={auxiliarySignal}
                customAuxiliarySignal={customAuxiliarySignal}
                auxiliaryDuration={auxiliaryDuration}
                isCustomAuxiliaryDuration={isCustomAuxiliaryDuration}
                auxiliaryCompletionTrigger={auxiliaryCompletionTrigger}
                errors={errors}
                language={language}
                onAuxiliarySignalSelect={onAuxiliarySignalSelect}
                onCustomAuxiliarySignalChange={onCustomAuxiliarySignalChange}
                onAuxiliaryDurationChange={onAuxiliaryDurationChange}
                onAuxiliaryDurationModeChange={onAuxiliaryDurationModeChange}
                onAuxiliaryCompletionTriggerChange={
                  onAuxiliaryCompletionTriggerChange
                }
                t={t}
              />

              <section
                className="space-y-3"
                data-testid="task-group-editor-rsip-links"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                  {t('chainEditor.chainEditorView.rsipIntegration')}
                </h2>
                {canEditRsipLinks ? (
                  <RSIPTaskLinkPanel
                    links={rsipTaskLinks ?? []}
                    nodes={rsipNodes ?? []}
                    chains={chain ? [chain] : []}
                    fixedChainId={chain?.id}
                    title={t(
                      'taskGroupEditor.taskGroupEditorView.groupSideRsipLinks',
                    )}
                    description={t(
                      'taskGroupEditor.taskGroupEditorView.configureLinksForThisTaskGroupDirectlyInThe',
                    )}
                    onUpsertLinks={onUpsertRSIPTaskLinks!}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                    {t(
                      'taskGroupEditor.taskGroupEditorView.saveThisTaskGroupFirstThenConfigureRsipLinks',
                    )}
                  </div>
                )}
              </section>

              <ActionButtons isEditing={isEditing} onCancel={onCancel} t={t} />
            </form>
          </ResponsiveContainer>
        </div>
      );
    },
  );

TaskGroupEditorView.displayName = 'TaskGroupEditorView';

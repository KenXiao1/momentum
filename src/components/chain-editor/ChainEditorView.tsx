import { ResponsiveContainer } from '../ResponsiveContainer';
import { RSIPTaskLinkPanel } from '../rsip/RSIPTaskLinkPanel';
import type { Chain, RSIPNode, RSIPTaskLink } from '../../types';
import type { ChainEditorFormModel } from './hooks/useChainEditorForm';
import { ChainEditorActions } from './ChainEditorActions';
import { ChainEditorHeader } from './ChainEditorHeader';
import { AuxiliaryChainSettingsSection } from './sections/AuxiliaryChainSettingsSection';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { MainChainSettingsSection } from './sections/MainChainSettingsSection';
import { TaskDescriptionSection } from './sections/TaskDescriptionSection';
import { useI18n } from '../../i18n';
import type { CSSProperties } from 'react';

type EditorSurfaceStyle = CSSProperties & { '--keyboard-height': string };

interface ChainEditorViewProps {
  chain?: Chain;
  isEditing: boolean;
  onCancel: () => void;
  form: ChainEditorFormModel;
  keyboardHeight: number;
  rsipNodes?: RSIPNode[];
  rsipTaskLinks?: RSIPTaskLink[];
  onUpsertRSIPTaskLinks?: (links: RSIPTaskLink[]) => void | Promise<unknown>;
}

export function ChainEditorView({
  chain,
  isEditing,
  onCancel,
  form,
  keyboardHeight,
  rsipNodes,
  rsipTaskLinks,
  onUpsertRSIPTaskLinks,
}: ChainEditorViewProps) {
  const { t } = useI18n();
  const canEditRsipLinks = Boolean(
    chain?.id && rsipNodes && rsipTaskLinks && onUpsertRSIPTaskLinks,
  );
  const editorStyle: EditorSurfaceStyle = {
    '--keyboard-height': `${keyboardHeight}px`,
  };

  return (
    <div
      className="editor-surface bg-background performance-layer overflow-x-clip"
      style={editorStyle}
      data-scrollable="true"
    >
      <ResponsiveContainer
        maxWidth="4xl"
        className="editor-scroll-region py-4 md:py-6"
        data-scrollable="true"
      >
        <ChainEditorHeader isEditing={isEditing} onCancel={onCancel} />

        <form
          onSubmit={form.handleSubmit}
          className="performance-layer animate-slide-up space-y-8"
        >
          <BasicInfoSection form={form} />
          <MainChainSettingsSection form={form} />
          <AuxiliaryChainSettingsSection form={form} />
          <TaskDescriptionSection form={form} />
          <section className="space-y-3" data-testid="chain-editor-rsip-links">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
              {t('chainEditor.chainEditorView.rsipIntegration')}
            </h2>
            {canEditRsipLinks ? (
              <RSIPTaskLinkPanel
                links={rsipTaskLinks ?? []}
                nodes={rsipNodes ?? []}
                chains={chain ? [chain] : []}
                fixedChainId={chain?.id}
                title={t('chainEditor.chainEditorView.taskSideRsipLinks')}
                description={t(
                  'chainEditor.chainEditorView.configureLinksForThisTaskDirectlyInTheEditor',
                )}
                onUpsertLinks={onUpsertRSIPTaskLinks!}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                {t(
                  'chainEditor.chainEditorView.saveThisTaskFirstThenConfigureRsipLinksHere',
                )}
              </div>
            )}
          </section>
          <ChainEditorActions
            isEditing={isEditing}
            onCancel={onCancel}
            form={form}
          />
        </form>
      </ResponsiveContainer>
    </div>
  );
}

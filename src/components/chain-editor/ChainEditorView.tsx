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

interface MobileInfo {
  isMobile: boolean;
  touchSupport: boolean;
}

interface ChainEditorViewProps {
  chain?: Chain;
  isEditing: boolean;
  onCancel: () => void;
  form: ChainEditorFormModel;
  mobileInfo: MobileInfo;
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  rsipNodes?: RSIPNode[];
  rsipTaskLinks?: RSIPTaskLink[];
  onUpsertRSIPTaskLinks?: (links: RSIPTaskLink[]) => void | Promise<unknown>;
}

export function ChainEditorView({
  chain,
  isEditing,
  onCancel,
  form,
  mobileInfo,
  keyboardHeight,
  isKeyboardVisible,
  rsipNodes,
  rsipTaskLinks,
  onUpsertRSIPTaskLinks,
}: ChainEditorViewProps) {
  const { tr } = useI18n();
  const canEditRsipLinks = Boolean(
    chain?.id && rsipNodes && rsipTaskLinks && onUpsertRSIPTaskLinks,
  );

  return (
    <div
      className={`chain-editor-container bg-background performance-layer min-h-screen overflow-x-clip ${
        isKeyboardVisible ? 'keyboard-active' : ''
      }`}
      style={{ paddingBottom: isKeyboardVisible ? `${keyboardHeight}px` : '0' }}
      data-scrollable="true"
    >
      <ResponsiveContainer
        maxWidth="4xl"
        className={`chain-editor-scroll-container py-4 md:py-6 ${mobileInfo.isMobile ? 'px-4' : ''}`}
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
              {tr('RSIP 流程联动', 'RSIP Integration')}
            </h2>
            {canEditRsipLinks ? (
              <RSIPTaskLinkPanel
                links={rsipTaskLinks ?? []}
                nodes={rsipNodes ?? []}
                chains={chain ? [chain] : []}
                fixedChainId={chain?.id}
                title={tr('任务侧 RSIP 联动', 'Task-side RSIP links')}
                description={tr(
                  '可在编辑器中直接为该任务配置联动。冲突采用最后写入生效（LWW）。',
                  'Configure links for this task directly in the editor. Conflicts use last-write-wins.',
                )}
                onUpsertLinks={onUpsertRSIPTaskLinks!}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                {tr(
                  '请先保存任务，再在这里配置 RSIP 联动。',
                  'Save this task first, then configure RSIP links here.',
                )}
              </div>
            )}
          </section>
          <ChainEditorActions
            isEditing={isEditing}
            onCancel={onCancel}
            form={form}
            mobileInfo={mobileInfo}
          />
        </form>

        {isKeyboardVisible && <div className="keyboard-buffer"></div>}
      </ResponsiveContainer>
    </div>
  );
}

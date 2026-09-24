import { Flame } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { SettingSection } from '../../SettingSection';
import type { ChainEditorFormModel } from '../hooks/useChainEditorForm';
import { SacredSeatSettings } from './main-chain-settings/SacredSeatSettings';
import { TaskDurationSettings } from './main-chain-settings/TaskDurationSettings';

export function MainChainSettingsSection({
  form,
}: {
  form: ChainEditorFormModel;
}) {
  const { language, t } = useI18n();

  return (
    <SettingSection
      title={t('chainEditor.mainChainSettingsSection.mainChain')}
      icon={<Flame className="text-primary-500" size={20} />}
      description={t(
        'chainEditor.mainChainSettingsSection.configureTheMainTaskExecutionSettings',
      )}
    >
      <div className="grid grid-cols-1 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/80 md:grid-cols-2 md:divide-x md:divide-y-0">
        <SacredSeatSettings form={form} language={language} t={t} />
        <TaskDurationSettings form={form} t={t} />
      </div>
    </SettingSection>
  );
}

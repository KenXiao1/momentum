import { AlignLeft } from 'lucide-react';
import { SettingSection } from '../../SettingSection';
import type { ChainEditorFormModel } from '../hooks/useChainEditorForm';
import { useI18n } from '../../../i18n';

interface TaskDescriptionSectionProps {
  form: ChainEditorFormModel;
}

export function TaskDescriptionSection({ form }: TaskDescriptionSectionProps) {
  const { t } = useI18n();

  return (
    <SettingSection
      title={t('chainEditor.description.title')}
      icon={<AlignLeft className="text-gray-500" size={20} />}
      description={t('chainEditor.description.hint')}
    >
      <div className="bento-card animate-scale-in">
        <textarea
          id="task-description"
          name="taskDescription"
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          placeholder={t('chainEditor.description.placeholder')}
          rows={4}
          className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4 font-chinese leading-relaxed text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          required
        />
      </div>
    </SettingSection>
  );
}

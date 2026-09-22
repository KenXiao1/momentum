import { useI18n } from '../../i18n';
import { BackButton } from '../BackButton';

interface ChainEditorHeaderProps {
  isEditing: boolean;
  onCancel: () => void;
}

export function ChainEditorHeader({
  isEditing,
  onCancel,
}: ChainEditorHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="mb-12 flex animate-fade-in items-center space-x-4">
      <BackButton
        onClick={onCancel}
        label={t('common.back')}
        className="rounded-2xl p-3 text-gray-400 transition-colors hover:bg-white/50 hover:text-[#161615]"
      />
      <div>
        <h1 className="mb-2 font-chinese text-4xl font-bold text-[#161615] dark:text-slate-100 md:text-5xl">
          {isEditing
            ? t('chainEditor.editTitle')
            : t('chainEditor.createTitle')}
        </h1>
        <p className="font-mono text-sm uppercase tracking-wider text-gray-500">
          {isEditing
            ? t('chainEditor.editSubtitle')
            : t('chainEditor.createSubtitle')}
        </p>
      </div>
    </header>
  );
}

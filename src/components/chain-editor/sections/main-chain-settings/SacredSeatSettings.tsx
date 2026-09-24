import { type Translator } from '../../../../i18n';
import { Crown } from 'lucide-react';
import type { ChainEditorFormModel } from '../../hooks/useChainEditorForm';
import { CUSTOM_TRIGGER_VALUE, TRIGGER_TEMPLATES } from '../../constants';

interface SacredSeatSettingsProps {
  form: ChainEditorFormModel;
  language: 'zh' | 'en';
  t: Translator;
}

export function SacredSeatSettings({
  form,
  language,
  t: t,
}: SacredSeatSettingsProps) {
  return (
    <div className="animate-scale-in p-5 md:p-6">
      <div className="mb-3 flex items-center gap-3">
        <Crown className="text-primary-500" size={18} aria-hidden="true" />
        <div className="min-w-0">
          <h4 className="font-chinese text-base font-semibold text-gray-900 dark:text-slate-100">
            {t('chainEditor.mainChainSettings.sacredSeatSettings.sacredSeat')}
          </h4>
          <p className="font-chinese text-sm text-gray-500 dark:text-slate-400">
            {t(
              'chainEditor.mainChainSettings.sacredSeatSettings.chooseAClearSignalThatStartsThisTask',
            )}
          </p>
        </div>
      </div>
      <select
        id="sacred-seat-trigger"
        name="sacredSeatTrigger"
        value={form.trigger}
        onChange={(event) => form.handleTriggerSelect(event.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        required
      >
        <option value="" disabled className="text-gray-400">
          {t('chainEditor.mainChainSettings.sacredSeatSettings.chooseATrigger')}
        </option>
        {TRIGGER_TEMPLATES.map((template) => (
          <option
            key={template.value}
            value={template.value}
            className="bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-100"
          >
            {template.label[language]}
          </option>
        ))}
      </select>
      {form.trigger === CUSTOM_TRIGGER_VALUE && (
        <input
          type="text"
          id="custom-trigger"
          name="customTrigger"
          value={form.customTrigger}
          onChange={(event) => form.setCustomTrigger(event.target.value)}
          placeholder={t(
            'chainEditor.mainChainSettings.sacredSeatSettings.enterYourCustomTrigger',
          )}
          className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          required
        />
      )}
    </div>
  );
}

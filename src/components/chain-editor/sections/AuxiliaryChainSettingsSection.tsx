import { Bell, Calendar, CheckCircle, Hourglass } from 'lucide-react';
import { NumericSliderField } from '../../shared/NumericSliderField';
import { SettingSection } from '../../SettingSection';
import type { ChainEditorFormModel } from '../hooks/useChainEditorForm';
import {
  AUXILIARY_DURATION_PRESETS,
  AUXILIARY_SIGNAL_TEMPLATES,
  CUSTOM_AUXILIARY_SIGNAL_VALUE,
  getTriggerLabel,
} from '../constants';
import { useI18n } from '../../../i18n';

interface AuxiliaryChainSettingsSectionProps {
  form: ChainEditorFormModel;
}

export function AuxiliaryChainSettingsSection({
  form,
}: AuxiliaryChainSettingsSectionProps) {
  const { language, t } = useI18n();

  return (
    <SettingSection
      title={t('chainEditor.auxiliaryChainSettingsSection.auxiliaryBooking')}
      icon={<Calendar className="text-blue-500" size={20} />}
      description={t(
        'chainEditor.auxiliaryChainSettingsSection.configureBookingAndCompletionConditions',
      )}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bento-card animate-scale-in border-l-4 border-l-blue-500 p-4 md:p-5">
          <div className="mb-3 flex items-center gap-3">
            <Bell className="text-blue-500" size={18} />
            <div className="min-w-0">
              <h4 className="font-chinese text-base font-semibold text-gray-900 dark:text-slate-100">
                {t('chainDetail.chainDetailStats.bookingSignal')}
              </h4>
              <p className="font-mono text-[11px] text-gray-500">
                {t('chainEditor.auxiliaryChainSettingsSection.bookingSignal')}
              </p>
            </div>
          </div>

          <select
            id="auxiliary-signal"
            name="auxiliarySignal"
            value={form.auxiliarySignal}
            onChange={(e) => form.handleAuxiliarySignalSelect(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            required
          >
            <option value="" disabled className="text-gray-400">
              {t(
                'chainEditor.auxiliaryChainSettingsSection.chooseABookingSignal',
              )}
            </option>
            {AUXILIARY_SIGNAL_TEMPLATES.map((template, index) => (
              <option
                key={index}
                value={template.value}
                className="bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-100"
              >
                {template.label[language]}
              </option>
            ))}
          </select>

          {form.auxiliarySignal === CUSTOM_AUXILIARY_SIGNAL_VALUE && (
            <input
              type="text"
              id="custom-auxiliary-signal"
              name="customAuxiliarySignal"
              value={form.customAuxiliarySignal}
              onChange={(e) => form.setCustomAuxiliarySignal(e.target.value)}
              placeholder={t(
                'chainEditor.auxiliaryChainSettingsSection.enterYourCustomBookingSignal',
              )}
              className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              required
            />
          )}
        </div>

        <div className="bento-card animate-scale-in border-l-4 border-l-blue-500 p-4 md:p-5">
          <div className="mb-3 flex items-center gap-3">
            <Hourglass className="text-blue-500" size={18} />
            <div className="min-w-0">
              <h4 className="font-chinese text-base font-semibold text-gray-900 dark:text-slate-100">
                {t('chainDetail.chainDetailStats.bookingDuration')}
              </h4>
              <p className="font-mono text-[11px] text-gray-500">
                {t('chainEditor.auxiliaryChainSettingsSection.bookingDuration')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <select
              id="auxiliary-duration"
              name="auxiliaryDuration"
              value={
                form.isCustomAuxiliaryDuration
                  ? 'custom'
                  : form.auxiliaryDuration
              }
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  form.setIsCustomAuxiliaryDuration(true);
                  form.setAuxiliaryDuration(25);
                } else {
                  form.setIsCustomAuxiliaryDuration(false);
                  form.setAuxiliaryDuration(Number(e.target.value));
                }
              }}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              required
            >
              {AUXILIARY_DURATION_PRESETS.map((preset) => (
                <option
                  key={preset}
                  value={preset}
                  className="bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-100"
                >
                  {t('chainEditor.auxiliaryChainSettingsSection.presetMin', {
                    preset: preset,
                  })}
                </option>
              ))}
              <option
                value="custom"
                className="bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-100"
              >
                {t('chainEditor.auxiliaryChainSettingsSection.customDuration')}
              </option>
            </select>

            {form.isCustomAuxiliaryDuration && (
              <NumericSliderField
                id="auxiliary-duration-slider"
                label={t(
                  'chainEditor.auxiliaryChainSettingsSection.customBookingDuration',
                )}
                description={t(
                  'chainEditor.auxiliaryChainSettingsSection.setHowLongTheBookingPhaseLasts',
                )}
                value={form.auxiliaryDuration}
                onChange={form.setAuxiliaryDuration}
                min={1}
                max={120}
                unit={t('chainEditor.auxiliaryChainSettingsSection.min')}
                formatValue={(nextValue) =>
                  t('chainEditor.auxiliaryChainSettingsSection.nextValueMin', {
                    nextValue: nextValue,
                  })
                }
                debounceMs={50}
              />
            )}
          </div>
        </div>

        <div className="bento-card animate-scale-in border-l-4 border-l-blue-500 p-4 md:col-span-2 md:p-5">
          <div className="mb-3 flex items-center gap-3">
            <CheckCircle className="text-blue-500" size={18} />
            <div className="min-w-0">
              <h4 className="font-chinese text-base font-semibold text-gray-900 dark:text-slate-100">
                {t(
                  'chainEditor.auxiliaryChainSettingsSection.bookingCompletionCondition',
                )}
              </h4>
              <p className="font-mono text-[11px] text-gray-500">
                {t(
                  'chainEditor.auxiliaryChainSettingsSection.completionCondition',
                )}
              </p>
            </div>
          </div>

          <input
            type="text"
            id="auxiliary-completion-trigger"
            name="auxiliaryCompletionTrigger"
            value={getTriggerLabel(form.auxiliaryCompletionTrigger, language)}
            onChange={(e) => form.setAuxiliaryCompletionTrigger(e.target.value)}
            placeholder={t(
              'chainEditor.auxiliaryChainSettingsSection.eGOpenYourIdeSitAtYourDesk',
            )}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            required
          />

          <details className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            <summary className="cursor-pointer font-chinese">
              {t('chainEditor.auxiliaryChainSettingsSection.note')}
            </summary>
            <p className="mt-2 leading-relaxed">
              {t(
                'chainEditor.auxiliaryChainSettingsSection.thisIsTheActionYouMustCompleteDuringBookingUsually',
              )}
            </p>
          </details>
        </div>
      </div>
    </SettingSection>
  );
}

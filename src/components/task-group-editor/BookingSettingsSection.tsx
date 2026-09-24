import { type Translator } from '../../i18n';
import React from 'react';
import { Calendar, CheckCircle } from 'lucide-react';

import { SettingSection } from '../SettingSection';
import { getTriggerLabel } from '../chain-editor/constants';

import { AuxiliarySignalSection } from './AuxiliarySignalSection';
import { DurationSection } from './DurationSection';
import type { FormErrors } from './types';

const ERROR_INPUT_BORDER_CLASSES =
  'border-red-500 focus:border-red-500 focus:ring-red-500/20';

interface BookingSettingsSectionProps {
  auxiliarySignal: string;
  customAuxiliarySignal: string;
  auxiliaryDuration: number;
  isCustomAuxiliaryDuration: boolean;
  auxiliaryCompletionTrigger: string;
  errors: FormErrors;
  language: 'zh' | 'en';
  onAuxiliarySignalSelect: (value: string) => void;
  onCustomAuxiliarySignalChange: (value: string) => void;
  onAuxiliaryDurationChange: (value: number) => void;
  onAuxiliaryDurationModeChange: (isCustom: boolean, value: number) => void;
  onAuxiliaryCompletionTriggerChange: (value: string) => void;
  t: Translator;
}

export const BookingSettingsSection: React.FC<BookingSettingsSectionProps> =
  React.memo(
    ({
      auxiliarySignal,
      customAuxiliarySignal,
      auxiliaryDuration,
      isCustomAuxiliaryDuration,
      auxiliaryCompletionTrigger,
      errors,
      language,
      onAuxiliarySignalSelect,
      onCustomAuxiliarySignalChange,
      onAuxiliaryDurationChange,
      onAuxiliaryDurationModeChange,
      onAuxiliaryCompletionTriggerChange,
      t,
    }) => (
      <SettingSection
        title={t('taskGroupEditor.bookingSettingsSection.bookingSettings')}
        icon={<Calendar className="text-blue-500" size={20} />}
        description={t(
          'taskGroupEditor.bookingSettingsSection.configureBookingSignalDurationAndCompletionCondition',
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AuxiliarySignalSection
            auxiliarySignal={auxiliarySignal}
            customAuxiliarySignal={customAuxiliarySignal}
            errors={errors}
            language={language}
            onAuxiliarySignalSelect={onAuxiliarySignalSelect}
            onCustomAuxiliarySignalChange={onCustomAuxiliarySignalChange}
            t={t}
          />

          <DurationSection
            auxiliaryDuration={auxiliaryDuration}
            isCustomAuxiliaryDuration={isCustomAuxiliaryDuration}
            onAuxiliaryDurationChange={onAuxiliaryDurationChange}
            onAuxiliaryDurationModeChange={onAuxiliaryDurationModeChange}
            t={t}
          />

          {/* 预约完成条件 */}
          <div className="bento-card animate-scale-in border-l-4 border-l-blue-500 p-4 md:col-span-2 md:p-5">
            <div className="mb-3 flex items-center gap-3">
              <CheckCircle className="text-blue-500" size={18} />
              <div className="min-w-0">
                <h4 className="font-chinese text-base font-semibold text-gray-900 dark:text-slate-100">
                  {t(
                    'taskGroupEditor.bookingSettingsSection.completionCondition',
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
              value={getTriggerLabel(auxiliaryCompletionTrigger, language)}
              onChange={(e) =>
                onAuxiliaryCompletionTriggerChange(e.target.value)
              }
              placeholder={t(
                'taskGroupEditor.bookingSettingsSection.eGOpenTheFirstSubtaskPrepareYourMaterials',
              )}
              className={`w-full border bg-gray-50 dark:bg-slate-700 ${
                errors.auxiliaryCompletionTrigger
                  ? ERROR_INPUT_BORDER_CLASSES
                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-600'
              } rounded-2xl px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 dark:text-slate-100 dark:placeholder-slate-400`}
              required
            />

            {errors.auxiliaryCompletionTrigger && (
              <p className="mt-2 font-chinese text-sm text-red-600 dark:text-red-400">
                {errors.auxiliaryCompletionTrigger}
              </p>
            )}

            <details className="mt-3 text-xs text-gray-500 dark:text-slate-400">
              <summary className="cursor-pointer font-chinese">
                {t('chainEditor.auxiliaryChainSettingsSection.note')}
              </summary>
              <p className="mt-2 leading-relaxed">
                {t(
                  'taskGroupEditor.bookingSettingsSection.thisIsTheActionYouMustCompleteDuringBookingSignaling',
                )}
              </p>
            </details>
          </div>
        </div>
      </SettingSection>
    ),
  );

BookingSettingsSection.displayName = 'BookingSettingsSection';

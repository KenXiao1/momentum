import { type Translator } from '../../i18n';
import React from 'react';
import { Bell } from 'lucide-react';

import {
  AUXILIARY_SIGNAL_TEMPLATES,
  CUSTOM_AUXILIARY_SIGNAL_VALUE,
} from '../chain-editor/constants';

const ERROR_INPUT_BORDER_CLASSES =
  'border-red-500 focus:border-red-500 focus:ring-red-500/20';

interface FormErrors {
  auxiliarySignal?: string;
}

interface AuxiliarySignalSectionProps {
  auxiliarySignal: string;
  customAuxiliarySignal: string;
  errors: FormErrors;
  language: 'zh' | 'en';
  onAuxiliarySignalSelect: (value: string) => void;
  onCustomAuxiliarySignalChange: (value: string) => void;
  t: Translator;
}

const AuxiliarySignalSectionComponent: React.FC<
  AuxiliarySignalSectionProps
> = ({
  auxiliarySignal,
  customAuxiliarySignal,
  errors,
  language,
  onAuxiliarySignalSelect,
  onCustomAuxiliarySignalChange,
  t,
}) => (
  <div
    data-testid="task-group-editor-auxiliary-signal"
    className="bento-card animate-scale-in border-l-4 border-l-blue-500 p-4 md:p-5"
  >
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
      value={auxiliarySignal}
      onChange={(e) => onAuxiliarySignalSelect(e.target.value)}
      className={`w-full border bg-gray-50 dark:bg-slate-700 ${
        errors.auxiliarySignal
          ? ERROR_INPUT_BORDER_CLASSES
          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-600'
      } rounded-2xl px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:outline-none focus:ring-2 dark:text-slate-100`}
      required
    >
      <option value="" disabled className="text-gray-400">
        {t('chainEditor.auxiliaryChainSettingsSection.chooseABookingSignal')}
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

    {auxiliarySignal === CUSTOM_AUXILIARY_SIGNAL_VALUE && (
      <input
        type="text"
        id="custom-auxiliary-signal"
        name="customAuxiliarySignal"
        value={customAuxiliarySignal}
        onChange={(e) => onCustomAuxiliarySignalChange(e.target.value)}
        placeholder={t(
          'chainEditor.auxiliaryChainSettingsSection.enterYourCustomBookingSignal',
        )}
        className={`mt-3 w-full border bg-gray-50 dark:bg-slate-700 ${
          errors.auxiliarySignal
            ? ERROR_INPUT_BORDER_CLASSES
            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-600'
        } rounded-2xl px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 dark:text-slate-100 dark:placeholder-slate-400`}
        required
      />
    )}

    {errors.auxiliarySignal && (
      <p className="mt-2 font-chinese text-sm text-red-600 dark:text-red-400">
        {errors.auxiliarySignal}
      </p>
    )}
  </div>
);

export const AuxiliarySignalSection = React.memo(
  AuxiliarySignalSectionComponent,
);

AuxiliarySignalSection.displayName = 'AuxiliarySignalSection';

import { type Translator } from '../../i18n';
import React from 'react';
import { Hourglass } from 'lucide-react';

import { NumericSliderField } from '../shared/NumericSliderField';
import { AUXILIARY_DURATION_PRESETS } from '../chain-editor/constants';

interface DurationSectionProps {
  auxiliaryDuration: number;
  isCustomAuxiliaryDuration: boolean;
  onAuxiliaryDurationChange: (value: number) => void;
  onAuxiliaryDurationModeChange: (isCustom: boolean, value: number) => void;
  t: Translator;
}

const DurationSectionComponent: React.FC<DurationSectionProps> = ({
  auxiliaryDuration,
  isCustomAuxiliaryDuration,
  onAuxiliaryDurationChange,
  onAuxiliaryDurationModeChange,
  t,
}) => (
  <div
    data-testid="task-group-editor-duration"
    className="bento-card animate-scale-in border-l-4 border-l-blue-500 p-4 md:p-5"
  >
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
        value={isCustomAuxiliaryDuration ? 'custom' : auxiliaryDuration}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            onAuxiliaryDurationModeChange(true, 25);
          } else {
            onAuxiliaryDurationModeChange(false, Number(e.target.value));
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

      {isCustomAuxiliaryDuration && (
        <NumericSliderField
          id="auxiliary-duration-slider"
          label={t(
            'chainEditor.auxiliaryChainSettingsSection.customBookingDuration',
          )}
          description={t(
            'chainEditor.auxiliaryChainSettingsSection.setHowLongTheBookingPhaseLasts',
          )}
          value={auxiliaryDuration}
          onChange={onAuxiliaryDurationChange}
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

      <p className="text-xs leading-relaxed text-gray-500">
        {t(
          'taskGroupEditor.durationSection.howLongTheBookingPhaseLastsForPreparationAnd',
        )}
      </p>
    </div>
  </div>
);

export const DurationSection = React.memo(DurationSectionComponent);

DurationSection.displayName = 'DurationSection';

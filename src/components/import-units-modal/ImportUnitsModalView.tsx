import { type Translator } from '../../i18n';
import { Import, Search, X } from 'lucide-react';
import type { Chain } from '../../types';
import { DialogShell } from '../shared/DialogShell';
import { ImportModeOption } from './ImportModeOption';
import { ImportUnitOption } from './ImportUnitOption';
import type { ImportMode } from './useImportUnitsController';

interface ImportUnitsModalViewProps {
  units: Chain[];
  selectedUnits: Set<string>;
  searchTerm: string;
  importMode: ImportMode;
  language: 'zh' | 'en';
  selectionSummary: string;
  onSearchChange: (value: string) => void;
  onModeChange: (mode: ImportMode) => void;
  onToggleUnit: (unitId: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  t: Translator;
}

export function ImportUnitsModalView(props: ImportUnitsModalViewProps) {
  const { t: t } = props;

  return (
    <DialogShell
      titleId="import-units-title"
      descriptionId="import-units-description"
      onClose={props.onClose}
      className="w-full max-w-4xl animate-scale-in overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
            <Import className="text-blue-500" size={24} aria-hidden="true" />
          </div>
          <div>
            <h2
              id="import-units-title"
              className="font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100"
            >
              {t('importUnitsModal.importUnitsModalView.importUnits')}
            </h2>
            <p
              id="import-units-description"
              className="font-mono text-sm tracking-wide text-gray-500"
            >
              {t(
                'importUnitsModal.importUnitsModalView.selectUnitsToCopyOrMoveIntoThisGroup',
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label={t('accountModal.close')}
          className="focus-ring rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <fieldset className="mb-6">
        <legend className="mb-4 font-chinese text-lg font-bold text-gray-900 dark:text-slate-100">
          {t('importUnitsModal.importUnitsModalView.importMode')}
        </legend>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <ImportModeOption
            mode="copy"
            selectedMode={props.importMode}
            label={t('importUnitsModal.copy')}
            description={t(
              'importUnitsModal.importUnitsModalView.createACopyInTheGroupKeepTheOriginal',
            )}
            tone="blue"
            onChange={props.onModeChange}
          />
          <ImportModeOption
            mode="move"
            selectedMode={props.importMode}
            label={t('importUnitsModal.move')}
            description={t(
              'importUnitsModal.importUnitsModalView.moveTheUnitIntoTheGroupItWillNo',
            )}
            tone="green"
            onChange={props.onModeChange}
          />
        </div>
      </fieldset>
      <div className="relative mb-6">
        <label htmlFor="import-units-search" className="sr-only">
          {t('importUnitsModal.importUnitsModalView.searchUnits')}
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
          aria-hidden="true"
        />
        <input
          id="import-units-search"
          name="importUnitsSearch"
          data-dialog-initial-focus
          type="search"
          value={props.searchTerm}
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder={t(
            'importUnitsModal.importUnitsModalView.searchUnitsVariant2',
          )}
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
        />
      </div>
      <div className="mb-8 max-h-96 space-y-4 overflow-y-auto">
        {props.units.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-slate-400">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 dark:bg-slate-700">
              <Import size={24} className="text-gray-400" aria-hidden="true" />
            </div>
            <p className="font-chinese text-lg">
              {t(
                'importUnitsModal.importUnitsModalView.noImportableUnitsFound',
              )}
            </p>
            <p className="mt-2 font-mono text-sm text-gray-400 dark:text-slate-500">
              {props.searchTerm
                ? t(
                    'importUnitsModal.importUnitsModalView.tryAdjustingYourSearch',
                  )
                : t(
                    'importUnitsModal.importUnitsModalView.allUnitsAreAlreadyInAGroup',
                  )}
            </p>
          </div>
        ) : (
          props.units.map((unit) => (
            <ImportUnitOption
              key={unit.id}
              unit={unit}
              selected={props.selectedUnits.has(unit.id)}
              language={props.language}
              onToggle={() => props.onToggleUnit(unit.id)}
              t={t}
            />
          ))
        )}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="font-chinese text-sm text-gray-600 dark:text-slate-400">
          {props.selectionSummary}
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={props.onClose}
            className="focus-ring rounded-2xl bg-gray-100 px-6 py-3 font-chinese font-medium text-gray-700 transition duration-300 hover:scale-105 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {t('bettingModal.bettingFormSections.cancel')}
          </button>
          <button
            type="button"
            onClick={props.onSubmit}
            disabled={props.selectedUnits.size === 0}
            className="focus-ring rounded-2xl bg-blue-500 px-6 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:scale-100"
          >
            {t('importUnitsModal.importUnitsModalView.import')}{' '}
            {props.selectedUnits.size > 0 && `(${props.selectedUnits.size})`}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

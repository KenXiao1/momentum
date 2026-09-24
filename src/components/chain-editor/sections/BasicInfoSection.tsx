import type { UnitChainType } from '../../../types';
import { Copy, Layers, Tag } from 'lucide-react';
import { SettingSection } from '../../SettingSection';
import type { ChainEditorFormModel } from '../hooks/useChainEditorForm';
import { useI18n } from '../../../i18n';

interface BasicInfoSectionProps {
  form: ChainEditorFormModel;
}

export function BasicInfoSection({ form }: BasicInfoSectionProps) {
  const { t } = useI18n();

  return (
    <SettingSection
      title={t('chainEditor.basicInfoSection.basicInfo')}
      icon={<Tag className="text-primary-500" size={20} />}
      description={t(
        'chainEditor.basicInfoSection.setTheBasicDetailsOfThisChain',
      )}
    >
      <div className="bento-card animate-scale-in">
        <div className="mb-4">
          <label
            htmlFor="chain-name"
            className="mb-2 block font-chinese text-lg font-semibold text-gray-900 dark:text-slate-100"
          >
            {t('chainEditor.basicInfoSection.chainName')}
          </label>
          <p className="mb-4 font-chinese text-sm text-gray-500 dark:text-slate-400">
            {t(
              'chainEditor.basicInfoSection.giveYourChainAClearAndRecognizableName',
            )}
          </p>
        </div>
        <input
          type="text"
          id="chain-name"
          name="chainName"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder={t(
            'chainEditor.basicInfoSection.eGLearnPythonWorkout30MinutesDistractionFreeWriting',
          )}
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          required
        />
      </div>

      <div className="bento-card animate-scale-in">
        <div className="mb-4">
          <label
            htmlFor="chain-type"
            className="mb-2 block font-chinese text-lg font-semibold text-gray-900 dark:text-slate-100"
          >
            {t('chainEditor.basicInfoSection.taskType')}
          </label>
          <p className="mb-4 font-chinese text-sm text-gray-500 dark:text-slate-400">
            {t('chainEditor.basicInfoSection.chooseTheMostSuitableTaskType')}
          </p>
        </div>
        <select
          id="chain-type"
          name="chainType"
          value={form.type}
          onChange={(e) => form.setType(e.target.value as UnitChainType)}
          className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-4 font-chinese text-gray-900 transition duration-300 hover:border-primary-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-primary-400"
        >
          <option value="unit">{t('chainEditor.basicInfoSection.unit')}</option>
          <option value="assault">
            {t('chainEditor.basicInfoSection.assaultStudyExperimentsPapers')}
          </option>
          <option value="recon">
            {t(
              'chainEditor.basicInfoSection.reconResearchInformationGathering',
            )}
          </option>
          <option value="command">
            {t('chainEditor.basicInfoSection.commandPlanningStrategy')}
          </option>
          <option value="special_ops">
            {t('chainEditor.basicInfoSection.specialOpsMiscellaneousTasks')}
          </option>
          <option value="engineering">
            {t('chainEditor.basicInfoSection.engineeringExerciseTraining')}
          </option>
          <option value="quartermaster">
            {t('chainEditor.basicInfoSection.quartermasterCookingMealPrep')}
          </option>
        </select>
      </div>

      {form.parentId && (
        <div className="bento-card animate-scale-in border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Layers className="text-blue-500" size={24} />
              <div>
                <h4 className="font-chinese text-lg font-bold text-gray-900 dark:text-slate-100">
                  {t('chainEditor.basicInfoSection.groupMembership')}
                </h4>
                <p className="font-chinese text-sm text-gray-600 dark:text-slate-400">
                  {t(
                    'chainEditor.basicInfoSection.thisTaskCurrentlyBelongsToAGroup',
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  form.setParentId(undefined);
                  form.setIsCopyMode(true);
                }}
                className="flex items-center space-x-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-indigo-500 shadow-sm transition-colors hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800"
                title={t(
                  'chainEditor.basicInfoSection.duplicateThisTaskAndRemoveItFromTheGroup',
                )}
              >
                <Copy size={14} />
                <span>{t('chainEditor.basicInfoSection.copyOut')}</span>
              </button>
              <button
                type="button"
                onClick={() => form.setParentId(undefined)}
                className="flex items-center space-x-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-red-500 shadow-sm transition-colors hover:text-red-600 dark:border-slate-700 dark:bg-slate-800"
                title={t(
                  'chainEditor.basicInfoSection.removeThisTaskFromTheGroup',
                )}
              >
                <Layers size={14} className="rotate-180" />
                <span>{t('chainEditor.basicInfoSection.remove')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingSection>
  );
}

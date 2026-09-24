import { type Translator } from '../../i18n';
import React from 'react';
import { Tag } from 'lucide-react';

import { SettingSection } from '../SettingSection';

const ERROR_INPUT_BORDER_CLASSES =
  'border-red-500 focus:border-red-500 focus:ring-red-500/20';

interface FormErrors {
  name?: string;
  description?: string;
}

interface BasicInfoSectionProps {
  name: string;
  description: string;
  errors: FormErrors;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  t: Translator;
}

const BasicInfoSectionComponent: React.FC<BasicInfoSectionProps> = ({
  name,
  description,
  errors,
  onNameChange,
  onDescriptionChange,
  t,
}) => (
  <div data-testid="task-group-editor-basic-info">
    <SettingSection
      title={t('chainEditor.basicInfoSection.basicInfo')}
      icon={<Tag className="text-primary-500" size={20} />}
      description={t(
        'taskGroupEditor.basicInfoSection.setTheBasicInformationForThisGroup',
      )}
    >
      {/* Task Group Name */}
      <div className="bento-card animate-scale-in">
        <div className="mb-4">
          <label
            htmlFor="taskgroup-name"
            className="mb-2 block font-chinese text-lg font-semibold text-gray-900 dark:text-slate-100"
          >
            {t('taskGroupEditor.basicInfoSection.groupName')}
          </label>
          <p className="mb-4 font-chinese text-sm text-gray-500 dark:text-slate-400">
            {t(
              'taskGroupEditor.basicInfoSection.giveYourGroupAClearAndRecognizableName',
            )}
          </p>
        </div>
        <input
          type="text"
          id="taskgroup-name"
          name="taskGroupName"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t(
            'taskGroupEditor.basicInfoSection.eGFinalsStudyPlanWebsiteProjectWorkoutPlan',
          )}
          className={`w-full border bg-gray-50 dark:bg-slate-700 ${errors.name ? ERROR_INPUT_BORDER_CLASSES : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 dark:border-slate-600'} rounded-2xl px-6 py-4 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 dark:text-slate-100 dark:placeholder-slate-400`}
          required
        />
        {errors.name && (
          <p className="mt-2 font-chinese text-sm text-red-600 dark:text-red-400">
            {errors.name}
          </p>
        )}
      </div>

      {/* Task Group Description */}
      <div className="bento-card animate-scale-in">
        <div className="mb-4">
          <label
            htmlFor="taskgroup-description"
            className="mb-2 block font-chinese text-lg font-semibold text-gray-900 dark:text-slate-100"
          >
            {t('taskGroupEditor.basicInfoSection.groupDescription')}
          </label>
          <p className="mb-4 font-chinese text-sm text-gray-500 dark:text-slate-400">
            {t(
              'taskGroupEditor.basicInfoSection.describeTheGoalAndScopeOfThisGroup',
            )}
          </p>
        </div>
        <textarea
          id="taskgroup-description"
          name="taskGroupDescription"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t(
            'taskGroupEditor.basicInfoSection.describeTheGoalAndScopeEGFinalsStudyPlan',
          )}
          rows={4}
          className={`w-full border bg-gray-50 dark:bg-slate-700 ${errors.description ? ERROR_INPUT_BORDER_CLASSES : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 dark:border-slate-600'} resize-none rounded-2xl px-6 py-4 font-chinese leading-relaxed text-gray-900 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 dark:text-slate-100 dark:placeholder-slate-400`}
          required
        />
        {errors.description && (
          <p className="mt-2 font-chinese text-sm text-red-600 dark:text-red-400">
            {errors.description}
          </p>
        )}
      </div>
    </SettingSection>
  </div>
);

export const BasicInfoSection = React.memo(BasicInfoSectionComponent);

BasicInfoSection.displayName = 'BasicInfoSection';

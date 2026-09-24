import { type Translator } from '../../../i18n';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type React from 'react';
import type { ExceptionRule } from '../../../types';
import { ExceptionRuleType } from '../../../types';
import type { RuleManagerFormData } from '../types';

interface RuleManagerFormModalProps {
  isOpen: boolean;
  editingRule: ExceptionRule | null;
  t: Translator;

  formErrors: string[];
  formWarnings: string[];
  duplicateSuggestions: string[];

  formData: RuleManagerFormData;
  setFormData: React.Dispatch<React.SetStateAction<RuleManagerFormData>>;

  setShowCreateForm: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingRule: React.Dispatch<React.SetStateAction<ExceptionRule | null>>;
  resetForm: () => void;

  handleCreateRule: () => Promise<void>;
  handleUpdateRule: () => Promise<void>;
  savingOperations: Set<string>;
}

export function RuleManagerFormModal({
  isOpen,
  editingRule,
  t,
  formErrors,
  formWarnings,
  duplicateSuggestions,
  formData,
  setFormData,
  setShowCreateForm,
  setEditingRule,
  resetForm,
  handleCreateRule,
  handleUpdateRule,
  savingOperations,
}: RuleManagerFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 dark:bg-gray-800">
        <h3 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">
          {editingRule
            ? t('ruleManager.ruleManagerFormModal.editRule')
            : t('ruleManager.ruleManagerFormModal.createRule')}
        </h3>

        {formErrors.length > 0 && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            {formErrors.map((formError, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 text-red-700 dark:text-red-300"
              >
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            ))}
          </div>
        )}

        {formWarnings.length > 0 && (
          <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-500/30 dark:bg-yellow-500/10">
            {formWarnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300"
              >
                <AlertTriangle size={16} />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {duplicateSuggestions.length > 0 && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
            <p className="mb-2 text-blue-700 dark:text-blue-300">
              {t('ruleManager.ruleManagerFormModal.suggestedRuleNames')}
            </p>
            <div className="flex flex-wrap gap-2">
              {duplicateSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setFormData({ ...formData, name: suggestion })}
                  className="rounded-lg bg-blue-100 px-3 py-1 text-sm text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ruleManager.ruleManagerFormModal.ruleName')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) =>
                setFormData({ ...formData, name: event.target.value })
              }
              placeholder={t(
                'ruleManager.ruleManagerFormModal.eGBathroomBreakWaterPhoneCall',
              )}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ruleManager.ruleManagerFormModal.ruleType')}
            </label>
            <select
              value={formData.type}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  type: event.target.value as ExceptionRuleType,
                })
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value={ExceptionRuleType.PAUSE_ONLY}>
                {t(
                  'ruleManager.ruleManagerFormModal.pauseOnlyCanOnlyPauseTheTimer',
                )}
              </option>
              <option value={ExceptionRuleType.EARLY_COMPLETION_ONLY}>
                {t(
                  'ruleManager.ruleManagerFormModal.earlyCompletionOnlyCanOnlyCompleteTasksEarly',
                )}
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ruleManager.ruleManagerFormModal.descriptionOptional')}
            </label>
            <textarea
              value={formData.description}
              onChange={(event) =>
                setFormData({ ...formData, description: event.target.value })
              }
              placeholder={t(
                'ruleManager.ruleManagerFormModal.describeThisException',
              )}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            onClick={() => {
              setShowCreateForm(false);
              setEditingRule(null);
              resetForm();
            }}
            className="rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t('bettingModal.bettingFormSections.cancel')}
          </button>
          <button
            onClick={
              editingRule
                ? () => void handleUpdateRule()
                : () => void handleCreateRule()
            }
            disabled={!formData.name.trim() || savingOperations.size > 0}
            className="flex items-center space-x-2 rounded-xl bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {savingOperations.size > 0 && (
              <Loader2 size={16} className="animate-spin" />
            )}
            <span>
              {editingRule
                ? t('ruleManager.ruleManagerFormModal.update')
                : t('ruleManager.ruleManagerFormModal.create')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

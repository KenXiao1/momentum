import React from 'react';
import {
  AlertTriangle,
  Download,
  Filter,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { ExceptionRuleType } from '../../types';
import RuleItem from '../RuleItem';
import { ConfirmationDialog } from '../ConfirmationDialog';
import type { RuleManagerViewViewProps } from './types';
import { RuleManagerFormModal } from './components/RuleManagerFormModal';

export const RuleManagerViewView: React.FC<RuleManagerViewViewProps> = ({
  onClose,
  onRuleSelected,
  t,
  loading,
  error,
  setError,
  deleteConfirmationRule,
  setDeleteConfirmationRule,
  confirmDeleteRule,
  handleExportRules,
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  sortBy,
  setSortBy,
  filteredRules,
  optimisticUpdates,
  handleEditRule,
  handleDeleteRule,
  showCreateForm,
  setShowCreateForm,
  editingRule,
  setEditingRule,
  resetForm,
  formData,
  setFormData,
  formErrors,
  formWarnings,
  duplicateSuggestions,
  handleCreateRule,
  handleUpdateRule,
  savingOperations,
}) => {
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="rounded-3xl bg-white p-8 dark:bg-gray-800">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500"></div>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            {t('ruleManager.ruleManagerViewView.loadingRules')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden bg-black/80 p-4 backdrop-blur-sm">
      <ConfirmationDialog
        isOpen={deleteConfirmationRule !== null}
        title={t('ruleManager.ruleManagerViewView.confirmDeletion')}
        message={
          deleteConfirmationRule
            ? t(
                'ruleManager.ruleManagerViewView.deleteRuleDeleteConfirmationRuleName',
                { deleteConfirmationRuleName: deleteConfirmationRule.name },
              )
            : ''
        }
        confirmText={t('deletedChainCard.delete')}
        cancelText={t('bettingModal.bettingFormSections.cancel')}
        onConfirm={() => void confirmDeleteRule()}
        onCancel={() => setDeleteConfirmationRule(null)}
      />
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800"
        style={{ maxWidth: 'min(1152px, 100vw - 2rem)' }}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/20">
              <Settings className="text-primary-500" size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('ruleManager.ruleManagerViewView.exceptionRules')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(
                  'ruleManager.ruleManagerViewView.manageExceptionRulesForPausingOrEarlyCompletion',
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => void handleExportRules()}
              className="flex items-center space-x-2 rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <Download size={16} />
              <span>{t('ruleManager.ruleManagerViewView.export')}</span>
            </button>

            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 rounded-xl bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
            >
              <Plus size={16} />
              <span>
                {t('ruleManager.ruleManagerViewView.createChainSpecificRule')}
              </span>
            </button>

            <button
              onClick={onClose}
              className="rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {t('accountModal.close')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center space-x-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <AlertTriangle className="text-red-500" size={20} />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex h-[calc(90vh-120px)]">
          <div className="flex flex-1 flex-col">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder={t(
                      'ruleManager.ruleManagerViewView.searchRuleNameOrDescription',
                    )}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as ExceptionRuleType | 'all')
                  }
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">
                    {t('ruleManager.ruleManagerViewView.allTypes')}
                  </option>
                  <option value={ExceptionRuleType.PAUSE_ONLY}>
                    {t('ruleItem.pauseOnly')}
                  </option>
                  <option value={ExceptionRuleType.EARLY_COMPLETION_ONLY}>
                    {t('ruleItem.earlyCompletionOnly')}
                  </option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="usage">
                    {t('ruleManager.ruleManagerViewView.mostUsed')}
                  </option>
                  <option value="name">
                    {t('ruleManager.ruleManagerViewView.name')}
                  </option>
                  <option value="lastUsed">
                    {t('ruleManager.ruleManagerViewView.lastUsed')}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {filteredRules.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                    <Filter className="text-gray-400" size={24} />
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
                    {searchQuery || typeFilter !== 'all'
                      ? t('ruleManager.ruleManagerViewView.noMatchingRules')
                      : t('ruleManager.ruleManagerViewView.noRulesYet')}
                  </h3>
                  <p className="mb-4 text-gray-500 dark:text-gray-400">
                    {searchQuery || typeFilter !== 'all'
                      ? t(
                          'ruleManager.ruleManagerViewView.tryAdjustingYourSearchOrFilters',
                        )
                      : t(
                          'ruleManager.ruleManagerViewView.createYourFirstExceptionRuleToGetStarted',
                        )}
                  </p>
                  {!searchQuery && typeFilter === 'all' && (
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="rounded-xl bg-primary-500 px-6 py-3 text-white transition-colors hover:bg-primary-600"
                    >
                      {t('ruleManager.ruleManagerViewView.createRule')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredRules.map((rule) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      isOptimistic={optimisticUpdates.has(rule.id)}
                      onEdit={handleEditRule}
                      onDelete={handleDeleteRule}
                      onSelect={onRuleSelected}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <RuleManagerFormModal
          isOpen={showCreateForm || editingRule !== null}
          editingRule={editingRule}
          t={t}
          formErrors={formErrors}
          formWarnings={formWarnings}
          duplicateSuggestions={duplicateSuggestions}
          formData={formData}
          setFormData={setFormData}
          setShowCreateForm={setShowCreateForm}
          setEditingRule={setEditingRule}
          resetForm={resetForm}
          handleCreateRule={handleCreateRule}
          handleUpdateRule={handleUpdateRule}
          savingOperations={savingOperations}
        />
      </div>
    </div>
  );
};

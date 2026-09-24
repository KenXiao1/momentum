import { useI18n } from '../../i18n';
import { RuleManagerViewView } from './RuleManagerViewView';
import { useRuleManagerActions } from './hooks/useRuleManagerActions';
import { useRuleManagerData } from './hooks/useRuleManagerData';
import { useRuleManagerFilters } from './hooks/useRuleManagerFilters';
import { useRuleManagerForm } from './hooks/useRuleManagerForm';
import type { RuleManagerViewProps } from './types';

export function RuleManagerView({
  onClose,
  initialFilter,
  onRuleSelected,
}: RuleManagerViewProps) {
  const { language, t } = useI18n();

  const { rules, setRules, loading, error, setError, loadRules } =
    useRuleManagerData({ language, t });

  const {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    filteredRules,
  } = useRuleManagerFilters({ rules, initialFilter });

  const form = useRuleManagerForm();

  const actions = useRuleManagerActions({
    language,
    t,
    loadRules,
    setError,
    formData: form.formData,
    editingRule: form.editingRule,
    setEditingRule: form.setEditingRule,
    setShowCreateForm: form.setShowCreateForm,
    resetForm: form.resetForm,
    beginEditRule: form.beginEditRule,
    setRules,
    setFormErrors: form.setFormErrors,
    setFormWarnings: form.setFormWarnings,
    setDuplicateSuggestions: form.setDuplicateSuggestions,
  });

  return (
    <RuleManagerViewView
      onClose={onClose}
      onRuleSelected={onRuleSelected}
      t={t}
      loading={loading}
      error={error}
      setError={setError}
      deleteConfirmationRule={actions.deleteConfirmationRule}
      setDeleteConfirmationRule={actions.setDeleteConfirmationRule}
      confirmDeleteRule={actions.confirmDeleteRule}
      handleExportRules={actions.handleExportRules}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      sortBy={sortBy}
      setSortBy={setSortBy}
      filteredRules={filteredRules}
      optimisticUpdates={actions.optimisticUpdates}
      handleEditRule={actions.handleEditRule}
      handleDeleteRule={actions.handleDeleteRule}
      showCreateForm={form.showCreateForm}
      setShowCreateForm={form.setShowCreateForm}
      editingRule={form.editingRule}
      setEditingRule={form.setEditingRule}
      resetForm={form.resetForm}
      formData={form.formData}
      setFormData={form.setFormData}
      formErrors={form.formErrors}
      formWarnings={form.formWarnings}
      duplicateSuggestions={form.duplicateSuggestions}
      handleCreateRule={actions.handleCreateRule}
      handleUpdateRule={actions.handleUpdateRule}
      savingOperations={actions.savingOperations}
    />
  );
}

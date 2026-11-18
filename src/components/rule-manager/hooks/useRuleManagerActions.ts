import { useCallback, useState } from 'react';
import type { ExceptionRule } from '../../../types';
import { ExceptionRuleError, ExceptionRuleException } from '../../../types';
import { exceptionRuleManager } from '../../../services/ExceptionRuleManager';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
} from '../../../utils/errorMessage';
import { getPlatformCapabilityCenter } from '../../../utils/platform-capabilities/center';
import {
  removeRuleById,
  replaceRuleById,
  type UseRuleManagerActionsArgs,
} from './useRuleManagerActions.helpers';

export function useRuleManagerActions(args: UseRuleManagerActionsArgs) {
  const {
    language,
    t,
    loadRules,
    setError,
    formData,
    editingRule,
    setEditingRule,
    setShowCreateForm,
    resetForm,
    beginEditRule,
    setRules,
    setFormErrors,
    setFormWarnings,
    setDuplicateSuggestions,
  } = args;

  const [deleteConfirmationRule, setDeleteConfirmationRule] =
    useState<ExceptionRule | null>(null);
  const [savingOperations, setSavingOperations] = useState<Set<string>>(
    new Set(),
  );
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<string, ExceptionRule>
  >(new Map());
  const capabilityCenter = getPlatformCapabilityCenter();

  const finishOperation = useCallback((operationId: string) => {
    setSavingOperations((prev) => {
      const next = new Set(prev);
      next.delete(operationId);
      return next;
    });
    setOptimisticUpdates((prev) => {
      const next = new Map(prev);
      next.delete(operationId);
      return next;
    });
  }, []);

  const showRuleError = useCallback(
    (error: unknown, fallback: string) => {
      const safe =
        error instanceof ExceptionRuleException
          ? getSafeErrorDetail(error.message, language)
          : null;
      setFormErrors([safe ?? fallback]);
    },
    [language, setFormErrors],
  );

  const handleCreateRule = useCallback(async () => {
    const operationId = `create-rule-${Date.now()}`;
    const tempRule: ExceptionRule = {
      id: operationId,
      name: formData.name,
      type: formData.type,
      description: formData.description || undefined,
      scope: 'global',
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
    };
    setFormErrors([]);
    setFormWarnings([]);
    setSavingOperations((prev) => new Set(prev).add(operationId));
    setOptimisticUpdates((prev) => new Map(prev).set(operationId, tempRule));
    setRules((prev) => [...prev, tempRule]);

    try {
      const result = await exceptionRuleManager.createRule(
        formData.name,
        formData.type,
        formData.description || undefined,
      );
      setRules((prev) => replaceRuleById(prev, operationId, result.rule));
      if (result.warnings.length === 0) {
        setShowCreateForm(false);
        resetForm();
      } else {
        setFormWarnings(result.warnings);
      }
    } catch (error) {
      setRules((prev) => removeRuleById(prev, operationId));
      showRuleError(
        error,
        t('ruleManager.useRuleManagerActions.failedToCreateRulePleaseTryAgain'),
      );
      if (
        error instanceof ExceptionRuleException &&
        error.type === ExceptionRuleError.DUPLICATE_RULE_NAME
      ) {
        setDuplicateSuggestions(
          await exceptionRuleManager
            .suggestRuleNames(formData.name)
            .catch(() => []),
        );
      }
    } finally {
      finishOperation(operationId);
    }
  }, [
    finishOperation,
    formData.description,
    formData.name,
    formData.type,
    resetForm,
    setDuplicateSuggestions,
    setFormErrors,
    setFormWarnings,
    setRules,
    setShowCreateForm,
    showRuleError,
    t,
  ]);

  const handleUpdateRule = useCallback(async () => {
    if (!editingRule) return;
    const operationId = `update-rule-${editingRule.id}-${Date.now()}`;
    const originalRule = editingRule;
    const updates = {
      name: formData.name,
      type: formData.type,
      description: formData.description || undefined,
    };
    setFormErrors([]);
    setFormWarnings([]);
    setSavingOperations((prev) => new Set(prev).add(operationId));
    setRules((prev) =>
      replaceRuleById(prev, originalRule.id, { ...originalRule, ...updates }),
    );

    try {
      const result = await exceptionRuleManager.updateRule(
        originalRule.id,
        updates,
      );
      setRules((prev) => replaceRuleById(prev, originalRule.id, result.rule));
      if (result.warnings.length === 0) {
        setEditingRule(null);
        resetForm();
      } else {
        setFormWarnings(result.warnings);
      }
    } catch (error) {
      setRules((prev) => replaceRuleById(prev, originalRule.id, originalRule));
      showRuleError(
        error,
        t('ruleManager.useRuleManagerActions.failedToUpdateRulePleaseTryAgain'),
      );
    } finally {
      finishOperation(operationId);
    }
  }, [
    editingRule,
    finishOperation,
    formData.description,
    formData.name,
    formData.type,
    resetForm,
    setEditingRule,
    setFormErrors,
    setFormWarnings,
    setRules,
    showRuleError,
    t,
  ]);

  const handleDeleteRule = useCallback((rule: ExceptionRule) => {
    setDeleteConfirmationRule(rule);
  }, []);

  const confirmDeleteRule = useCallback(async () => {
    const rule = deleteConfirmationRule;
    if (!rule) return;
    setDeleteConfirmationRule(null);

    try {
      await exceptionRuleManager.deleteRule(rule.id);
      await loadRules();
    } catch (err) {
      const safe = getSafeErrorDetailFromUnknown(err, language);
      setError(
        safe ?? t('ruleManager.useRuleManagerActions.failedToDeleteRule'),
      );
    }
  }, [deleteConfirmationRule, language, loadRules, setError, t]);

  const handleEditRule = useCallback(
    (rule: ExceptionRule) => {
      beginEditRule(rule);
    },
    [beginEditRule],
  );

  const handleExportRules = useCallback(async () => {
    try {
      const exportData = await exceptionRuleManager.exportRules(true);
      await capabilityCenter.file.saveFile(
        JSON.stringify(exportData, null, 2),
        `exception-rules-${new Date().toISOString().split('T')[0]}.json`,
      );
    } catch {
      setError(t('ruleManager.useRuleManagerActions.failedToExportRules'));
    }
  }, [capabilityCenter.file, setError, t]);

  return {
    deleteConfirmationRule,
    setDeleteConfirmationRule,
    confirmDeleteRule,
    handleDeleteRule,
    handleEditRule,
    handleExportRules,
    handleCreateRule,
    handleUpdateRule,
    savingOperations,
    optimisticUpdates,
  };
}

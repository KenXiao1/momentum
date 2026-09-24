import { useCallback, useState } from 'react';
import type { ExceptionRule } from '../../../types';
import { ExceptionRuleError, ExceptionRuleException } from '../../../types';
import { exceptionRuleManager } from '../../../services/ExceptionRuleManager';
import { asyncOperationManager } from '../../../utils/AsyncOperationManager';
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

  const handleCreateRule = useCallback(async () => {
    const operationId = `create-rule-${Date.now()}`;

    try {
      setFormErrors([]);
      setFormWarnings([]);
      setSavingOperations((prev) => new Set(prev).add(operationId));

      const tempRule: ExceptionRule = {
        id: operationId,
        name: formData.name,
        type: formData.type,
        description: formData.description || undefined,
        scope: 'chain',
        isActive: true,
        usageCount: 0,
        createdAt: new Date(),
      };

      setOptimisticUpdates((prev) => new Map(prev).set(operationId, tempRule));
      setRules((prev) => [...prev, tempRule]);

      await asyncOperationManager.executeOperation({
        id: operationId,
        operation: () =>
          exceptionRuleManager.createRule(
            formData.name,
            formData.type,
            formData.description || undefined,
          ),
        timeout: 3000,
        retryCount: 2,
        onSuccess: (result) => {
          setRules((prev) => replaceRuleById(prev, operationId, result.rule));
          setOptimisticUpdates((prev) => {
            const newMap = new Map(prev);
            newMap.delete(operationId);
            return newMap;
          });

          if (result.warnings.length === 0) {
            setShowCreateForm(false);
            resetForm();
          } else {
            setFormWarnings(result.warnings);
          }
        },
        onError: (error) => {
          setRules((prev) => removeRuleById(prev, operationId));
          setOptimisticUpdates((prev) => {
            const newMap = new Map(prev);
            newMap.delete(operationId);
            return newMap;
          });

          if (error instanceof ExceptionRuleException) {
            const safe = getSafeErrorDetail(error.message, language);
            setFormErrors([
              safe ??
                t(
                  'ruleManager.useRuleManagerActions.failedToCreateRulePleaseTryAgain',
                ),
            ]);

            if (error.type === ExceptionRuleError.DUPLICATE_RULE_NAME) {
              exceptionRuleManager
                .getDuplicationSuggestions(formData.name)
                .then((suggestions) => {
                  setDuplicateSuggestions(suggestions.nameSuggestions);
                });
            }
          } else {
            setFormErrors([
              t(
                'ruleManager.useRuleManagerActions.failedToCreateRulePleaseTryAgain',
              ),
            ]);
          }
        },
      });
    } catch {
      setRules((prev) => prev.filter((rule) => rule.id !== operationId));
      setOptimisticUpdates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(operationId);
        return newMap;
      });
      setFormErrors([t('ruleSelectionDialog.failedToCreateRule')]);
    } finally {
      setSavingOperations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [
    formData.description,
    formData.name,
    formData.type,
    language,
    resetForm,
    setDuplicateSuggestions,
    setFormErrors,
    setFormWarnings,
    setRules,
    setShowCreateForm,
    t,
  ]);

  const handleUpdateRule = useCallback(async () => {
    if (!editingRule) return;

    const operationId = `update-rule-${editingRule.id}-${Date.now()}`;
    const originalRule = editingRule;

    try {
      setFormErrors([]);
      setFormWarnings([]);
      setSavingOperations((prev) => new Set(prev).add(operationId));

      const updatedRule: ExceptionRule = {
        ...originalRule,
        name: formData.name,
        type: formData.type,
        description: formData.description || undefined,
      };

      setRules((prev) => replaceRuleById(prev, originalRule.id, updatedRule));

      await asyncOperationManager.executeOperation({
        id: operationId,
        operation: () =>
          exceptionRuleManager.updateRule(originalRule.id, {
            name: formData.name,
            type: formData.type,
            description: formData.description || undefined,
          }),
        timeout: 3000,
        retryCount: 2,
        onSuccess: (result) => {
          if (result.warnings.length === 0) {
            setEditingRule(null);
            resetForm();
          } else {
            setFormWarnings(result.warnings);
          }
        },
        onError: (error) => {
          setRules((prev) =>
            replaceRuleById(prev, originalRule.id, originalRule),
          );

          if (error instanceof ExceptionRuleException) {
            const safe = getSafeErrorDetail(error.message, language);
            setFormErrors([
              safe ??
                t(
                  'ruleManager.useRuleManagerActions.failedToUpdateRulePleaseTryAgain',
                ),
            ]);
          } else {
            setFormErrors([
              t(
                'ruleManager.useRuleManagerActions.failedToUpdateRulePleaseTryAgain',
              ),
            ]);
          }
        },
      });
    } catch {
      setRules((prev) => replaceRuleById(prev, originalRule.id, originalRule));
      setFormErrors([
        t('ruleManager.useRuleManagerActions.failedToUpdateRule'),
      ]);
    } finally {
      setSavingOperations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [
    editingRule,
    formData.description,
    formData.name,
    formData.type,
    language,
    resetForm,
    setEditingRule,
    setFormErrors,
    setFormWarnings,
    setRules,
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

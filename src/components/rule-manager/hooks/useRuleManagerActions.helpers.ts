import { type Translator } from '../../../i18n';
import type { ExceptionRule } from '../../../types';
import type { Language } from '../../../i18n/translations';
import type { RuleManagerFormData } from '../types';
import type { Dispatch, SetStateAction } from 'react';

export interface UseRuleManagerActionsArgs {
  language: Language;
  t: Translator;
  loadRules: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  formData: RuleManagerFormData;
  editingRule: ExceptionRule | null;
  setEditingRule: Dispatch<SetStateAction<ExceptionRule | null>>;
  setShowCreateForm: Dispatch<SetStateAction<boolean>>;
  resetForm: () => void;
  beginEditRule: (rule: ExceptionRule) => void;
  setRules: Dispatch<SetStateAction<ExceptionRule[]>>;
  setFormErrors: Dispatch<SetStateAction<string[]>>;
  setFormWarnings: Dispatch<SetStateAction<string[]>>;
  setDuplicateSuggestions: Dispatch<SetStateAction<string[]>>;
}

export function replaceRuleById(
  rules: ExceptionRule[],
  targetId: string,
  nextRule: ExceptionRule,
) {
  return rules.map((rule) => (rule.id === targetId ? nextRule : rule));
}

export function removeRuleById(rules: ExceptionRule[], targetId: string) {
  return rules.filter((rule) => rule.id !== targetId);
}
